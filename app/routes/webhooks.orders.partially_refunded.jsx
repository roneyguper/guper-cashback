import { authenticate } from "../shopify.server.js";
import { cancelPartialCashback } from "../services/guper.server.js";
import { db } from "../services/db.server.js";

export const action = async ({ request }) => {
  const { payload, shop } = await authenticate.webhook(request);
  // refunds/create payload: order_id is the order, id is the refund
  const { order_id: shopifyOrderId, refund_line_items } = payload;

  const transaction = await db.guperTransaction.findUnique({
    where: { shopifyOrderId: String(shopifyOrderId) },
  });

  if (!transaction?.TID || transaction.status !== "confirmed") {
    return new Response(null, { status: 200 });
  }

  try {
    const items = refund_line_items.map((item) => ({
      id: String(item.line_item.variant_id),
      cancel: true,
    }));

    await cancelPartialCashback(shop, transaction.TID, items);

    console.log(`✅ Cashback parcial cancelado para pedido ${shopifyOrderId}`);
  } catch (error) {
    console.error("Erro ao cancelar cashback parcial:", error);
  }

  return new Response(null, { status: 200 });
};