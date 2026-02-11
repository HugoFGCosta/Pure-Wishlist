import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { supabaseAdmin, getShopByDomain } from "../db.server";
import {
  sendBackInStockEmail,
  logNotification,
  wasNotifiedToday,
} from "../lib/notifications.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  const product = payload as {
    id: number;
    title: string;
    handle: string;
    variants: Array<{ inventory_quantity: number; price: string }>;
  };

  let shopRecord;
  try {
    shopRecord = await getShopByDomain(shop);
  } catch {
    return new Response(null, { status: 200 });
  }

  const settings = shopRecord.settings as { notify_back_in_stock?: boolean };
  if (!settings.notify_back_in_stock) {
    return new Response(null, { status: 200 });
  }

  // Check if product came back in stock
  const totalInventory = product.variants.reduce(
    (sum, v) => sum + (v.inventory_quantity || 0),
    0,
  );

  // Get previous snapshot
  const { data: lastSnapshot } = await supabaseAdmin
    .from("product_snapshots")
    .select("inventory_quantity")
    .eq("shop_id", shopRecord.id)
    .eq("product_id", product.id)
    .order("captured_at", { ascending: false })
    .limit(1)
    .single();

  const wasOutOfStock = lastSnapshot && lastSnapshot.inventory_quantity === 0;

  if (wasOutOfStock && totalInventory > 0) {
    // Find all customers who have this product wishlisted
    const { data: wishlistEntries } = await supabaseAdmin
      .from("wishlists")
      .select("customer_id")
      .eq("shop_id", shopRecord.id)
      .eq("product_id", product.id);

    if (wishlistEntries?.length) {
      const shopDomain = shopRecord.shop_domain.replace(".myshopify.com", "");
      const productUrl = `https://${shopRecord.shop_domain}/products/${product.handle}`;

      // Get customer emails via Shopify Admin API
      // For each customer, send back-in-stock email
      for (const entry of wishlistEntries) {
        const alreadyNotified = await wasNotifiedToday(
          shopRecord.id,
          entry.customer_id,
          product.id,
          "back_in_stock",
        );

        if (!alreadyNotified) {
          try {
            // TODO: Fetch customer email from Shopify Admin API
            // For now, log the notification intent
            await logNotification(
              shopRecord.id,
              entry.customer_id,
              product.id,
              "back_in_stock",
            );
          } catch (err) {
            console.error("Failed to send back-in-stock email:", err);
          }
        }
      }
    }
  }

  // Save snapshot
  const price = product.variants[0]?.price || "0";
  await supabaseAdmin.from("product_snapshots").upsert(
    {
      shop_id: shopRecord.id,
      product_id: product.id,
      price: parseFloat(price),
      inventory_quantity: totalInventory,
      captured_at: new Date().toISOString(),
    },
    { onConflict: "shop_id,product_id,captured_at" },
  );

  return new Response(null, { status: 200 });
};
