import type { HeadersFunction, LoaderFunctionArgs } from "react-router";
import { Link, Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }: LoaderFunctionArgs) => {
  try {
    await authenticate.admin(request);
  } catch (err) {
    // Re-throw redirects (auth bounces) — they're not real errors
    if (err instanceof Response) throw err;
    console.error("authenticate.admin failed:", err);
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
  console.error("App ErrorBoundary:", error);

  // Show debug info in dev/debug mode
  const errorMessage =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error !== null && "statusText" in error
        ? String((error as any).statusText)
        : "Unknown error";

  const errorStack =
    error instanceof Error ? error.stack : JSON.stringify(error, null, 2);

  try {
    return boundary.error(error);
  } catch {
    // Fallback if boundary.error itself fails
    return (
      <div style={{ padding: 40, fontFamily: "monospace" }}>
        <h1>App Error</h1>
        <p style={{ color: "red" }}>{errorMessage}</p>
        <pre style={{ background: "#f5f5f5", padding: 16, overflow: "auto", fontSize: 12 }}>
          {errorStack}
        </pre>
      </div>
    );
  }
}

export const headers: HeadersFunction = (headersArgs) => {
  return boundary.headers(headersArgs);
};
