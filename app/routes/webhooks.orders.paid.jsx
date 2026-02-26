import { authenticate } from "../shopify.server.js";
import { confirmCashback } from "../services/guper.server.js";
import { db } from "../services/db.server.js";

export const action = async ({ request }) => {
  const { payload, shop } = await authenticate.webhook(request);
  const { id: shopifyOrderId, cart_token } = payload;

  if (!cart_token) {
    console.warn("orders/paid sem cart_token");
    return new Response(null, { status: 200 });
  }

  const transaction = await db.guperTransaction.findUnique({
    where: { cartToken: cart_token },
  });

  if (!transaction) {
    console.warn(`Nenhuma transação Guper para cart_token: ${cart_token}`);
    return new Response(null, { status: 200 });
  }

  if (transaction.status !== "pending") {
    console.warn(`Transação já processada: ${cart_token}`);
    return new Response(null, { status: 200 });
  }

  try {
    const guper = await confirmCashback(
      shop,
      transaction.confirmToken,
      String(shopifyOrderId),
      transaction.amountToRedeem
    );

    await db.guperTransaction.update({
      where: { cartToken: cart_token },
      data: {
        shopifyOrderId: String(shopifyOrderId),
        TID: guper.TID,
        accumulatedOrder: guper.cashback.accumulatedOrder,
        status: "confirmed",
      },
    });

    console.log(`✅ Cashback confirmado para pedido ${shopifyOrderId}`);
  } catch (error) {
    console.error("Erro ao confirmar cashback:", error);
  }

  return new Response(null, { status: 200 });
};