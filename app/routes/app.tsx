import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const url = new URL(request.url);
  console.log(`[app.tsx] loader called: ${url.pathname}${url.search}`);
  console.log(`[app.tsx] SHOPIFY_API_KEY set: ${!!process.env.SHOPIFY_API_KEY}`);
  console.log(`[app.tsx] SHOPIFY_API_SECRET set: ${!!process.env.SHOPIFY_API_SECRET}`);
  console.log(`[app.tsx] SHOPIFY_APP_URL: ${process.env.SHOPIFY_APP_URL}`);

  try {
    console.log("[app.tsx] calling authenticate.admin...");
    await authenticate.admin(request);
    console.log("[app.tsx] authenticate.admin succeeded");
  } catch (err) {
    if (err instanceof Response) {
      console.log(`[app.tsx] authenticate.admin threw Response: ${err.status} → ${err.headers.get("location")?.slice(0, 120)}`);
      throw err;
    }
    console.error("[app.tsx] authenticate.admin error:", err instanceof Error ? err.message : String(err));
    console.error("[app.tsx] stack:", err instanceof Error ? err.stack : "n/a");
    throw err;
  }
  return { apiKey: process.env.SHOPIFY_API_KEY || "" };
};

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider apiKey={apiKey}>
      <NavMenu>
        <Link to="/app" rel="home">Home</Link>
        <Link to="/app/wishlists">Wishlists</Link>
        <Link to="/app/products">Products</Link>
        <Link to="/app/customers">Customers</Link>
        <Link to="/app/notifications">Notifications</Link>
        <Link to="/app/settings">Settings</Link>
      </NavMenu>
      <Outlet />
    </AppProvider>
  );
}

export function ErrorBoundary() {
  const error = useRouteError();

  // Always show full error details so we can debug on Vercel
  let errorMessage = "Unknown error";
  let errorDetail = "";

  if (error instanceof Error) {
    errorMessage = error.message;
    errorDetail = error.stack || "";
  } else if (error instanceof Response) {
    errorMessage = `Response ${error.status} ${error.statusText}`;
    errorDetail = `URL: ${error.url}\nHeaders: ${JSON.stringify(Object.fromEntries(error.headers.entries()), null, 2)}`;
  } else if (typeof error === "object" && error !== null) {
    errorMessage = (error as any).statusText || (error as any).message || "Object error";
    errorDetail = JSON.stringify(error, null, 2);
  } else {
    errorMessage = String(error);
  }

  return (
    <div style={{ padding: 40, fontFamily: "monospace", maxWidth: 800 }}>
      <h1 style={{ color: "red" }}>App Error</h1>
      <p><strong>{errorMessage}</strong></p>
      <pre style={{ background: "#f5f5f5", padding: 16, overflow: "auto", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {errorDetail}
      </pre>
      <p style={{ marginTop: 24, color: "#666", fontSize: 13 }}>
        Visit <a href="/debug">/debug</a> for system diagnostics.
      </p>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
