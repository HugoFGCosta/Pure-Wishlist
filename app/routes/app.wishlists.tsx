import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useSearchParams, useSubmit, useNavigation } from "react-router";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain } from "../db.server";
import { getShopWishlists } from "../lib/wishlist.server";

const LIMIT = 25;

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const search = url.searchParams.get("search") || "";

  const { wishlists, total } = await getShopWishlists(shop.id, {
    page,
    limit: LIMIT,
    search,
  });

  return { wishlists, total, page, search };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);

  const { wishlists } = await getShopWishlists(shop.id, {
    page: 1,
    limit: 100000,
    search: "",
  });

  const csvHeader = "Customer ID,Product ID,Date Added\n";
  const csvRows = wishlists
    .map(
      (w: { customer_id: string; product_id: string; created_at: string }) =>
        `${w.customer_id},${w.product_id},${w.created_at}`,
    )
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
      const newPage = direction === "next" ? page + 1 : page - 1;
      params.set("page", String(newPage));
      setSearchParams(params);
    },
    [page, searchParams, setSearchParams],
  );

  const handleExport = useCallback(() => {
    submit(null, { method: "post" });
  }, [submit]);

  const resourceName = { singular: "wishlist item", plural: "wishlist items" };

  const rowMarkup = wishlists.map(
    (
      item: { id: string; customer_id: string; product_id: string; created_at: string },
      index: number,
    ) => (
      <IndexTable.Row id={item.id} key={item.id} position={index}>
        <IndexTable.Cell>{item.customer_id}</IndexTable.Cell>
        <IndexTable.Cell>{item.product_id}</IndexTable.Cell>
        <IndexTable.Cell>{new Date(item.created_at).toLocaleDateString()}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page title="Wishlists">
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="300">
            <InlineStack gap="300" blockAlign="end">
              <div style={{ flexGrow: 1 }}>
                <TextField
                  label="Search by Product ID or Customer ID"
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
              <Button onClick={handleExport}>Export CSV</Button>
            </InlineStack>
          </BlockStack>
        </Card>

        <Card>
          <IndexTable
            resourceName={resourceName}
            itemCount={total}
            headings={[
              { title: "Customer ID" },
              { title: "Product ID" },
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
