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
  const { session, admin } = await authenticate.public.appProxy(request);
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
    if (!items.length) return Response.json({ products: [] });

    // Enrich with Shopify product data
    const productIds = [...new Set(items.map((i) => i.product_id))];
    const gids = productIds.map((id) => `"gid://shopify/Product/${id}"`).join(", ");

    let productMap = new Map<number, any>();
    try {
      if (!admin) throw new Error("No admin API access");
      const response = await admin.graphql(
        `query {
          nodes(ids: [${gids}]) {
            ... on Product {
              id
              title
              handle
              featuredImage { url }
              priceRangeV2: priceRange { minVariantPrice { amount currencyCode } }
              variants(first: 1) { edges { node { id } } }
            }
          }
        }`,
      );
      const json = await response.json();
      for (const node of json?.data?.nodes || []) {
        if (!node?.id) continue;
        const numId = Number(node.id.replace("gid://shopify/Product/", ""));
        const variantGid = node.variants?.edges?.[0]?.node?.id || "";
        const variantId = variantGid.replace("gid://shopify/ProductVariant/", "");
        const price = node.priceRangeV2?.minVariantPrice;
        productMap.set(numId, {
          title: node.title,
          handle: node.handle,
          image: node.featuredImage?.url || "",
          url: `/products/${node.handle}`,
          price: price ? `${price.amount} ${price.currencyCode}` : "",
          variant_id: variantId ? Number(variantId) : null,
        });
      }
    } catch (err) {
      console.error("[proxy] Failed to enrich products:", err);
    }

    const enriched = productIds.map((pid) => {
      const info = productMap.get(pid) || {};
      return {
        id: pid,
        title: info.title || `Product #${pid}`,
        image: info.image || "",
        url: info.url || "#",
        price: info.price || "",
        variant_id: info.variant_id || null,
      };
    });

    return Response.json({ products: enriched });
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
