import { authenticate } from "../shopify.server.js";
import { cancelCashback } from "../services/guper.server.js";
import { db } from "../services/db.server.js";

export const action = async ({ request }) => {
  const { payload, shop } = await authenticate.webhook(request);
  const { id: shopifyOrderId } = payload;

  const transaction = await db.guperTransaction.findUnique({
    where: { shopifyOrderId: String(shopifyOrderId) },
  });

  if (!transaction?.TID || transaction.status !== "confirmed") {
    return new Response(null, { status: 200 });
  }

  try {
    await cancelCashback(shop, transaction.TID);

    await db.guperTransaction.update({
      where: { shopifyOrderId: String(shopifyOrderId) },
      data: { status: "cancelled" },
    });

    console.log(`✅ Cashback cancelado para pedido ${shopifyOrderId}`);
  } catch (error) {
    console.error("Erro ao cancelar cashback:", error);
  }

  return new Response(null, { status: 200 });
};