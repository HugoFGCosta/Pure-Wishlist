import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PostgreSQLSessionStorage } from "@shopify/shopify-app-session-storage-postgresql";
import { supabaseAdmin } from "./db.server";

const sessionStorage = new PostgreSQLSessionStorage(
  process.env.SUPABASE_DB_URL!,
);

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.January25,
  scopes: process.env.SCOPES?.split(","),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage,
  distribution: AppDistribution.AppStore,
  future: {},
  hooks: {
    afterAuth: async ({ session }) => {
      // Upsert shop record on install/auth
      const { error } = await supabaseAdmin
        .from("shops")
        .upsert(
          {
            shop_domain: session.shop,
            access_token: session.accessToken,
            uninstalled_at: null,
          },
          { onConflict: "shop_domain" },
        );
      if (error) console.error("Failed to upsert shop:", error);
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const apiVersion = ApiVersion.January25;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const unauthenticated = shopify.unauthenticated;
export const login = shopify.login;
export const registerWebhooks = shopify.registerWebhooks;
export { sessionStorage as shopifySessionStorage };
