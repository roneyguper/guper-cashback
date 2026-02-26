import { useState } from "react";
import { data, redirect, useLoaderData, useActionData, useSubmit, useNavigation } from "react-router";
import { authenticate } from "../shopify.server.js";
import { db } from "../services/db.server.js";

const FUNCTIONS_QUERY = `#graphql
  {
    shopifyFunctions(first: 25) {
      nodes {
        id
        title
        apiType
      }
    }
  }
`;

const DISCOUNTS_QUERY = `#graphql
  {
    automaticDiscountNodes(first: 20) {
      nodes {
        id
        automaticDiscount {
          ... on DiscountAutomaticApp {
            title
            status
            appDiscountType {
              functionId
            }
          }
        }
      }
    }
  }
`;

const CREATE_DISCOUNT_MUTATION = `#graphql
  mutation CreateAutomaticDiscount($input: DiscountAutomaticAppInput!) {
    discountAutomaticAppCreate(automaticAppDiscount: $input) {
      automaticAppDiscount {
        discountId
      }
      userErrors {
        field
        message
      }
    }
  }
`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);

  const url = new URL(request.url);
  const functionId = url.searchParams.get("functionId");
  if (functionId) {
    return redirect(`/app/discount/new?functionId=${encodeURIComponent(functionId)}`);
  }

  const config = await db.guperConfig.findUnique({
    where: { shop: session.shop },
  });

  // Check for existing guper automatic discount
  const discountRes = await admin.graphql(DISCOUNTS_QUERY);
  const discountData = await discountRes.json();
  const nodes = discountData.data?.automaticDiscountNodes?.nodes ?? [];
  const guperDiscount = nodes.find((node) => {
    const d = node.automaticDiscount;
    return d?.title === "Cashback Guper" || d?.appDiscountType?.functionId?.includes("guper");
  });

  return data({
    shop: session.shop,
    config: config ? { baseUrl: config.baseUrl, apiKey: config.apiKey } : null,
    discount: guperDiscount
      ? {
          id: guperDiscount.id,
          title: guperDiscount.automaticDiscount.title,
          status: guperDiscount.automaticDiscount.status,
        }
      : null,
  });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "createDiscount") {
    const functionsRes = await admin.graphql(FUNCTIONS_QUERY);
    const functionsData = await functionsRes.json();
    const guperFunction = (functionsData.data?.shopifyFunctions?.nodes ?? []).find(
      (f) => f.title === "guper-cart-discount"
    );

    if (!guperFunction) {
      return data({ discountError: "Função guper-cart-discount não encontrada. Aguarde o deploy e tente novamente." });
    }

    const createRes = await admin.graphql(CREATE_DISCOUNT_MUTATION, {
      variables: {
        input: {
          title: "Cashback Guper",
          functionId: guperFunction.id,
          startsAt: new Date().toISOString(),
          combinesWith: {
            orderDiscounts: false,
            productDiscounts: true,
            shippingDiscounts: true,
          },
        },
      },
    });

    const createData = await createRes.json();
    const { userErrors, automaticAppDiscount } =
      createData.data.discountAutomaticAppCreate;

    if (userErrors.length > 0) {
      return data({ discountError: userErrors.map((e) => e.message).join(", ") });
    }

    return data({ discountCreated: true, discountId: automaticAppDiscount.discountId });
  }

  // Default intent: save Guper config
  const baseUrl = formData.get("baseUrl");
  const apiKey = formData.get("apiKey");
  const apiSecret = formData.get("apiSecret");

  if (!baseUrl || !apiKey || !apiSecret) {
    return data({ error: "Todos os campos são obrigatórios" }, { status: 400 });
  }

  await db.guperConfig.upsert({
    where: { shop: session.shop },
    update: { baseUrl, apiKey, apiSecret },
    create: { shop: session.shop, baseUrl, apiKey, apiSecret },
  });

  return data({ success: true });
};

