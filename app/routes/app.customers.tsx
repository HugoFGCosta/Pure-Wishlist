import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import { Page, Card, DataTable, BlockStack, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getTopCustomers } from "../lib/wishlist.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const customers = await getTopCustomers(shop.id, 50);
  return { customers };
};

export default function CustomersPage() {
  const { customers } = useLoaderData<typeof loader>();

  const rows = customers.map(
    (c: { customer_id: number; count: number }, i: number) => [
      i + 1,
      c.customer_id,
      c.count,
    ],
  );

  return (
    <Page title="Customer Activity">
      <Card>
        <BlockStack gap="300">
          <Text as="h2" variant="headingMd">
            Customers Ranked by Wishlist Size
          </Text>
          <DataTable
            columnContentTypes={["numeric", "text", "numeric"]}
            headings={["Rank", "Customer ID", "Items in Wishlist"]}
            rows={rows}
          />
        </BlockStack>
      </Card>
    </Page>
  );
}
