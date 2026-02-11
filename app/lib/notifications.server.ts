import { Resend } from "resend";
import { supabaseAdmin } from "../db.server";

const resend = new Resend(process.env.RESEND_API_KEY);
const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export async function sendPriceDropEmail(params: {
  to: string;
  customerName: string;
  productTitle: string;
  oldPrice: string;
  newPrice: string;
  productUrl: string;
  shopName: string;
}) {
  const { to, customerName, productTitle, oldPrice, newPrice, productUrl, shopName } = params;

  await resend.emails.send({
    from: `${shopName} <${fromEmail}>`,
    to,
    subject: `Price drop on ${productTitle}!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hi ${customerName},</h2>
        <p>Great news! A product on your wishlist just dropped in price.</p>
        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${productTitle}</h3>
          <p>
            <span style="text-decoration: line-through; color: #999;">${oldPrice}</span>
            <span style="color: #e53e3e; font-size: 1.2em; font-weight: bold; margin-left: 8px;">${newPrice}</span>
          </p>
        </div>
        <a href="${productUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">View Product</a>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">You received this email because this product is on your wishlist at ${shopName}.</p>
      </div>
    `,
  });
}

export async function sendBackInStockEmail(params: {
  to: string;
  customerName: string;
  productTitle: string;
  productUrl: string;
  shopName: string;
}) {
  const { to, customerName, productTitle, productUrl, shopName } = params;

  await resend.emails.send({
    from: `${shopName} <${fromEmail}>`,
    to,
    subject: `${productTitle} is back in stock!`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Hi ${customerName},</h2>
        <p>A product on your wishlist is back in stock!</p>
        <div style="background: #f9f9f9; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0;">${productTitle}</h3>
          <p style="color: #38a169; font-weight: bold;">Back in Stock</p>
        </div>
        <a href="${productUrl}" style="display: inline-block; background: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">View Product</a>
        <p style="color: #999; font-size: 12px; margin-top: 30px;">You received this email because this product is on your wishlist at ${shopName}.</p>
      </div>
    `,
  });
}

export async function logNotification(
  shopId: string,
  customerId: number,
  productId: number,
  type: "price_drop" | "back_in_stock",
) {
  await supabaseAdmin.from("notification_log").insert({
    shop_id: shopId,
    customer_id: customerId,
    product_id: productId,
    type,
  });
}

export async function wasNotifiedToday(
  shopId: string,
  customerId: number,
  productId: number,
  type: string,
): Promise<boolean> {
  const today = new Date().toISOString().split("T")[0];
  const { data } = await supabaseAdmin
    .from("notification_log")
    .select("id")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .eq("product_id", productId)
    .eq("type", type)
    .gte("sent_at", `${today}T00:00:00Z`)
    .limit(1);

  return (data?.length ?? 0) > 0;
}
