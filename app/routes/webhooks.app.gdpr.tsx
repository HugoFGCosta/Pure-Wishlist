import type { ActionFunctionArgs } from "react-router";
import { authenticate } from "../shopify.server";

// Handles all GDPR mandatory webhooks:
// customers/data_request, customers/redact, shop/redact
export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, payload } = await authenticate.webhook(request);

  switch (topic) {
    case "CUSTOMERS_DATA_REQUEST":
      // Return customer data - we only store customer_id references
      break;
    case "CUSTOMERS_REDACT":
      // Delete all customer data for this customer
      // customer_id is in wishlists and events
      break;
    case "SHOP_REDACT":
      // Shop has been deleted - clean up all data
      break;
  }

  return new Response(null, { status: 200 });
};
