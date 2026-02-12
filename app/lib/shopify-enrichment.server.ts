/**
 * Helpers to enrich raw IDs with product/customer details
 * from the Shopify Admin GraphQL API.
 */

export interface ProductInfo {
  id: string;
  numericId: string;
  title: string;
  handle: string;
  image: string | null;
  url: string;
}

export interface CustomerInfo {
  id: string;
  numericId: string;
  name: string;
  email: string;
  url: string;
}

/**
 * Fetch product details for a list of numeric product IDs.
 * Returns a Map<numericId, ProductInfo>.
 */
export async function enrichProducts(
  admin: any,
  shop: string,
  productIds: (string | number)[],
): Promise<Map<string, ProductInfo>> {
  const map = new Map<string, ProductInfo>();
  const unique = [...new Set(productIds.map(String))];
  if (!unique.length) return map;

  // Shopify nodes query accepts max ~50 IDs at once
  const BATCH = 50;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const gids = batch.map((id) => `"gid://shopify/Product/${id}"`).join(", ");

    try {
      const response = await admin.graphql(
        `query { nodes(ids: [${gids}]) { ... on Product { id title handle featuredImage { url } } } }`,
      );
      const json = await response.json();
      const nodes = json?.data?.nodes || [];

      for (const node of nodes) {
        if (!node?.id) continue;
        const numericId = node.id.replace("gid://shopify/Product/", "");
        map.set(numericId, {
          id: node.id,
          numericId,
          title: node.title || `Product #${numericId}`,
          handle: node.handle || "",
          image: node.featuredImage?.url || null,
          url: `shopify://admin/products/${numericId}`,
        });
      }
    } catch (err) {
      console.error("[enrichProducts] GraphQL error:", err);
    }
  }

  // Fill in missing IDs with fallback
  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, {
        id: `gid://shopify/Product/${id}`,
        numericId: id,
        title: `Product #${id}`,
        handle: "",
        image: null,
        url: `shopify://admin/products/${id}`,
      });
    }
  }

  return map;
}

/**
 * Fetch customer details for a list of numeric customer IDs.
 * Returns a Map<numericId, CustomerInfo>.
 */
export async function enrichCustomers(
  admin: any,
  shop: string,
  customerIds: (string | number)[],
): Promise<Map<string, CustomerInfo>> {
  const map = new Map<string, CustomerInfo>();
  const unique = [...new Set(customerIds.map(String))];
  if (!unique.length) return map;

  const BATCH = 50;
  for (let i = 0; i < unique.length; i += BATCH) {
    const batch = unique.slice(i, i + BATCH);
    const gids = batch.map((id) => `"gid://shopify/Customer/${id}"`).join(", ");

    try {
      const response = await admin.graphql(
        `query { nodes(ids: [${gids}]) { ... on Customer { id firstName lastName email } } }`,
      );
      const json = await response.json();
      const nodes = json?.data?.nodes || [];

      for (const node of nodes) {
        if (!node?.id) continue;
        const numericId = node.id.replace("gid://shopify/Customer/", "");
        const name = [node.firstName, node.lastName].filter(Boolean).join(" ") || `Customer #${numericId}`;
        map.set(numericId, {
          id: node.id,
          numericId,
          name,
          email: node.email || "",
          url: `shopify://admin/customers/${numericId}`,
        });
      }
    } catch (err) {
      console.error("[enrichCustomers] GraphQL error:", err);
    }
  }

  for (const id of unique) {
    if (!map.has(id)) {
      map.set(id, {
        id: `gid://shopify/Customer/${id}`,
        numericId: id,
        name: `Customer #${id}`,
        email: "",
        url: `shopify://admin/customers/${id}`,
      });
    }
  }

  return map;
}
