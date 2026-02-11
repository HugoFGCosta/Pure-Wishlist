import { shopifyApiProject, ApiType } from "@shopify/api-codegen-preset";

export default {
  schema: "https://shopify.dev/admin-graphql-direct-proxy/2025-01",
  documents: ["./app/**/*.{js,ts,jsx,tsx}"],
  projects: {
    default: shopifyApiProject({
      apiType: ApiType.Admin,
      apiVersion: "2025-01",
      documents: ["./app/**/*.{js,ts,jsx,tsx}"],
      outputDir: "./app/types",
    }),
  },
};
