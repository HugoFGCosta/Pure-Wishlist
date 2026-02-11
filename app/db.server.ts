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

  if (error) throw new Error(`Shop not found: ${shopDomain}`);
  return data;
}
