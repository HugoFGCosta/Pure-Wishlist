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
  console.log(`[app.tsx] loader: ${url.pathname}${url.search}`);
  console.log(`[app.tsx] env: API_KEY=${!!process.env.SHOPIFY_API_KEY} SECRET=${!!process.env.SHOPIFY_API_SECRET} URL=${process.env.SHOPIFY_APP_URL}`);

  try {
    const { session } = await authenticate.admin(request);
    console.log(`[app.tsx] auth OK: shop=${session.shop} online=${session.isOnline}`);
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      debugError: null,
    };
  } catch (err) {
    // Redirects (3xx) are part of normal auth flow — re-throw them
    if (err instanceof Response) {
      console.log(`[app.tsx] auth redirect: ${err.status} → ${err.headers.get("location")?.slice(0, 150)}`);
      throw err;
    }

    // Real errors — log and return as data so we can display them
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error(`[app.tsx] auth FAILED: ${msg}`);
    console.error(`[app.tsx] stack: ${stack}`);

    // Return error as data instead of throwing, so we can render a useful debug page
    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      debugError: { message: msg, stack: stack?.slice(0, 1000) },
    };
  }
};

export default function App() {
  const { apiKey, debugError } = useLoaderData<typeof loader>();

  // If auth failed, show diagnostic info instead of crashing
  if (debugError) {
    return (
      <div style={{ padding: 40, fontFamily: "monospace", maxWidth: 800 }}>
        <h1 style={{ color: "red" }}>Auth Error</h1>
        <p><strong>{debugError.message}</strong></p>
        <pre style={{ background: "#f5f5f5", padding: 16, overflow: "auto", fontSize: 11, whiteSpace: "pre-wrap" }}>
          {debugError.stack}
        </pre>
        <hr />
        <p>Env check:</p>
        <ul style={{ fontSize: 12 }}>
          <li>SHOPIFY_API_KEY: {process.env.SHOPIFY_API_KEY ? "set" : "MISSING"}</li>
          <li>SHOPIFY_APP_URL: {process.env.SHOPIFY_APP_URL || "MISSING"}</li>
        </ul>
        <p style={{ color: "#666", fontSize: 13, marginTop: 16 }}>
          Try: uninstall and reinstall the app from your Shopify admin.
        </p>
      </div>
    );
  }

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

  let errorMessage = "Unknown error";
  let errorDetail = "";

  if (error instanceof Error) {
    errorMessage = error.message;
    errorDetail = error.stack || "";
  } else if (error instanceof Response) {
    errorMessage = `Response ${error.status} ${error.statusText}`;
    errorDetail = `Headers: ${JSON.stringify(Object.fromEntries(error.headers.entries()), null, 2)}`;
  } else if (typeof error === "object" && error !== null) {
    try {
      errorDetail = JSON.stringify(error, null, 2);
      errorMessage = (error as any).statusText || (error as any).message || "Object error";
    } catch {
      errorMessage = "Non-serializable error object";
      errorDetail = String(error);
    }
  } else {
    errorMessage = String(error);
  }

  return (
    <div style={{ padding: 40, fontFamily: "monospace", maxWidth: 800 }}>
      <h1 style={{ color: "red" }}>App Error (ErrorBoundary)</h1>
      <p><strong>Type: {error?.constructor?.name || typeof error}</strong></p>
      <p>{errorMessage}</p>
      <pre style={{ background: "#f5f5f5", padding: 16, overflow: "auto", fontSize: 11, whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
        {errorDetail}
      </pre>
    </div>
  );
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
