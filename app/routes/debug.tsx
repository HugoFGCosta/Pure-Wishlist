import type { LoaderFunctionArgs } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const results: Record<string, string> = {};

  // 1. Test pg with SSL (like session storage should connect)
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      host: "aws-1-eu-west-1.pooler.supabase.com",
      port: 6543,
      user: new URL(process.env.SUPABASE_DB_URL || "").username,
      password: decodeURIComponent(new URL(process.env.SUPABASE_DB_URL || "").password),
      database: "postgres",
      ssl: { rejectUnauthorized: false },
    });
    const res = await pool.query("SELECT 1 as ok");
    results["pg:ssl_manual"] = `OK — connected with SSL`;
    await pool.end();
  } catch (e: any) {
    results["pg:ssl_manual"] = `FAIL — ${e.message}`;
  }

  // 2. Test pg WITHOUT SSL (this is what session storage was doing)
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      host: "aws-1-eu-west-1.pooler.supabase.com",
      port: 6543,
      user: new URL(process.env.SUPABASE_DB_URL || "").username,
      password: decodeURIComponent(new URL(process.env.SUPABASE_DB_URL || "").password),
      database: "postgres",
    });
    const res = await pool.query("SELECT 1 as ok");
    results["pg:no_ssl"] = `OK — connected without SSL (unexpected)`;
    await pool.end();
  } catch (e: any) {
    results["pg:no_ssl"] = `FAIL (expected) — ${e.message}`;
  }

  // 3. Test pg with connectionString (parses sslmode)
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    });
    const res = await pool.query("SELECT 1 as ok");
    results["pg:connstring_ssl"] = `OK — connectionString + ssl works`;
    await pool.end();
  } catch (e: any) {
    results["pg:connstring_ssl"] = `FAIL — ${e.message}`;
  }

  // 4. Test pg.defaults.ssl is set (our fix)
  try {
    const pg = await import("pg");
    results["pg:defaults.ssl"] = pg.default.defaults.ssl
      ? `OK — ssl defaults set: ${JSON.stringify(pg.default.defaults.ssl)}`
      : "FAIL — pg.defaults.ssl is not set";
  } catch (e: any) {
    results["pg:defaults.ssl"] = `FAIL — ${e.message}`;
  }

  // 5. Test shopify_sessions table (the table the library creates)
  try {
    const pg = await import("pg");
    const pool = new pg.default.Pool({
      connectionString: process.env.SUPABASE_DB_URL,
      ssl: { rejectUnauthorized: false },
    });
    const res = await pool.query(
      "SELECT tablename FROM pg_catalog.pg_tables WHERE tablename IN ('shopify_sessions', 'sessions')"
    );
    results["pg:session_tables"] = `OK — found: ${res.rows.map((r: any) => r.tablename).join(", ") || "none"}`;
    await pool.end();
  } catch (e: any) {
    results["pg:session_tables"] = `FAIL — ${e.message}`;
  }

  // 6. Test Supabase client
  try {
    const { supabaseAdmin } = await import("../db.server");
    const { data, error } = await supabaseAdmin.from("shops").select("id").limit(1);
    results["supabase:shops"] = error ? `FAIL — ${error.message}` : `OK — ${data?.length} rows`;
  } catch (e: any) {
    results["supabase:shops"] = `FAIL — ${e.message}`;
  }

  // 7. Test shopify module import (triggers session storage init)
  try {
    const { authenticate } = await import("../shopify.server");
    results["shopify:import"] = authenticate ? "OK — authenticate loaded" : "FAIL — null";
  } catch (e: any) {
    results["shopify:import"] = `FAIL — ${e.message}\n${e.stack?.slice(0, 300)}`;
  }

  // 8. Test authenticate.admin (will redirect without valid session)
  try {
    const { authenticate } = await import("../shopify.server");
    await authenticate.admin(request);
    results["shopify:auth"] = "OK — authenticated";
  } catch (e: any) {
    if (e instanceof Response) {
      results["shopify:auth"] = `REDIRECT ${e.status} → ${e.headers.get("location")?.slice(0, 100) || "no location"}`;
    } else {
      results["shopify:auth"] = `FAIL — ${e.message}\n${e.stack?.slice(0, 300)}`;
    }
  }

  // 9. Env check
  results["env:SHOPIFY_APP_URL"] = process.env.SHOPIFY_APP_URL || "MISSING";
  results["env:SUPABASE_DB_URL"] = (process.env.SUPABASE_DB_URL || "").replace(/:[^@]+@/, ":***@");

  const html = `<!DOCTYPE html><html><head><title>Debug</title>
    <style>body{font-family:monospace;max-width:900px;margin:40px auto;padding:0 20px}
    table{width:100%;border-collapse:collapse}td,th{border:1px solid #ddd;padding:8px;text-align:left;font-size:13px;white-space:pre-wrap;word-break:break-all}
    th{background:#333;color:#fff}.ok{color:green}.fail{color:red}</style></head>
    <body><h1>Pure Wishlist Debug</h1><table><tr><th>Check</th><th>Result</th></tr>
    ${Object.entries(results)
      .map(
        ([k, v]) =>
          `<tr><td>${k}</td><td class="${v.startsWith("OK") || v.startsWith("REDIRECT") ? "ok" : "fail"}">${v.replace(/</g, "&lt;")}</td></tr>`,
      )
      .join("")}
    </table></body></html>`;

  return new Response(html, {
    headers: { "Content-Type": "text/html" },
  });
};
