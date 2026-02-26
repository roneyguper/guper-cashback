import { useState } from "react";
import { data, useLoaderData, useActionData, useSubmit, useNavigation } from "react-router";
import { authenticate } from "../shopify.server.js";

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
  await authenticate.admin(request);
  const url = new URL(request.url);
  const functionId = url.searchParams.get("functionId") || "";
  return data({ functionId });
};

export const action = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const title = formData.get("title");
  const functionId = formData.get("functionId");

  const response = await admin.graphql(CREATE_DISCOUNT_MUTATION, {
    variables: {
      input: {
        title: String(title),
        functionId: String(functionId),
        startsAt: new Date().toISOString(),
        combinesWith: {
          orderDiscounts: false,
          productDiscounts: true,
          shippingDiscounts: true,
        },
      },
    },
  });

  const { data: responseData } = await response.json();
  const { userErrors, automaticAppDiscount } =
    responseData.discountAutomaticAppCreate;

  if (userErrors.length > 0) {
    return data({ errors: userErrors });
  }

  return data({ success: true, discountId: automaticAppDiscount.discountId });
};

export default function DiscountNew() {
  const { functionId } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const [title, setTitle] = useState("Cashback Guper");

  const isSubmitting = navigation.state === "submitting";

  const handleSave = () => {
    const formData = new FormData();
    formData.append("title", title);
    formData.append("functionId", functionId);
    submit(formData, { method: "post" });
  };

  if (actionData?.success) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <div
          style={{
            padding: "16px",
            background: "#d4edda",
            borderRadius: "8px",
            marginBottom: "16px",
          }}
        >
          <strong>✅ Desconto automático criado com sucesso!</strong>
          <p style={{ marginTop: "8px" }}>
            O desconto <strong>&quot;{title}&quot;</strong> foi criado e está ativo.
            O cashback será aplicado automaticamente quando o cliente resgatar
            saldo.
          </p>
        </div>
        <a
          href="/app"
          style={{
            color: "#008060",
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          ← Voltar para configurações
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "8px" }}>Cashback Guper — Desconto Automático</h1>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Este desconto aplica automaticamente o cashback resgatado pelo cliente no
        checkout. Não é necessário nenhuma configuração adicional por desconto.
      </p>

      {actionData?.errors?.length > 0 && (
        <div
          style={{
            padding: "10px",
            background: "#f8d7da",
            borderRadius: "4px",
            marginBottom: "16px",
          }}
        >
          ❌ {actionData.errors.map((e) => e.message).join(", ")}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "4px",
              fontWeight: "bold",
            }}
          >
            Título do Desconto
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            style={{
              width: "100%",
              padding: "8px",
              borderRadius: "4px",
              border: "1px solid #ccc",
              boxSizing: "border-box",
            }}
          />
          <small style={{ color: "#666" }}>
            Este título aparece no resumo do pedido do cliente.
          </small>
        </div>

        <button
          onClick={handleSave}
          disabled={isSubmitting || !title}
          style={{
            padding: "10px 20px",
            background: isSubmitting ? "#ccc" : "#008060",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            fontWeight: "bold",
          }}
        >
          {isSubmitting ? "Criando..." : "Criar Desconto Automático"}
        </button>
      </div>
    </div>
  );
}
