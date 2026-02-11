import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineGrid,
  DataTable,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getDashboardStats } from "../lib/analytics.server";
import { getTopProducts } from "../lib/wishlist.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);

  try {
    const shop = await getShopByDomain(session.shop);
    const [stats, topProducts] = await Promise.all([
      getDashboardStats(shop.id).catch(() => ({
        totalWishlists: 0,
        uniqueCustomers: 0,
        uniqueProducts: 0,
        conversionRate: "0",
        dailyActivity: [],
      })),
      getTopProducts(shop.id, 5).catch(() => []),
    ]);
    return { stats, topProducts };
  } catch (err) {
    console.error("Dashboard loader error:", err);
    return {
      stats: {
        totalWishlists: 0,
        uniqueCustomers: 0,
        uniqueProducts: 0,
        conversionRate: "0",
        dailyActivity: [],
      },
      topProducts: [],
    };
  }
};

export default function DashboardPage() {
  const { stats, topProducts } = useLoaderData<typeof loader>();

  const topProductRows = topProducts.map(
    (p: { product_id: string; count: number }) => [p.product_id, p.count],
  );

  const activityRows = (stats.dailyActivity || []).map(
    (d: { date: string; added: number; removed: number }) => [
      d.date,
      d.added,
      d.removed,
    ],
  );

  return (
    <Page title="Dashboard">
      <BlockStack gap="500">
        <InlineGrid columns={4} gap="400">
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Total Wishlists
              </Text>
              <Text as="p" variant="headingXl">
                {stats.totalWishlists ?? 0}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Unique Customers
              </Text>
              <Text as="p" variant="headingXl">
                {stats.uniqueCustomers ?? 0}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Unique Products
              </Text>
              <Text as="p" variant="headingXl">
                {stats.uniqueProducts ?? 0}
              </Text>
            </BlockStack>
          </Card>
          <Card>
            <BlockStack gap="200">
              <Text as="h3" variant="headingSm">
                Conversion Rate
              </Text>
              <Text as="p" variant="headingXl">
                {stats.conversionRate ?? "0%"}
              </Text>
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Top 5 Most Wishlisted Products
                </Text>
                <DataTable
                  columnContentTypes={["text", "numeric"]}
                  headings={["Product ID", "Wishlist Count"]}
                  rows={topProductRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">
                  Daily Activity (Last 30 Days)
                </Text>
                <DataTable
                  columnContentTypes={["text", "numeric", "numeric"]}
                  headings={["Date", "Added", "Removed"]}
                  rows={activityRows}
                />
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
