import { data } from "react-router";
import { calculateCashback } from "../services/guper.server.js";
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
  const url = new URL(request.url);
  const shop = request.headers.get("x-shop-domain") 
    || url.searchParams.get("shop")
    || "guper-dev.myshopify.com";

  const { cartToken, client, storeId, items } = JSON.parse(await request.text());

  if (!cartToken || !items?.length) {
    return data({ error: "Dados inválidos" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    console.log("[Guper] calculate → client enviado:", JSON.stringify(client));

    const guper = await calculateCashback(shop, {
      interface: "shopify",
      storeId,
      client,
      items,
    });

    console.log("[Guper] calculate → resposta completa:", JSON.stringify(guper));

    await db.guperTransaction.upsert({
      where: { cartToken },
      update: {
        confirmToken: guper.confirmToken,
        expiresAt: new Date(guper.expiresAt),
        status: "pending",
        amountToRedeem: 0,
      },
      create: {
        cartToken,
        confirmToken: guper.confirmToken,
        expiresAt: new Date(guper.expiresAt),
      },
    });

    return data({
      accumulating: guper.cashback.thisOrder.accumulating.total,
      redeemable: guper.cashback.thisOrder.redeemable.total,
      userBalance: guper.cashback.userBalance.availableAmount,
      expiresAt: guper.expiresAt,
    }, { headers: CORS_HEADERS });
  } catch (error) {
    console.error("Guper calculate error:", error.message);
    return data({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }
};