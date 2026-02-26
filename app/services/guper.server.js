import { db } from "./db.server.js";

// Cache de tokens por loja
const tokenCache = new Map()

const getConfig = async (shop) => {
  const config = await db.guperConfig.findUnique({
    where: { shop },
  })

  if (!config) {
    throw new Error(`Configuração Guper não encontrada para loja: ${shop}`)
  }

  return config
}

const getToken = async (shop) => {
  // Verifica cache
  const cached = tokenCache.get(shop)
  if (cached && new Date() < cached.expiresAt) {
    return cached.token
  }

  const config = await getConfig(shop)

  const res = await fetch(`${config.baseUrl}/api/connect/token`, {
    method: "GET",
    headers: {
      "x-guper-apikey": config.apiKey,
      "x-guper-apisecret": config.apiSecret,
    },
  })

  if (!res.ok) {
    throw new Error(`Falha ao autenticar na Guper para loja: ${shop}`)
  }

  const data = await res.json()

  // Salva no cache subtraindo 5 min para renovar antes de expirar
  tokenCache.set(shop, {
    token: data.accessToken,
    expiresAt: new Date(new Date(data.expiresIn).getTime() - 5 * 60 * 1000),
  })

  return data.accessToken
}

const guperFetch = async (shop, path, body) => {
  const config = await getConfig(shop)
  const token = await getToken(shop)

  const res = await fetch(`${config.baseUrl}/api/loyalty/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-guper-authorization": token,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Guper error: ${JSON.stringify(error)}`)
  }

  return res.json()
}

// Etapa 1 — Calcular
export const calculateCashback = (shop, payload) =>
  guperFetch(shop, "rewardByOrder", payload)

// Etapa 2 — Confirmar
export const confirmCashback = async (shop, confirmToken, orderId, amountToRedeem) => {
  const config = await getConfig(shop)
  const token = await getToken(shop)

  const res = await fetch(
    `${config.baseUrl}/api/loyalty/confirmOrder/${confirmToken}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guper-authorization": token,
      },
      body: JSON.stringify({ id: orderId, amountToRedeem }),
    }
  )

  if (!res.ok) {
    const error = await res.json()
    throw new Error(`Guper error: ${JSON.stringify(error)}`)
  }

  return res.json()
}

// Cancelamento Total
export const cancelCashback = async (shop, TID) => {
  const config = await getConfig(shop)
  const token = await getToken(shop)

  const res = await fetch(
    `${config.baseUrl}/api/loyalty/cancelOrderByTransaction/${TID}`,
    {
      method: "POST",
      headers: { "x-guper-authorization": token },
    }
  )
  return res.json()
}

// Cancelamento Parcial
export const cancelPartialCashback = async (shop, TID, items) => {
  const config = await getConfig(shop)
  const token = await getToken(shop)

  const res = await fetch(
    `${config.baseUrl}/api/loyalty/cancelPartial/${TID}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-guper-authorization": token,
      },
      body: JSON.stringify({ items }),
    }
  )
  return res.json()
}