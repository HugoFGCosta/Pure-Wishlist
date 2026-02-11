import { createClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars");
}

export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: { persistSession: false },
  },
);

export async function getShopByDomain(shopDomain: string) {
  const { data, error } = await supabaseAdmin
    .from("shops")
    .select("*")
    .eq("shop_domain", shopDomain)
    .single();

  if (error || !data) {
    // Auto-create shop record if missing (e.g. first load after install)
    const { data: newShop, error: insertError } = await supabaseAdmin
      .from("shops")
      .upsert({ shop_domain: shopDomain }, { onConflict: "shop_domain" })
      .select()
      .single();

    if (insertError || !newShop) {
      throw new Error(`Shop not found and could not create: ${shopDomain} — ${insertError?.message}`);
    }
    return newShop;
  }
  return data;
}
