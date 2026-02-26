/**
 * Shopify Order Discount Function — Guper Cashback
 *
 * Lê o metafield $app:guperRedeemAmount (valor em centavos)
 * e aplica como desconto fixo no subtotal do pedido.
 */
/** @param {{ cart: { metafield?: { value: string } | null } }} input */
export default function run(input) {
  const rawValue = input.cart.metafield?.value ?? "0";
  const amountInCents = parseInt(rawValue, 10);

  if (isNaN(amountInCents) || amountInCents <= 0) {
    return { discounts: [], discountApplicationStrategy: "FIRST" };
  }

  const amount = (amountInCents / 100).toFixed(2);

  return {
    discounts: [
      {
        targets: [{ orderSubtotal: { excludedVariantIds: [] } }],
        value: { fixedAmount: { amount } },
        message: "Cashback Guper",
      },
    ],
    discountApplicationStrategy: "FIRST",
  };
}
