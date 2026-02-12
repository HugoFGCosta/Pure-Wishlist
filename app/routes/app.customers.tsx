import type { LoaderFunctionArgs } from "react-router";
import { useLoaderData, Link } from "react-router";
import {
  Page,
  Card,
  IndexTable,
  Text,
  Badge,
  Avatar,
  InlineStack,
  BlockStack,
  EmptyState,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getTopCustomers } from "../lib/wishlist.server";
import { enrichCustomers } from "../lib/shopify-enrichment.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const customers = await getTopCustomers(shop.id, 50);

  const customerIds = customers.map((c: any) => c.customer_id);
  const customerMap = await enrichCustomers(admin, session.shop, customerIds);

  const enriched = customers.map((c: any) => {
    const info = customerMap.get(String(c.customer_id));
    return { ...c, name: info?.name, email: info?.email, url: info?.url };
  });

  return { customers: enriched };
};

export default function CustomersPage() {
  const { customers } = useLoaderData<typeof loader>();

  const rowMarkup = customers.map((c: any, i: number) => (
    <IndexTable.Row id={String(c.customer_id)} key={c.customer_id} position={i}>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued" fontWeight="semibold">
          {i + 1}
        </Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Avatar size="sm" name={c.name || ""} />
          <BlockStack gap="050">
            <Link to={c.url || "#"} target="_top">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {c.name || `Customer #${c.customer_id}`}
              </Text>
            </Link>
            {c.email && (
              <Text as="span" variant="bodySm" tone="subdued">{c.email}</Text>
            )}
          </BlockStack>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone="info">{`${c.count} items`}</Badge>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page title="Customer Activity" subtitle="Customers ranked by wishlist size">
      <Card>
        {customers.length === 0 ? (
          <EmptyState
            heading="No customer data yet"
            image="https://cdn.shopify.com/s/files/1/0262/4071/2726/files/emptystate-files.png"
          >
            <p>Customers will appear here once they start using wishlists.</p>
          </EmptyState>
        ) : (
          <IndexTable
            resourceName={{ singular: "customer", plural: "customers" }}
            itemCount={customers.length}
            headings={[
              { title: "#", alignment: "center" },
              { title: "Customer" },
              { title: "Items", alignment: "end" },
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
