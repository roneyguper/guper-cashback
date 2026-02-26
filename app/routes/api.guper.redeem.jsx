import { data } from "react-router";
import { db } from "../services/db.server.js";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const loader = ({ request }) => {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }
  return new Response(null, { status: 405 });
};

export const action = async ({ request }) => {
  const { cartToken, amountToRedeem } = JSON.parse(await request.text());

  if (!cartToken) {
    return data({ error: "cartToken obrigatório" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const transaction = await db.guperTransaction.findUnique({
      where: { cartToken },
    });

    if (!transaction) {
      return data({ error: "Transação não encontrada" }, { status: 404, headers: CORS_HEADERS });
    }

    if (new Date() > transaction.expiresAt) {
      return data({ error: "Token expirado, recalcule o carrinho" }, { status: 410, headers: CORS_HEADERS });
    }

    await db.guperTransaction.update({
      where: { cartToken },
      data: { amountToRedeem },
    });

    return data({ ok: true }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Guper redeem error:", error);
    return data({ error: "Erro ao salvar resgate" }, { status: 500, headers: CORS_HEADERS });
  }
};