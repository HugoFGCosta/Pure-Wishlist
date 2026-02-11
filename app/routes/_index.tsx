import type { LoaderFunctionArgs } from "react-router";
import { redirect } from "react-router";
import { useLoaderData } from "react-router";
import { supabaseAdmin } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);

  // If loaded from Shopify (has shop/host params), redirect to /app
  if (url.searchParams.get("shop") || url.searchParams.get("host")) {
    throw redirect(`/app${url.search}`);
  }

  const checks: Record<string, { ok: boolean; detail: string }> = {};

  // 1. Env vars
  const envVars = [
    "SHOPIFY_API_KEY",
    "SHOPIFY_API_SECRET",
    "SHOPIFY_APP_URL",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "SUPABASE_DB_URL",
    "SCOPES",
  ];
  for (const v of envVars) {
    const val = process.env[v];
    checks[`env:${v}`] = {
      ok: !!val,
      detail: val ? `set (${val.slice(0, 8)}...)` : "MISSING",
    };
  }

  // 2. Supabase connection
  try {
    const { data, error } = await supabaseAdmin.from("shops").select("id").limit(1);
    checks["supabase:shops_table"] = {
      ok: !error,
      detail: error ? `ERROR: ${error.message}` : `OK (${data?.length ?? 0} rows)`,
    };
  } catch (e: any) {
    checks["supabase:shops_table"] = { ok: false, detail: `EXCEPTION: ${e.message}` };
  }

  try {
    const { error } = await supabaseAdmin.from("sessions").select("id").limit(1);
    checks["supabase:sessions_table"] = {
      ok: !error,
      detail: error ? `ERROR: ${error.message}` : "OK",
    };
  } catch (e: any) {
    checks["supabase:sessions_table"] = { ok: false, detail: `EXCEPTION: ${e.message}` };
  }

  try {
    const { error } = await supabaseAdmin.from("wishlists").select("id").limit(1);
    checks["supabase:wishlists_table"] = {
      ok: !error,
      detail: error ? `ERROR: ${error.message}` : "OK",
    };
  } catch (e: any) {
    checks["supabase:wishlists_table"] = { ok: false, detail: `EXCEPTION: ${e.message}` };
  }

  try {
    const { error } = await supabaseAdmin.from("wishlist_events").select("id").limit(1);
    checks["supabase:wishlist_events_table"] = {
      ok: !error,
      detail: error ? `ERROR: ${error.message}` : "OK",
    };
  } catch (e: any) {
    checks["supabase:wishlist_events_table"] = { ok: false, detail: `EXCEPTION: ${e.message}` };
  }

  try {
    const { error } = await supabaseAdmin.from("notification_log").select("id").limit(1);
    checks["supabase:notification_log_table"] = {
      ok: !error,
      detail: error ? `ERROR: ${error.message}` : "OK",
    };
  } catch (e: any) {
    checks["supabase:notification_log_table"] = { ok: false, detail: `EXCEPTION: ${e.message}` };
  }

  try {
    const { error } = await supabaseAdmin.from("product_snapshots").select("id").limit(1);
    checks["supabase:product_snapshots_table"] = {
      ok: !error,
      detail: error ? `ERROR: ${error.message}` : "OK",
    };
  } catch (e: any) {
    checks["supabase:product_snapshots_table"] = { ok: false, detail: `EXCEPTION: ${e.message}` };
  }

  // 3. Session storage (PostgreSQL direct)
  checks["env:SUPABASE_DB_URL_format"] = {
    ok: (process.env.SUPABASE_DB_URL || "").includes("sslmode=require"),
    detail: (process.env.SUPABASE_DB_URL || "").includes("sslmode=require")
      ? "Has sslmode=require"
      : "MISSING ?sslmode=require",
  };

  const allOk = Object.values(checks).every((c) => c.ok);

  return { checks, allOk };
};

export default function DebugPage() {
  const { checks, allOk } = useLoaderData<typeof loader>();

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <title>Pure Wishlist — Debug</title>
        <style
          dangerouslySetInnerHTML={{
            __html: `
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 40px auto; padding: 0 20px; background: #f5f5f5; }
          h1 { margin-bottom: 8px; }
          .status { font-size: 1.2em; padding: 12px; border-radius: 8px; margin-bottom: 24px; }
          .status.ok { background: #d4edda; color: #155724; }
          .status.fail { background: #f8d7da; color: #721c24; }
          table { width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
          th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; font-size: 14px; }
          th { background: #333; color: #fff; }
          .ok-cell { color: #28a745; font-weight: bold; }
          .fail-cell { color: #dc3545; font-weight: bold; }
          .note { margin-top: 24px; color: #666; font-size: 13px; }
        `,
          }}
        />
      </head>
      <body>
        <h1>Pure Wishlist</h1>
        <p>This app must be opened from your Shopify admin panel.</p>

        <div className={`status ${allOk ? "ok" : "fail"}`} style={{ background: allOk ? "#d4edda" : "#f8d7da", color: allOk ? "#155724" : "#721c24", fontSize: "1.2em", padding: 12, borderRadius: 8, marginBottom: 24 }}>
          {allOk ? "All checks passed" : "Some checks failed — see below"}
        </div>

        <table>
          <thead>
            <tr>
              <th>Check</th>
              <th>Status</th>
              <th>Detail</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(checks).map(([name, check]: [string, any]) => (
              <tr key={name}>
                <td>{name}</td>
                <td style={{ color: check.ok ? "#28a745" : "#dc3545", fontWeight: "bold" }}>
                  {check.ok ? "OK" : "FAIL"}
                </td>
                <td>{check.detail}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: 24, color: "#666", fontSize: 13 }}>
          To use the app, go to your Shopify admin &gt; Apps &gt; Pure Wishlist
        </p>
      </body>
    </html>
  );
}
