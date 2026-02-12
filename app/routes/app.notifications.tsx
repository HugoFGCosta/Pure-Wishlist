import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  Page,
  Card,
  Text,
  BlockStack,
  InlineStack,
  InlineGrid,
  Banner,
  Badge,
  Thumbnail,
  Box,
  Icon,
  EmptyState,
  Divider,
  IndexTable,
} from "@shopify/polaris";
import {
  EmailIcon,
  NotificationIcon,
  ProductIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getNotificationStats } from "../lib/analytics.server";
import { enrichProducts, enrichCustomers } from "../lib/shopify-enrichment.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const data = await getNotificationStats(shop.id);

  const productIds = data.recent.map((n: any) => n.product_id);
  const customerIds = data.recent.map((n: any) => n.customer_id);
  const [productMap, customerMap] = await Promise.all([
    enrichProducts(admin, session.shop, productIds),
    enrichCustomers(admin, session.shop, customerIds),
  ]);

  const enriched = data.recent.map((n: any) => {
    const product = productMap.get(String(n.product_id));
    const customer = customerMap.get(String(n.customer_id));
    return {
      ...n,
      product_title: product?.title,
      product_image: product?.image,
      product_url: product?.url,
      customer_name: customer?.name,
      customer_email: customer?.email,
      customer_url: customer?.url,
    };
  });

  return { stats: data.stats, recent: enriched };
};

const STAT_CARDS = [
  { key: "totalSent", label: "Total Sent", icon: EmailIcon, tone: "info" as const },
  { key: "priceDropSent", label: "Price Drop", icon: NotificationIcon, tone: "warning" as const },
  { key: "backInStockSent", label: "Back in Stock", icon: ProductIcon, tone: "success" as const },
];

function typeBadge(type: string) {
  if (type === "price_drop") return <Badge tone="warning">Price Drop</Badge>;
  if (type === "back_in_stock") return <Badge tone="success">Back in Stock</Badge>;
  return <Badge>{type}</Badge>;
}

export default function NotificationsPage() {
  const { stats, recent } = useLoaderData<typeof loader>();

  const rowMarkup = recent.map((n: any, i: number) => (
    <IndexTable.Row id={n.id || String(i)} key={n.id || i} position={i}>
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Thumbnail
            source={n.product_image || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
            alt={n.product_title || ""}
            size="small"
          />
          <Link to={n.product_url || "#"} target="_top">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {n.product_title || `Product #${n.product_id}`}
            </Text>
          </Link>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <BlockStack gap="050">
          <Link to={n.customer_url || "#"} target="_top">
            <Text as="span" variant="bodyMd">
              {n.customer_name || `Customer #${n.customer_id}`}
            </Text>
          </Link>
          {n.customer_email && (
            <Text as="span" variant="bodySm" tone="subdued">{n.customer_email}</Text>
          )}
        </BlockStack>
      </IndexTable.Cell>
      <IndexTable.Cell>{typeBadge(n.type)}</IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {new Date(n.sent_at).toLocaleDateString()}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Notifications" subtitle="Email alerts sent to customers">
      <BlockStack gap="500">
        <InlineGrid columns={3} gap="400">
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
                <Text as="p" variant="headingXl">{(stats as any)[key] ?? 0}</Text>
              </BlockStack>
            </Card>
          ))}
        </InlineGrid>

        <Card>
          {recent.length === 0 ? (
            <EmptyState
              heading="No notifications sent yet"
              image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
            >
              <p>Notifications will appear here once price drop or back-in-stock emails are sent.</p>
            </EmptyState>
          ) : (
            <IndexTable
              resourceName={{ singular: "notification", plural: "notifications" }}
              itemCount={recent.length}
              headings={[
                { title: "Product" },
                { title: "Customer" },
                { title: "Type" },
                { title: "Sent" },
              ]}
              selectable={false}
            >
              {rowMarkup}
            </IndexTable>
          )}
        </Card>
      </BlockStack>
    </Page>
  );
}
