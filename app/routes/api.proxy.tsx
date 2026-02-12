import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import {
  toggleWishlistItem,
  checkWishlistItems,
  getCustomerWishlist,
} from "../lib/wishlist.server";

// App Proxy requests come as GET/POST with logged_in_customer_id
function getCustomerId(url: URL): number | null {
  const cid = url.searchParams.get("logged_in_customer_id");
  return cid ? Number(cid) : null;
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (!session) {
    return Response.json({ error: "No session" }, { status: 401 });
  }

  // Settings must be accessible without login (for heart color on overlays)
  if (action === "settings") {
    const shop = await getShopByDomain(session.shop);
    return Response.json({ settings: shop.settings });
  }

  const customerId = getCustomerId(url);

  if (!customerId) {
    return Response.json({ error: "Not logged in" }, { status: 401 });
  }

  const shop = await getShopByDomain(session.shop);

  if (action === "check") {
    const productsParam = url.searchParams.get("products") || "";
    const productIds = productsParam.split(",").map(Number).filter(Boolean);
    if (!productIds.length) {
      return Response.json({ error: "No products specified" }, { status: 400 });
    }
    const result = await checkWishlistItems(shop.id, customerId, productIds);
    const wishlisted = Object.entries(result)
      .filter(([, v]) => v)
      .map(([k]) => Number(k));
    return Response.json({ wishlisted });
  }

  if (action === "list") {
    const items = await getCustomerWishlist(shop.id, customerId);
    return Response.json({ products: items });
  }

  return Response.json({ error: "Invalid action" }, { status: 400 });
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.public.appProxy(request);
  const url = new URL(request.url);
  const customerId = getCustomerId(url);

  if (!customerId) {
    return Response.json({ error: "Not logged in" }, { status: 401 });
  }

  if (!session) {
    return Response.json({ error: "No session" }, { status: 401 });
  }

  const shop = await getShopByDomain(session.shop);

  if (request.method === "POST") {
    const body = await request.json();
    const productId = Number(body.productId);

    if (!productId) {
      return Response.json({ error: "Missing productId" }, { status: 400 });
    }

    const result = await toggleWishlistItem(shop.id, customerId, productId);
    return Response.json({ wishlisted: result.added });
  }

  return Response.json({ error: "Method not allowed" }, { status: 405 });
};
