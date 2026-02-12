import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Page,
  Card,
  IndexTable,
  Thumbnail,
  Text,
  Badge,
  InlineStack,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getTopProducts } from "../lib/wishlist.server";
import { enrichProducts } from "../lib/shopify-enrichment.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const products = await getTopProducts(shop.id, 50);

  const productIds = products.map((p: any) => p.product_id);
  const productMap = await enrichProducts(admin, session.shop, productIds);

  const enriched = products.map((p: any) => {
    const info = productMap.get(String(p.product_id));
    return { ...p, title: info?.title, image: info?.image, url: info?.url };
  });

  return { products: enriched };
};

export default function ProductsPage() {
  const { products } = useLoaderData<typeof loader>();

  const rowMarkup = products.map((p: any, i: number) => (
    <IndexTable.Row id={String(p.product_id)} key={p.product_id} position={i}>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued" fontWeight="semibold">
          {i + 1}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Thumbnail
            source={p.image || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
            alt={p.title || ""}
            size="small"
          />
          <a href={p.url || "#"} target="_top" style={{ textDecoration: "none", color: "inherit" }}>
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {p.title || `Product #${p.product_id}`}
            </Text>
          </a>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="info">{`${p.count}`}</Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Product Rankings" subtitle="Products ranked by wishlist saves">
      <Card>
        {products.length === 0 ? (
          <EmptyState
            heading="No wishlist data yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Products will appear here once customers start adding items to their wishlists.</p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "product", plural: "products" }}
            itemCount={products.length}
            headings={[
              { title: "#", alignment: "center" },
              { title: "Product" },
              { title: "Saves", alignment: "end" },
            ]}
            selectable={false}
          >
            {rowMarkup}
          </IndexTable>
        )}
      </Card>
    </Page>
  );
}
