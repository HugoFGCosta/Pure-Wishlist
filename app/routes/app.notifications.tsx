import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";
import {
  Page,
  Card,
  DataTable,
  Layout,
  Text,
  BlockStack,
  Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getNotificationStats } from "../lib/analytics.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const data = await getNotificationStats(shop.id);
  return { stats: data.stats, recent: data.recent };
};

export default function NotificationsPage() {
  const { stats, recent } = useLoaderData<typeof loader>();

  const recentRows = (recent || []).map(
    (n: { type: string; customer_id: string; product_id: string; sent_at: string }) => [
      n.type,
      n.customer_id,
      n.product_id,
      new Date(n.sent_at).toLocaleString(),
    ],
  );

  return (
    <Page title="Notifications">
      <BlockStack gap="500">
        <Layout>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Total Sent
                </Text>
                <Text as="p" variant="headingXl">
                  {stats.totalSent ?? 0}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Price Drop Notifications
                </Text>
                <Text as="p" variant="headingXl">
                  {stats.priceDropSent ?? 0}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">
                  Back in Stock Notifications
                </Text>
                <Text as="p" variant="headingXl">
                  {stats.backInStockSent ?? 0}
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>

        <Card>
          <BlockStack gap="300">
            <Text as="h2" variant="headingMd">
              Recent Notifications
            </Text>
            {recentRows.length === 0 ? (
              <Banner>No notifications sent yet.</Banner>
            ) : (
              <DataTable
                columnContentTypes={["text", "text", "text", "text"]}
                headings={["Type", "Customer ID", "Product ID", "Sent At"]}
                rows={recentRows}
              />
            )}
          </BlockStack>
        </Card>
      </BlockStack>
    </Page>
  );
}
