import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  Page,
  Layout,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  DataTable,
  Thumbnail,
  Badge,
  Box,
  Icon,
  ProgressBar,
  EmptyState,
  Divider,
} from "@shopify/polaris";
import {
  HeartIcon,
  PersonIcon,
  ProductIcon,
  ChartVerticalFilledIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getDashboardStats } from "../lib/analytics.server";
import { getTopProducts } from "../lib/wishlist.server";
import { enrichProducts } from "../lib/shopify-enrichment.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  let session: any;
  let admin: any;
  try {
    const auth = await authenticate.admin(request);
    session = auth.session;
    admin = auth.admin;
  } catch (err) {
    if (err instanceof Response) throw err;
    return {
      stats: { totalWishlists: 0, uniqueCustomers: 0, uniqueProducts: 0, conversionRate: "0", dailyActivity: [] },
      topProducts: [],
    };
  }

  try {
    const shop = await getShopByDomain(session.shop);
    const [stats, topProducts] = await Promise.all([
      getDashboardStats(shop.id).catch(() => ({
        totalWishlists: 0, uniqueCustomers: 0, uniqueProducts: 0, conversionRate: "0", dailyActivity: [],
      })),
      getTopProducts(shop.id, 5).catch(() => []),
    ]);

    const productIds = topProducts.map((p: any) => p.product_id);
    const productMap = await enrichProducts(admin, session.shop, productIds);

    const enrichedProducts = topProducts.map((p: any) => {
      const info = productMap.get(String(p.product_id));
      return { ...p, title: info?.title, image: info?.image, url: info?.url };
    });

    return { stats, topProducts: enrichedProducts };
  } catch (err) {
    console.error("Dashboard loader error:", err);
    return {
      stats: { totalWishlists: 0, uniqueCustomers: 0, uniqueProducts: 0, conversionRate: "0", dailyActivity: [] },
      topProducts: [],
    };
  }
};

const STAT_CARDS = [
  { key: "totalWishlists", label: "Total Wishlists", icon: HeartIcon, tone: "magic" as const },
  { key: "uniqueCustomers", label: "Unique Customers", icon: PersonIcon, tone: "info" as const },
  { key: "uniqueProducts", label: "Unique Products", icon: ProductIcon, tone: "success" as const },
];

export default function DashboardPage() {
  const { stats, topProducts } = useLoaderData<typeof loader>();

  const activityRows = (stats.dailyActivity || []).slice(0, 14).map(
    (d: { date: string; added: number; removed: number }) => [d.date, d.added, d.removed],
  );

  const conversionNum = parseFloat(stats.conversionRate ?? "0");

  return (
    <Page title="Dashboard">
      <BlockStack gap="500">
        {/* Stat cards */}
        <InlineGrid columns={4} gap="400">
          {STAT_CARDS.map(({ key, label, icon, tone }) => (
            <Card key={key}>
              <BlockStack gap="200">
                <InlineStack gap="200" blockAlign="center">
                  <Box
                    background={`bg-fill-${tone}` as any}
                    borderRadius="200"
                    padding="100"
                  >
                    <Icon source={icon} tone={tone} />
                  </Box>
                  <Text as="p" variant="bodySm" tone="subdued">{label}</Text>
                </InlineStack>
                <Text as="p" variant="headingXl">
                  {(stats as any)[key] ?? 0}
                </Text>
              </BlockStack>
            </Card>
          ))}
          <Card>
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Box
                  background="bg-fill-warning"
                  borderRadius="200"
                  padding="100"
                >
                  <Icon source={ChartVerticalFilledIcon} tone="warning" />
                </Box>
                <Text as="p" variant="bodySm" tone="subdued">Conversion Rate</Text>
              </InlineStack>
              <Text as="p" variant="headingXl">{`${stats.conversionRate ?? 0}%`}</Text>
              <ProgressBar progress={Math.min(conversionNum, 100)} tone="primary" size="small" />
            </BlockStack>
          </Card>
        </InlineGrid>

        <Layout>
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <Text as="h2" variant="headingMd">Top Wishlisted Products</Text>
                  {topProducts.length > 0 && (
                    <Link to="/app/products">
                      <Text as="span" variant="bodySm" tone="magic-subdued">View all</Text>
                    </Link>
                  )}
                </InlineStack>
                <Divider />
                {topProducts.length === 0 ? (
                  <EmptyState
                    heading="No wishlist data yet"
                    image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
                  >
                    <p>Products will appear here once customers start adding items to their wishlists.</p>
                  </EmptyState>
                ) : (
                  <BlockStack gap="0">
                    {topProducts.map((p: any, i: number) => (
                      <div
                        key={p.product_id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          padding: "10px 0",
                          borderBottom: i < topProducts.length - 1 ? "1px solid var(--p-color-border-secondary)" : "none",
                        }}
                      >
                        <Box
                          background="bg-fill-secondary"
                          borderRadius="200"
                          minWidth="28px"
                          padding="050"
                        >
                          <Text as="span" variant="bodySm" alignment="center" fontWeight="semibold">
                            {i + 1}
                          </Text>
                        </Box>
                        <Thumbnail
                          source={p.image || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
                          alt={p.title || ""}
                          size="small"
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <a href={p.url || "#"} target="_top" style={{ textDecoration: "none", color: "inherit" }}>
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {p.title || `Product #${p.product_id}`}
                            </Text>
                          </a>
                        </div>
                        <Badge tone="info">{`${p.count} saves`}</Badge>
                      </div>
                    ))}
                  </BlockStack>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Recent Activity</Text>
                <Divider />
                {activityRows.length === 0 ? (
                  <Box padding="400">
                    <Text as="p" tone="subdued" alignment="center">No activity yet.</Text>
                  </Box>
                ) : (
                  <DataTable
                    columnContentTypes={["text", "numeric", "numeric"]}
                    headings={["Date", "Added", "Removed"]}
                    rows={activityRows}
                  />
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </BlockStack>
    </Page>
  );
}
