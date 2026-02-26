import '@shopify/ui-extensions/preact';
import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';

// shopify.extend passes (root) as first arg in the checkout sandbox.
// The editor may call with no args and have document.body available.
export default (...args) => {
  const root =
    args[0] instanceof Element
      ? args[0]
      : typeof document !== 'undefined' && document.body
        ? document.body
        : null;
  if (root) render(<GuperCashback />, root);
};

function GuperCashback() {
  const api = globalThis.shopify;
  const translate = (key, replacements) => api.i18n.translate(key, replacements);
  const [cashbackInfo, setCashbackInfo] = useState(null);
  const [selectedRedeem, setSelectedRedeem] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(null);
  const [redeemError, setRedeemError] = useState(null);

  // SubscribableSignalLike — access via .current (deprecated but still supported in 2026-01)
  const languageCode = api.localization.language.current.isoCode;
  const currencyCode = api.localization.currency.current.isoCode;

  const formatCurrency = (amountInCents) =>
    new Intl.NumberFormat(languageCode, {
      style: 'currency',
      currency: currencyCode,
    }).format(amountInCents / 100);

  useEffect(() => {
    calculateCashback();
  }, []);

  const calculateCashback = async () => {
    try {
      // api.lines and api.checkoutToken are top-level on the shopify global (not api.cart.*)
      const cartLines = api.lines.current;
      const cartToken = api.checkoutToken.current;
      const customer = api.buyerIdentity?.customer?.current;
      const shopDomain = api.shop.myshopifyDomain;
      console.log('[Guper] calculate payload:', { cartToken, customer: customer?.id, shopDomain, itemCount: cartLines?.length });

      // Resolve country calling code from shipping address or store localization
      const CALLING_CODES = {
        BR: 55, US: 1, CA: 1, PT: 351, AR: 54, MX: 52, CO: 57, CL: 56,
        PE: 51, UY: 598, PY: 595, BO: 591, EC: 593, VE: 58, GB: 44,
        DE: 49, FR: 33, ES: 34, IT: 39, AU: 61, JP: 81, CN: 86,
      };
      const countryIso =
        api.shippingAddress?.current?.countryCode ||
        api.localization.country.current.isoCode;
      const callingCode = CALLING_CODES[countryIso];
      const parsePhone = (rawPhone) => {
        const digits = (rawPhone || '').replace(/\D/g, '');
        if (!digits) return {};
        const prefix = callingCode ? String(callingCode) : '';
        const cellphone = prefix && digits.startsWith(prefix)
          ? digits.slice(prefix.length)
          : digits;
        return callingCode ? { countryCallingCode: callingCode, cellphone } : { cellphone };
      };

      const items = cartLines.map((line) => ({
        id: line.merchandise.id,
        name: line.merchandise.title,
        quantity: line.quantity,
        price: Math.round((line.cost.totalAmount.amount / line.quantity) * 100),
      }));

      const res = await fetch(`https://${shopDomain}/apps/guper/api/guper/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          cartToken,
          storeId: shopDomain,
          client: customer
            ? {
                id: customer.id,
                email: customer.email || '',
                name: `${customer.firstName || ''} ${customer.lastName || ''}`.trim(),
                ...parsePhone(customer.phone),
              }
            : null,
          items,
        }),
      });

      const data = await res.json();
      console.log('[Guper] calculate response:', JSON.stringify(data));
      if (!data.error) {
        setCashbackInfo(data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      console.error('[Guper] calculate error:', err.message);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async (amount) => {
    setSelectedRedeem(amount);
    setSaved(false);
    setRedeemError(null);
    try {
      const shopDomain = api.shop.myshopifyDomain;
      await fetch(`https://${shopDomain}/apps/guper/api/guper/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          cartToken: api.checkoutToken.current,
          amountToRedeem: amount,
        }),
      });
      console.log('[Guper] applyMetafieldChange amount:', amount);
      const result = await api.applyMetafieldChange({
        type: 'updateCartMetafield',
        namespace: '$app',
        key: 'guperRedeemAmount',
        value: String(amount),
        valueType: 'single_line_text_field',
      });
      console.log('[Guper] applyMetafieldChange result:', JSON.stringify(result));
      if (result?.type === 'error') {
        setRedeemError(result.message);
      } else {
        setSaved(true);
      }
    } catch (err) {
      console.error('Guper redeem error:', err);
      setRedeemError(err.message);
    }
  };

  if (loading) {
    return (
      <s-banner heading={translate('title')}>
        <s-text>{translate('loading')}</s-text>
      </s-banner>
    );
  }

  if (!cashbackInfo) {
    const customer = api.buyerIdentity?.customer?.current;
    return (
      <s-banner heading={translate('title')}>
        <s-text>{!customer ? translate('loginPrompt') : error ? `⚠️ ${error}` : translate('errorPrompt')}</s-text>
      </s-banner>
    );
  }

  const { accumulating, redeemable, userBalance } = cashbackInfo;

  return (
    <s-banner heading={translate('title')}>
      <s-stack gap="base">
        <s-text>
          {translate('accumulating', { amount: formatCurrency(accumulating) })}
        </s-text>

        <s-stack gap="tight">
          <s-text>{translate('balance', { amount: formatCurrency(userBalance) })}</s-text>

          {userBalance > 0 && (
            <>
              <s-text>{translate('redeemQuestion')}</s-text>
              <s-stack direction="horizontal" gap="base">
                <s-button
                  variant={selectedRedeem === 0 ? 'primary' : 'secondary'}
                  onClick={() => handleRedeem(0)}
                >
                  {translate('noRedeem')}
                </s-button>
                <s-button
                  variant={selectedRedeem === redeemable ? 'primary' : 'secondary'}
                  onClick={() => handleRedeem(redeemable)}
                >
                  {translate('redeemButton', { amount: formatCurrency(redeemable) })}
                </s-button>
              </s-stack>
              {saved && selectedRedeem > 0 && (
                <s-text>{translate('redeemConfirm', { amount: formatCurrency(selectedRedeem) })}</s-text>
              )}
              {redeemError && (
                <s-text>⚠️ {redeemError}</s-text>
              )}
            </>
          )}
        </s-stack>
      </s-stack>
    </s-banner>
  );
}
