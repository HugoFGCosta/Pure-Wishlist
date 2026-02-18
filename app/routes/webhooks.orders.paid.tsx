import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopByDomain, supabaseAdmin } from "../db.server";
import { logPurchaseEvent } from "../lib/wishlist.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop, payload } = await authenticate.webhook(request);

  const order = payload as {
    customer?: { id: number };
    line_items: Array<{ product_id: number }>;
  };

  if (!order.customer?.id) {
    return new Response(null, { status: 200 });
  }

  let shopRecord;
  try {
    shopRecord = await getShopByDomain(shop);
  } catch {
    return new Response(null, { status: 200 });
  }

  const customerId = order.customer.id;
  const productIds = order.line_items.map((i) => i.product_id).filter(Boolean);

  if (!productIds.length) {
    return new Response(null, { status: 200 });
  }

  // Check which purchased products were in this customer's wishlist
  const { data: wishlisted } = await supabaseAdmin
    .from("wishlists")
    .select("product_id")
    .eq("shop_id", shopRecord.id)
    .eq("customer_id", customerId)
    .in("product_id", productIds);

  for (const item of wishlisted ?? []) {
    await logPurchaseEvent(shopRecord.id, customerId, item.product_id);
  }

  return new Response(null, { status: 200 });
};
