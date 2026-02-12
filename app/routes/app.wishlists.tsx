import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useSubmit, useNavigation, Link } from "react-router";
import { useState, useCallback } from "react";
import {
  Page,
  IndexTable,
  Card,
  TextField,
  Button,
  Pagination,
  BlockStack,
  InlineStack,
  Thumbnail,
  Text,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getShopWishlists } from "../lib/wishlist.server";
import { enrichProducts, enrichCustomers } from "../lib/shopify-enrichment.server";

const LIMIT = 25;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session, admin } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const search = url.searchParams.get("search") || "";

  const { wishlists, total } = await getShopWishlists(shop.id, { page, limit: LIMIT, search });

  // Enrich with Shopify data
  const productIds = wishlists.map((w: any) => w.product_id);
  const customerIds = wishlists.map((w: any) => w.customer_id);
  const [productMap, customerMap] = await Promise.all([
    enrichProducts(admin, session.shop, productIds),
    enrichCustomers(admin, session.shop, customerIds),
  ]);

  const enriched = wishlists.map((w: any) => {
    const product = productMap.get(String(w.product_id));
    const customer = customerMap.get(String(w.customer_id));
    return {
      ...w,
      product_title: product?.title,
      product_image: product?.image,
      product_url: product?.url,
      customer_name: customer?.name,
      customer_email: customer?.email,
      customer_url: customer?.url,
    };
  });

  return { wishlists: enriched, total, page, search };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const { wishlists } = await getShopWishlists(shop.id, { page: 1, limit: 100000, search: "" });

  const csvHeader = "Customer ID,Product ID,Date Added\n";
  const csvRows = wishlists
    .map((w: any) => `${w.customer_id},${w.product_id},${w.created_at}`)
    .join("\n");

  return new Response(csvHeader + csvRows, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="wishlists.csv"',
    },
  });
};

export default function WishlistsPage() {
  const { wishlists, total, page, search } = useLoaderData<typeof loader>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(search);
  const submit = useSubmit();
  const navigation = useNavigation();
  const isLoading = navigation.state === "loading";
  const totalPages = Math.ceil(total / LIMIT);

  const handleSearch = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.set("search", searchValue);
    params.set("page", "1");
    setSearchParams(params);
  }, [searchValue, searchParams, setSearchParams]);

  const handlePageChange = useCallback(
    (direction: "next" | "previous") => {
      const params = new URLSearchParams(searchParams);
      params.set("page", String(direction === "next" ? page + 1 : page - 1));
      setSearchParams(params);
    },
    [page, searchParams, setSearchParams],
  );

  const handleExport = useCallback(() => {
    submit(null, { method: "post" });
  }, [submit]);

  const rowMarkup = wishlists.map((item: any, index: number) => (
    <IndexTable.Row id={item.id} key={item.id} position={index}>
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center" wrap={false}>
          <Thumbnail
            source={item.product_image || "https://cdn.shopify.com/s/files/1/0533/2089/files/placeholder-images-image_large.png"}
            alt={item.product_title || ""}
            size="small"
          />
          <BlockStack gap="050">
            <Link to={item.product_url || "#"} target="_top">
              <Text as="span" variant="bodyMd" fontWeight="semibold">
                {item.product_title || `#${item.product_id}`}
              </Text>
            </Link>
          </BlockStack>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Link to={item.customer_url || "#"} target="_top">
          <BlockStack gap="050">
            <Text as="span" variant="bodyMd" fontWeight="semibold">
              {item.customer_name || `#${item.customer_id}`}
            </Text>
            {item.customer_email && (
              <Text as="span" variant="bodySm" tone="subdued">{item.customer_email}</Text>
            )}
          </BlockStack>
        </Link>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {new Date(item.created_at).toLocaleDateString()}
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Wishlists"
      subtitle={`${total} items`}
      primaryAction={{ content: "Export CSV", onAction: handleExport }}
    >
      <BlockStack gap="400">
        <Card>
          <InlineStack gap="300" blockAlign="end">
            <div style={{ flexGrow: 1 }}>
              <TextField
                label="Search"
                labelHidden
                placeholder="Search by product or customer ID..."
                value={searchValue}
                onChange={setSearchValue}
                onClearButtonClick={() => {
                  setSearchValue("");
                  const params = new URLSearchParams(searchParams);
                  params.delete("search");
                  params.set("page", "1");
                  setSearchParams(params);
                }}
                clearButton
                autoComplete="off"
              />
            </div>
            <Button onClick={handleSearch}>Search</Button>
          </InlineStack>
        </Card>

        <Card>
          <IndexTable
            resourceName={{ singular: "wishlist item", plural: "wishlist items" }}
            itemCount={total}
            headings={[
              { title: "Product" },
              { title: "Customer" },
              { title: "Date Added" },
            ]}
            selectable={false}
            loading={isLoading}
          >
            {rowMarkup}
          </IndexTable>
          <div style={{ display: "flex", justifyContent: "center", padding: "16px" }}>
            <Pagination
              hasPrevious={page > 1}
              hasNext={page < totalPages}
              onPrevious={() => handlePageChange("previous")}
              onNext={() => handlePageChange("next")}
            />
          </div>
        </Card>
      </BlockStack>
    </Page>
  );
}
