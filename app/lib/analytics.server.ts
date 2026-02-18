import { supabaseAdmin } from "../db.server";

export async function getDashboardStats(shopId: string) {
  const [wishlists, uniqueCustomers, uniqueProducts, events30d, purchaseEvents] =
    await Promise.all([
      supabaseAdmin
        .from("wishlists")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shopId),
      supabaseAdmin
        .from("wishlists")
        .select("customer_id")
        .eq("shop_id", shopId),
      supabaseAdmin
        .from("wishlists")
        .select("product_id")
        .eq("shop_id", shopId),
      supabaseAdmin
        .from("wishlist_events")
        .select("*")
        .eq("shop_id", shopId)
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: true }),
      supabaseAdmin
        .from("wishlist_events")
        .select("*", { count: "exact", head: true })
        .eq("shop_id", shopId)
        .eq("event_type", "purchased")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

  const uniqueCustomerIds = new Set(uniqueCustomers.data?.map((w) => w.customer_id));
  const uniqueProductIds = new Set(uniqueProducts.data?.map((w) => w.product_id));

  const totalWishlists = wishlists.count || 0;
  const totalAdded = (events30d.data?.filter((e) => e.event_type === "added").length) || 0;
  const totalPurchased = purchaseEvents.count || 0;

  // Group events by day for chart
  const dailyActivity: Record<string, { added: number; removed: number }> = {};
  events30d.data?.forEach((event) => {
    const day = event.created_at.split("T")[0];
    if (!dailyActivity[day]) dailyActivity[day] = { added: 0, removed: 0 };
    if (event.event_type === "added") dailyActivity[day].added++;
    if (event.event_type === "removed") dailyActivity[day].removed++;
  });

  return {
    totalWishlists,
    uniqueCustomers: uniqueCustomerIds.size,
    uniqueProducts: uniqueProductIds.size,
    conversionRate: totalAdded > 0 ? ((totalPurchased / totalAdded) * 100).toFixed(1) : "0",
    dailyActivity: Object.entries(dailyActivity).map(([date, counts]) => ({
      date,
      ...counts,
    })),
  };
}

export async function getNotificationStats(shopId: string) {
  const { data, count } = await supabaseAdmin
    .from("notification_log")
    .select("*", { count: "exact" })
    .eq("shop_id", shopId)
    .order("sent_at", { ascending: false })
    .limit(50);

  const priceDropCount = data?.filter((n) => n.type === "price_drop").length || 0;
  const backInStockCount = data?.filter((n) => n.type === "back_in_stock").length || 0;

  return {
    stats: {
      totalSent: count || 0,
      priceDropSent: priceDropCount,
      backInStockSent: backInStockCount,
    },
    recent: data || [],
  };
}
