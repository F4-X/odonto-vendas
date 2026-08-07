const API_BASE = 'https://api.mercadopago.com';

function getToken() {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!token) {
    const error = new Error('Mercado Pago não configurado no servidor.');
    error.statusCode = 503;
    throw error;
  }
  return token;
}

async function mpFetch(path, options = {}) {
  const token = getToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.message || data?.error || 'Erro na comunicação com o Mercado Pago.');
    error.statusCode = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

export function mercadoPagoEnabled() {
  return Boolean(process.env.MERCADOPAGO_ACCESS_TOKEN && process.env.MERCADOPAGO_PUBLIC_KEY);
}

export function mercadoPagoPublicKey() {
  return process.env.MERCADOPAGO_PUBLIC_KEY || '';
}

export function createPayment(payload, idempotencyKey) {
  return mpFetch('/v1/payments', {
    method: 'POST',
    headers: { 'X-Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload)
  });
}

export function getPayment(paymentId) {
  return mpFetch(`/v1/payments/${encodeURIComponent(paymentId)}`);
}
