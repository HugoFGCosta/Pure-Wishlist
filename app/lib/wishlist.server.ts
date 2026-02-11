import { supabaseAdmin } from "../db.server";
import type { WishlistItem } from "./types";

export async function toggleWishlistItem(
  shopId: string,
  customerId: number,
  productId: number,
): Promise<{ added: boolean }> {
  // Check if item exists
  const { data: existing } = await supabaseAdmin
    .from("wishlists")
    .select("id")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .eq("product_id", productId)
    .single();

  if (existing) {
    // Remove
    await supabaseAdmin
      .from("wishlists")
      .delete()
      .eq("id", existing.id);

    await logEvent(shopId, customerId, productId, "removed");
    return { added: false };
  }

  // Add
  const { error } = await supabaseAdmin
    .from("wishlists")
    .insert({ shop_id: shopId, customer_id: customerId, product_id: productId });

  if (error) throw new Error(`Failed to add wishlist item: ${error.message}`);

  await logEvent(shopId, customerId, productId, "added");
  return { added: true };
}

export async function checkWishlistItems(
  shopId: string,
  customerId: number,
  productIds: number[],
): Promise<Record<number, boolean>> {
  const { data } = await supabaseAdmin
    .from("wishlists")
    .select("product_id")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .in("product_id", productIds);

  const result: Record<number, boolean> = {};
  for (const pid of productIds) {
    result[pid] = data?.some((w) => w.product_id === pid) ?? false;
  }
  return result;
}

export async function getCustomerWishlist(
  shopId: string,
  customerId: number,
): Promise<WishlistItem[]> {
  const { data, error } = await supabaseAdmin
    .from("wishlists")
    .select("*")
    .eq("shop_id", shopId)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`Failed to get wishlist: ${error.message}`);
  return data || [];
}

export async function getShopWishlists(
  shopId: string,
  options?: {
    page?: number;
    limit?: number;
    search?: string;
    productId?: number;
    customerId?: number;
  },
) {
  const limit = options?.limit || 25;
  const page = options?.page || 1;
  const offset = (page - 1) * limit;

  let query = supabaseAdmin
    .from("wishlists")
    .select("*", { count: "exact" })
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });

  if (options?.productId) query = query.eq("product_id", options.productId);
  if (options?.customerId) query = query.eq("customer_id", options.customerId);

  // Search by product_id or customer_id
  if (options?.search) {
    const num = Number(options.search);
    if (!isNaN(num)) {
      query = query.or(`product_id.eq.${num},customer_id.eq.${num}`);
    }
  }

  query = query.range(offset, offset + limit - 1);

  const { data, count, error } = await query;
  if (error) throw new Error(`Failed to get wishlists: ${error.message}`);
  return { wishlists: data || [], total: count || 0 };
}

export async function getTopProducts(shopId: string, limit = 10) {
  const { data, error } = await supabaseAdmin.rpc("get_top_wishlisted_products", {
    p_shop_id: shopId,
    p_limit: limit,
  });

  // Fallback if RPC doesn't exist yet
  if (error) {
    const { data: fallback } = await supabaseAdmin
      .from("wishlists")
      .select("product_id")
      .eq("shop_id", shopId);

    const counts: Record<number, number> = {};
    fallback?.forEach((w) => {
      counts[w.product_id] = (counts[w.product_id] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([product_id, count]) => ({ product_id: Number(product_id), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  return data;
}

export async function getTopCustomers(shopId: string, limit = 10) {
  const { data } = await supabaseAdmin
    .from("wishlists")
    .select("customer_id")
    .eq("shop_id", shopId);

  const counts: Record<number, number> = {};
  data?.forEach((w) => {
    counts[w.customer_id] = (counts[w.customer_id] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([customer_id, count]) => ({ customer_id: Number(customer_id), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

async function logEvent(
  shopId: string,
  customerId: number,
  productId: number,
  eventType: string,
) {
  await supabaseAdmin
    .from("wishlist_events")
    .insert({
      shop_id: shopId,
      customer_id: customerId,
      product_id: productId,
      event_type: eventType,
    });
}

export async function logPurchaseEvent(
  shopId: string,
  customerId: number,
  productId: number,
) {
  await logEvent(shopId, customerId, productId, "purchased");
}