export default function Index() {
  const { config, discount } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();

  const [baseUrl, setBaseUrl] = useState(config?.baseUrl || "");
  const [apiKey, setApiKey] = useState(config?.apiKey || "");
  const [apiSecret, setApiSecret] = useState("");

  const isSaving = navigation.state === "submitting" && navigation.formData?.get("intent") !== "createDiscount";
  const isCreatingDiscount = navigation.state === "submitting" && navigation.formData?.get("intent") === "createDiscount";

  const handleSave = () => {
    const formData = new FormData();
    formData.append("baseUrl", baseUrl);
    formData.append("apiKey", apiKey);
    formData.append("apiSecret", apiSecret);
    submit(formData, { method: "post" });
  };

  const handleCreateDiscount = () => {
    const formData = new FormData();
    formData.append("intent", "createDiscount");
    submit(formData, { method: "post" });
  };

  const activeDiscount = actionData?.discountCreated
    ? { title: "Cashback Guper", status: "ACTIVE" }
    : discount;

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "20px" }}>Configuração Guper Cashback</h1>

      {/* ── Guper credentials ── */}
      <section style={{ marginBottom: "32px" }}>
        <h2 style={{ fontSize: "16px", marginBottom: "12px" }}>Credenciais da API Guper</h2>

        {actionData?.success && (
          <div style={{ padding: "10px", background: "#d4edda", borderRadius: "4px", marginBottom: "12px" }}>
            ✅ Configurações salvas com sucesso!
          </div>
        )}
        {actionData?.error && (
          <div style={{ padding: "10px", background: "#f8d7da", borderRadius: "4px", marginBottom: "12px" }}>
            ❌ {actionData.error}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>Base URL</label>
            <input
              type="text"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://acme.myguper.com"
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>API Key</label>
            <input
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: "4px", fontWeight: "bold" }}>API Secret</label>
            <input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder={config ? "••••••• (deixe vazio para manter)" : ""}
              style={{ width: "100%", padding: "8px", borderRadius: "4px", border: "1px solid #ccc", boxSizing: "border-box" }}
            />
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{ padding: "10px 20px", background: isSaving ? "#ccc" : "#008060", color: "white", border: "none", borderRadius: "4px", cursor: isSaving ? "not-allowed" : "pointer", fontWeight: "bold" }}
          >
            {isSaving ? "Salvando..." : "Salvar configurações"}
          </button>
        </div>
      </section>

      {/* ── Automatic discount ── */}
      <section style={{ borderTop: "1px solid #e1e3e5", paddingTop: "24px" }}>
        <h2 style={{ fontSize: "16px", marginBottom: "8px" }}>Desconto Automático de Cashback</h2>
        <p style={{ color: "#666", fontSize: "14px", marginBottom: "16px" }}>
          O desconto automático aplica o cashback resgatado pelo cliente no checkout, sem precisar de código.
        </p>

        {activeDiscount ? (
          <div style={{ padding: "12px 16px", background: "#f0faf5", border: "1px solid #b5e3c8", borderRadius: "6px" }}>
            <strong style={{ color: "#008060" }}>✅ {activeDiscount.title}</strong>
            <span style={{ marginLeft: "12px", fontSize: "13px", color: "#666" }}>
              {activeDiscount.status === "ACTIVE" ? "Ativo" : activeDiscount.status}
            </span>
          </div>
        ) : (
          <>
            {actionData?.discountError && (
              <div style={{ padding: "10px", background: "#f8d7da", borderRadius: "4px", marginBottom: "12px" }}>
                ❌ {actionData.discountError}
              </div>
            )}
            <button
              onClick={handleCreateDiscount}
              disabled={isCreatingDiscount}
              style={{ padding: "10px 20px", background: isCreatingDiscount ? "#ccc" : "#202223", color: "white", border: "none", borderRadius: "4px", cursor: isCreatingDiscount ? "not-allowed" : "pointer", fontWeight: "bold" }}
            >
              {isCreatingDiscount ? "Criando..." : "Criar Desconto Automático"}
            </button>
          </>
        )}
      </section>
    </div>
  );
}
