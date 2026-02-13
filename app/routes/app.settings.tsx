import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useLoaderData, useActionData, useSubmit, useNavigation } from "react-router";
import { useState, useCallback } from "react";
import {
  Page,
  Layout,
  Card,
  FormLayout,
  TextField,
  Select,
  Button,
  Banner,
  BlockStack,
  Checkbox,
  Text,
  InlineStack,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopByDomain, supabaseAdmin } from "../db.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  return { shop };
};

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShopByDomain(session.shop);
  const formData = await request.formData();

  const settings = {
    button_color: formData.get("button_color") as string,
    button_style: formData.get("button_style") as string,
    button_text: formData.get("button_text") as string,
    notify_price_drop: formData.get("notify_price_drop") === "true",
    notify_back_in_stock: formData.get("notify_back_in_stock") === "true",
  };

  const { error } = await supabaseAdmin
    .from("shops")
    .update({ settings })
    .eq("id", shop.id);

  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "success", message: "Settings saved." };
};

export default function SettingsPage() {
  const { shop } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSaving = navigation.state === "submitting";

  const settings = shop.settings || {};

  const [buttonColor, setButtonColor] = useState(settings.button_color || "#000000");
  const [buttonStyle, setButtonStyle] = useState(settings.button_style || "icon");
  const [buttonText, setButtonText] = useState(settings.button_text || "Add to Wishlist");
  const [notifyPriceDrop, setNotifyPriceDrop] = useState(settings.notify_price_drop ?? false);
  const [notifyBackInStock, setNotifyBackInStock] = useState(
    settings.notify_back_in_stock ?? false,
  );

  const handleSave = useCallback(() => {
    const formData = new FormData();
    formData.set("button_color", buttonColor);
    formData.set("button_style", buttonStyle);
    formData.set("button_text", buttonText);
    formData.set("notify_price_drop", String(notifyPriceDrop));
    formData.set("notify_back_in_stock", String(notifyBackInStock));
    submit(formData, { method: "post" });
  }, [buttonColor, buttonStyle, buttonText, notifyPriceDrop, notifyBackInStock, submit]);

  return (
    <Page
      title="Settings"
      primaryAction={{
        content: "Save",
        onAction: handleSave,
        loading: isSaving,
      }}
    >
      <BlockStack gap="400">
        {actionData?.status === "success" && (
          <Banner tone="success" onDismiss={() => {}}>{actionData.message}</Banner>
        )}
        {actionData?.status === "error" && (
          <Banner tone="critical">{actionData.message}</Banner>
        )}

        <Layout>
          <Layout.AnnotatedSection
            title="Wishlist Button"
            description="Customize how the wishlist button looks on your product pages."
          >
            <Card>
              <FormLayout>
                <TextField
                  label="Button color"
                  helpText="Hex color code (e.g. #ff0000)"
                  value={buttonColor}
                  onChange={setButtonColor}
                  autoComplete="off"
                  prefix={
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 4,
                        backgroundColor: buttonColor,
                        border: "1px solid var(--p-color-border-secondary)",
                      }}
                    />
                  }
                />
                <Select
                  label="Button style"
                  options={[
                    { label: "Icon only", value: "icon" },
                    { label: "Icon + Text", value: "icon_text" },
                  ]}
                  value={buttonStyle}
                  onChange={setButtonStyle}
                />
                <TextField
                  label="Custom button text"
                  helpText="Shown when style is 'Icon + Text'"
                  value={buttonText}
                  onChange={setButtonText}
                  autoComplete="off"
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>

          <Layout.AnnotatedSection
            title="Email Notifications"
            description="Send automated emails when products in a customer's wishlist change."
          >
            <Card>
              <FormLayout>
                <Checkbox
                  label="Price drop notifications"
                  helpText="Notify customers when a wishlisted product's price decreases."
                  checked={notifyPriceDrop}
                  onChange={setNotifyPriceDrop}
                />
                <Checkbox
                  label="Back in stock notifications"
                  helpText="Notify customers when a wishlisted product is restocked."
                  checked={notifyBackInStock}
                  onChange={setNotifyBackInStock}
                />
              </FormLayout>
            </Card>
          </Layout.AnnotatedSection>
        </Layout>
      </BlockStack>
    </Page>
  );
}
