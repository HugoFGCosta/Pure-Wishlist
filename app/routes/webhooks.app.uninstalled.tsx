import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { supabaseAdmin } from "../db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { shop } = await authenticate.webhook(request);

  // Mark shop as uninstalled
  await supabaseAdmin
    .from("shops")
    .update({ uninstalled_at: new Date().toISOString() })
    .eq("shop_domain", shop);

  return new Response(null, { status: 200 });
};
