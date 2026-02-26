import { data, useLoaderData } from "react-router";
import { authenticate } from "../shopify.server.js";

const GET_DISCOUNT_QUERY = `#graphql
  query GetDiscount($id: ID!) {
    discountNode(id: $id) {
      id
      discount {
        ... on DiscountAutomaticApp {
          title
          status
          startsAt
          endsAt
        }
      }
    }
  }
`;

export const loader = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);

  // params.id may come URL-encoded or as numeric ID
  const rawId = params.id;
  const gid = rawId.startsWith("gid://")
    ? rawId
    : `gid://shopify/DiscountAutomaticNode/${rawId}`;

  const response = await admin.graphql(GET_DISCOUNT_QUERY, {
    variables: { id: gid },
  });

  const { data: responseData } = await response.json();
  return data({ discount: responseData?.discountNode?.discount ?? null });
};

export default function DiscountDetails() {
  const { discount } = useLoaderData();

  if (!discount) {
    return (
      <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
        <p style={{ color: "#666" }}>Desconto não encontrado.</p>
        <a href="/app" style={{ color: "#008060" }}>
          ← Voltar
        </a>
      </div>
    );
  }

  return (
    <div style={{ padding: "20px", maxWidth: "600px", margin: "0 auto" }}>
      <h1 style={{ marginBottom: "8px" }}>{discount.title}</h1>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        Status:{" "}
        <strong
          style={{ color: discount.status === "ACTIVE" ? "#008060" : "#666" }}
        >
          {discount.status === "ACTIVE" ? "✅ Ativo" : discount.status}
        </strong>
      </p>
      <p style={{ color: "#555" }}>
        Este desconto aplica automaticamente o cashback Guper resgatado pelo
        cliente. Nenhuma configuração adicional é necessária.
      </p>
      <a href="/app" style={{ color: "#008060", display: "block", marginTop: "20px" }}>
        ← Voltar para configurações
      </a>
    </div>
  );
}
