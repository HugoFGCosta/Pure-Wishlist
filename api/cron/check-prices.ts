import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } },
);

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

const PRICE_DROP_THRESHOLD = 0.1; // 10%

export default async function handler(req: Request) {
  // Verify cron secret
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Get all active shops with price drop notifications enabled
    const { data: shops } = await supabase
      .from("shops")
      .select("*")
      .is("uninstalled_at", null);

    if (!shops?.length) {
      return Response.json({ message: "No active shops" });
    }

    let totalNotifications = 0;

    for (const shop of shops) {
      const settings = shop.settings as { notify_price_drop?: boolean };
      if (!settings?.notify_price_drop) continue;

      // Get all wishlisted product IDs for this shop
      const { data: wishlistItems } = await supabase
        .from("wishlists")
        .select("product_id, customer_id")
        .eq("shop_id", shop.id);

      if (!wishlistItems?.length) continue;

      const uniqueProductIds = [...new Set(wishlistItems.map((w) => w.product_id))];

      // Fetch current prices from Shopify Admin API
      const shopifyResponse = await fetch(
        `https://${shop.shop_domain}/admin/api/2025-01/products.json?ids=${uniqueProductIds.join(",")}&fields=id,title,handle,variants`,
        {
          headers: {
            "X-Shopify-Access-Token": shop.access_token,
            "Content-Type": "application/json",
          },
        },
      );

      if (!shopifyResponse.ok) {
        console.error(`Failed to fetch products for ${shop.shop_domain}`);
        continue;
      }

      const { products } = await shopifyResponse.json();

      for (const product of products) {
        const currentPrice = parseFloat(product.variants[0]?.price || "0");
        const totalInventory = product.variants.reduce(
          (sum: number, v: { inventory_quantity: number }) =>
            sum + (v.inventory_quantity || 0),
          0,
        );

        // Get last snapshot
        const { data: lastSnapshot } = await supabase
          .from("product_snapshots")
          .select("price, inventory_quantity")
          .eq("shop_id", shop.id)
          .eq("product_id", product.id)
          .order("captured_at", { ascending: false })
          .limit(1)
          .single();

        if (lastSnapshot) {
          const priceDrop =
            (lastSnapshot.price - currentPrice) / lastSnapshot.price;

          if (priceDrop >= PRICE_DROP_THRESHOLD) {
            // Find all customers who have this product wishlisted
            const customers = wishlistItems.filter(
              (w) => w.product_id === product.id,
            );

            for (const entry of customers) {
              // Check if already notified today
              const today = new Date().toISOString().split("T")[0];
              const { data: existing } = await supabase
                .from("notification_log")
                .select("id")
                .eq("shop_id", shop.id)
                .eq("customer_id", entry.customer_id)
                .eq("product_id", product.id)
                .eq("type", "price_drop")
                .gte("sent_at", `${today}T00:00:00Z`)
                .limit(1);

              if (existing?.length) continue;

              // Fetch customer email from Shopify
              try {
                const customerResponse = await fetch(
                  `https://${shop.shop_domain}/admin/api/2025-01/customers/${entry.customer_id}.json?fields=id,first_name,email`,
                  {
                    headers: {
                      "X-Shopify-Access-Token": shop.access_token,
                      "Content-Type": "application/json",
                    },
                  },
                );

                if (!customerResponse.ok) continue;

                const { customer } = await customerResponse.json();
                if (!customer.email) continue;

                const shopName = shop.shop_domain.replace(".myshopify.com", "");
                const productUrl = `https://${shop.shop_domain}/products/${product.handle}`;

                await resend.emails.send({
                  from: `${shopName} <${fromEmail}>`,
                  to: customer.email,
                  subject: `Price drop on ${product.title}!`,
                  html: `
                    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
                      <h2>Hi ${customer.first_name || "there"},</h2>
                      <p>Great news! A product on your wishlist just dropped in price.</p>
                      <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
                        <h3 style="margin-top: 0;">${product.title}</h3>
                        <p>
                          <span style="text-decoration: line-through; color: #999;">$${lastSnapshot.price.toFixed(2)}</span>
                          <span style="color: #e53e3e; font-size: 1.2em; font-weight: bold; margin-left: 8px;">$${currentPrice.toFixed(2)}</span>
                        </p>
                      </div>
                      <a href="${productUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none;">View Product</a>
                      <p style="color: #999; font-size: 12px; margin-top: 30px;">You received this because this product is on your wishlist.</p>
                    </div>
                  `,
                });

                await supabase.from("notification_log").insert({
                  shop_id: shop.id,
                  customer_id: entry.customer_id,
                  product_id: product.id,
                  type: "price_drop",
                });

                totalNotifications++;
              } catch (err) {
                console.error("Failed to send price drop email:", err);
              }
            }
          }
        }

        // Save current snapshot
        await supabase.from("product_snapshots").upsert(
          {
            shop_id: shop.id,
            product_id: product.id,
            price: currentPrice,
            inventory_quantity: totalInventory,
            captured_at: new Date().toISOString(),
          },
          { onConflict: "shop_id,product_id" },
        );
      }
    }

    return Response.json({
      success: true,
      notifications: totalNotifications,
    });
  } catch (error) {
    console.error("Cron job failed:", error);
    return Response.json({ error: "Cron job failed" }, { status: 500 });
  }
}
