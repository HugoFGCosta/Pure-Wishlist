import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Page, Card, DataTable, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getTopProducts } from "../lib/wishlist.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const products = await getTopProducts(shop.id, 50);
  return { products };
};

export default function ProductsPage() {
  const { products } = useLoaderData<typeof loader>();

  const rows = products.map(
    (p: { product_id: string; count: number }, i: number) => [
      i + 1,
      p.product_id,
      p.count,
    ],
  );

  return (
    <Page title="Product Rankings">
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Products Ranked by Wishlist Count
          </Text>
          <DataTable
            columnContentTypes={["numeric", "text", "numeric"]}
            headings={["Rank", "Product ID", "Wishlist Count"]}
            rows={rows}
          />
        </BlockStack>
      </Card>
    </Page>
  );
}
