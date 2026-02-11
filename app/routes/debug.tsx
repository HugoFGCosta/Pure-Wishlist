import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const results: Record<string, string> = {};

  // 1. Env vars
  results["env:SHOPIFY_API_KEY"] = process.env.SHOPIFY_API_KEY ? `set (${process.env.SHOPIFY_API_KEY.slice(0, 8)}...)` : "MISSING";
  results["env:SHOPIFY_API_SECRET"] = process.env.SHOPIFY_API_SECRET ? `set (${process.env.SHOPIFY_API_SECRET.slice(0, 8)}...)` : "MISSING";
  results["env:SHOPIFY_APP_URL"] = process.env.SHOPIFY_APP_URL || "MISSING";
  results["env:SUPABASE_URL"] = process.env.SUPABASE_URL ? `set (${process.env.SUPABASE_URL.slice(0, 30)}...)` : "MISSING";
  results["env:SUPABASE_SERVICE_ROLE_KEY"] = process.env.SUPABASE_SERVICE_ROLE_KEY ? `set (${process.env.SUPABASE_SERVICE_ROLE_KEY.slice(0, 10)}...)` : "MISSING";
  results["env:SUPABASE_DB_URL"] = process.env.SUPABASE_DB_URL
    ? `set (${(process.env.SUPABASE_DB_URL || "").replace(/:[^@]+@/, ":***@").slice(0, 60)}...)`
    : "MISSING";
  results["env:SCOPES"] = process.env.SCOPES || "MISSING";

  // 2. Supabase client - basic connectivity
  try {
    const { supabaseAdmin } = await import("../db.server");
    const { data, error } = await supabaseAdmin.from("shops").select("id").limit(1);
    results["supabase:client"] = error ? `FAIL — ${error.message}` : `OK — ${data?.length} shops`;
  } catch (e: any) {
    results["supabase:client"] = `FAIL — ${e.message}`;
  }

  // 3. shopify_sessions table exists?
  try {
    const { supabaseAdmin } = await import("../db.server");
    const { data, error } = await supabaseAdmin.from("shopify_sessions").select("id").limit(0);
    results["supabase:shopify_sessions_table"] = error
      ? `FAIL — ${error.code}: ${error.message}`
      : "OK — table exists";
  } catch (e: any) {
    results["supabase:shopify_sessions_table"] = `FAIL — ${e.message}`;
  }

  // 4. Test session storage (our custom class)
  try {
    const { SupabaseSessionStorage } = await import("../supabase-session-storage.server");
    const storage = new SupabaseSessionStorage();
    // Try loading a non-existent session
    const session = await storage.loadSession("test-debug-nonexistent");
    results["session_storage:loadSession"] = `OK — returned ${session === undefined ? "undefined (correct)" : "something unexpected"}`;
  } catch (e: any) {
    results["session_storage:loadSession"] = `FAIL — ${e.message}\n${e.stack?.slice(0, 200)}`;
  }

  // 5. Test session storage findSessionsByShop
  try {
    const { SupabaseSessionStorage } = await import("../supabase-session-storage.server");
    const storage = new SupabaseSessionStorage();
    const sessions = await storage.findSessionsByShop("test-debug.myshopify.com");
    results["session_storage:findByShop"] = `OK — returned ${sessions.length} sessions`;
  } catch (e: any) {
    results["session_storage:findByShop"] = `FAIL — ${e.message}\n${e.stack?.slice(0, 200)}`;
  }

  // 6. Test shopify module import
  try {
    const mod = await import("../shopify.server");
    results["shopify:import"] = mod.authenticate ? "OK — module loaded" : "FAIL — authenticate is null";
  } catch (e: any) {
    results["shopify:import"] = `FAIL — ${e.message}\n${e.stack?.slice(0, 300)}`;
  }

  // 7. Test authenticate.admin (expect redirect since no valid session)
  try {
    const { authenticate } = await import("../shopify.server");
    await authenticate.admin(request);
    results["shopify:auth"] = "OK — authenticated (unexpected without shop param)";
  } catch (e: any) {
    if (e instanceof Response) {
      results["shopify:auth"] = `REDIRECT ${e.status} → ${e.headers.get("location")?.slice(0, 120) || "no location"}`;
    } else {
      results["shopify:auth"] = `FAIL — ${e.message}\n${e.stack?.slice(0, 300)}`;
    }
  }

  // 8. Request info
  const reqUrl = new URL(request.url);
  results["request:url"] = reqUrl.toString();
  results["request:shop_param"] = reqUrl.searchParams.get("shop") || "none";
  results["request:host_param"] = reqUrl.searchParams.get("host") || "none";

  const html = `<!DOCTYPE html><html><head><title>Debug</title>
    <style>body{font-family:monospace;max-width:900px;margin:40px auto;padding:0 20px}
    table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px;white-space:pre-wrap;word-break:break-all}
    th{background:#333;color:#fff}.ok{color:green}.fail{color:red}</style></head>
    <body><h1>Pure Wishlist Debug</h1>
    <p>Timestamp: ${new Date().toISOString()}</p>
    <table><tr><th>Check</th><th>Result</th></tr>
    ${Object.entries(results)
      .map(
        ([k, v]) =>
          `<tr><td>${k}</td><td class="${v.startsWith("OK") || v.startsWith("REDIRECT") || v.startsWith("set") ? "ok" : "fail"}">${v.replace(/</g, "&lt;")}</td></tr>`,
      )
      .join("")}
    </table></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
};
