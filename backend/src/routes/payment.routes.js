import { Router } from 'express';
import {
  createHmac,
  randomUUID,
  timingSafeEqual
} from 'crypto';

import { query } from '../database/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

import {
  createPayment,
  getPayment,
  mercadoPagoEnabled,
  mercadoPagoPublicKey
} from '../services/mercadoPago.js';

import {
  reserveStockForOrder,
  releaseOrderReservation,
  syncOrderPaymentStatus
} from '../services/orderService.js';

const router = Router();

function normalizeDigits(value) {
  return String(value || '').replace(/\D/g, '');
}

function validateMercadoPagoSignature(req) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

  if (!secret) {
    return {
      valid: false,
      reason: 'MERCADOPAGO_WEBHOOK_SECRET não configurado.'
    };
  }

  const xSignature = req.headers['x-signature'];
  const xRequestId = req.headers['x-request-id'];

  const rawDataId =
    req.query?.['data.id'] ||
    req.body?.data?.id;

  if (!xSignature || !xRequestId || !rawDataId) {
    return {
      valid: false,
      reason: 'Cabeçalhos ou data.id ausentes.'
    };
  }

  const parts = String(xSignature)
    .split(',')
    .map((part) => part.trim());

  const signatureParts = {};

  for (const part of parts) {
    const [key, ...rest] = part.split('=');

    if (key && rest.length) {
      signatureParts[key] = rest.join('=');
    }
  }

  const ts = signatureParts.ts;
  const receivedHash = signatureParts.v1;

  if (!ts || !receivedHash) {
    return {
      valid: false,
      reason: 'Formato de x-signature inválido.'
    };
  }

  const dataId = String(rawDataId).toLowerCase();

  const manifest =
    `id:${dataId};` +
    `request-id:${xRequestId};` +
    `ts:${ts};`;

  const expectedHash = createHmac('sha256', secret)
    .update(manifest)
    .digest('hex');

  const expectedBuffer = Buffer.from(expectedHash);
  const receivedBuffer = Buffer.from(receivedHash);

  if (expectedBuffer.length !== receivedBuffer.length) {
    return {
      valid: false,
      reason: 'Assinatura com tamanho inválido.'
    };
  }

  const valid = timingSafeEqual(
    expectedBuffer,
    receivedBuffer
  );

  return {
    valid,
    reason: valid ? null : 'Assinatura inválida.'
  };
}

async function saveGatewayPayment(
  pedidoId,
  payment,
  idempotencyKey = null
) {
  const qr =
    payment?.point_of_interaction?.transaction_data || {};

  await query(
    `INSERT INTO pagamentos
      (
        pedido_id,
        gateway,
        gateway_payment_id,
        status,
        status_detail,
        payment_method_id,
        payment_type_id,
        installments,
        transaction_amount,
        idempotency_key,
        qr_code,
        qr_code_base64,
        raw_response,
        atualizado_em
      )
     VALUES (
       $1,
       'mercadopago',
       $2,
       $3,
       $4,
       $5,
       $6,
       $7,
       $8,
       $9,
       $10,
       $11,
       $12::jsonb,
       CURRENT_TIMESTAMP
     )
     ON CONFLICT (gateway_payment_id)
     DO UPDATE SET
       status = EXCLUDED.status,
       status_detail = EXCLUDED.status_detail,
       payment_method_id = EXCLUDED.payment_method_id,
       payment_type_id = EXCLUDED.payment_type_id,
       installments = EXCLUDED.installments,
       transaction_amount = EXCLUDED.transaction_amount,
       qr_code = EXCLUDED.qr_code,
       qr_code_base64 = EXCLUDED.qr_code_base64,
       raw_response = EXCLUDED.raw_response,
       atualizado_em = CURRENT_TIMESTAMP`,
    [
      pedidoId,
      payment?.id
        ? String(payment.id)
        : null,

      payment?.status || null,
      payment?.status_detail || null,
      payment?.payment_method_id || null,
      payment?.payment_type_id || null,
      payment?.installments || null,
      payment?.transaction_amount || null,

      idempotencyKey,

      qr?.qr_code || null,
      qr?.qr_code_base64 || null,

      JSON.stringify(payment || {})
    ]
  );
}

router.get('/config', (_req, res) => {
  res.json({
    enabled: mercadoPagoEnabled(),
    publicKey: mercadoPagoPublicKey()
  });
});

router.post(
  '/mercadopago',
  asyncHandler(async (req, res) => {
    const {
      pedido_id,
      checkout_token,
      payment
    } = req.body;

    const pedidoId = Number(pedido_id);

    if (
      !pedidoId ||
      !checkout_token ||
      !payment
    ) {
      return res.status(400).json({
        message:
          'Dados de pagamento incompletos.'
      });
    }

    const orderResult = await query(
      `SELECT
         p.*,
         c.nome AS cliente_nome,
         c.email,
         c.cpf,
         c.whatsapp
       FROM pedidos p
       JOIN clientes c
         ON c.id = p.cliente_id
       WHERE
         p.id = $1
         AND p.checkout_token = $2`,
      [
        pedidoId,
        checkout_token
      ]
    );

    const order = orderResult.rows[0];

    if (!order) {
      return res.status(404).json({
        message: 'Pedido não encontrado.'
      });
    }

    if (
      order.pagamento_status === 'approved'
    ) {
      return res.status(409).json({
        message:
          'Este pedido já está pago.'
      });
    }

    if (Number(order.total) <= 0) {
      return res.status(400).json({
        message:
          'Pedido sem valor para pagamento.'
      });
    }

    await reserveStockForOrder(pedidoId);

    let idempotencyKey =
      order.payment_attempt_key;

    if (!idempotencyKey) {
      idempotencyKey = randomUUID();

      await query(
        `UPDATE pedidos
         SET payment_attempt_key = $2
         WHERE id = $1`,
        [
          pedidoId,
          idempotencyKey
        ]
      );
    }

    const payer = {
      ...(payment.payer || {}),

      email:
        payment?.payer?.email ||
        order.email ||
        undefined
    };

    if (
      !payer.identification?.number &&
      order.cpf
    ) {
      payer.identification = {
        type: 'CPF',
        number: normalizeDigits(order.cpf)
      };
    }

    const payload = {
      transaction_amount:
        Number(order.total),

      token:
        payment.token ||
        undefined,

      description:
        `Pedido Odontek #${pedidoId}`,

      installments:
        Number(
          payment.installments || 1
        ),

      payment_method_id:
        payment.payment_method_id,

      issuer_id:
        payment.issuer_id ||
        undefined,

      payer,

      external_reference:
        String(pedidoId),

      metadata: {
        pedido_id: pedidoId,
        checkout_token
      },

      notification_url:
        process.env.PUBLIC_BASE_URL
          ? `${process.env.PUBLIC_BASE_URL.replace(
              /\/$/,
              ''
            )}/api/webhooks/mercadopago`
          : undefined
    };

    Object.keys(payload).forEach(
      (key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      }
    );

    try {
      const gatewayPayment =
        await createPayment(
          payload,
          idempotencyKey
        );

      await saveGatewayPayment(
        pedidoId,
        gatewayPayment,
        idempotencyKey
      );

      const updatedOrder =
        await syncOrderPaymentStatus(
          pedidoId,
          gatewayPayment
        );

      return res.status(201).json({
        pedido: updatedOrder,

        payment: {
          id:
            gatewayPayment.id,

          status:
            gatewayPayment.status,

          status_detail:
            gatewayPayment.status_detail,

          payment_method_id:
            gatewayPayment.payment_method_id,

          payment_type_id:
            gatewayPayment.payment_type_id,

          qr_code:
            gatewayPayment
              ?.point_of_interaction
              ?.transaction_data
              ?.qr_code ||
            null,

          qr_code_base64:
            gatewayPayment
              ?.point_of_interaction
              ?.transaction_data
              ?.qr_code_base64 ||
            null,

          ticket_url:
            gatewayPayment
              ?.point_of_interaction
              ?.transaction_data
              ?.ticket_url ||
            null
        }
      });
    } catch (error) {
      /*
       * Se o gateway recusou a operação
       * explicitamente com erro 4xx,
       * liberamos a reserva.
       *
       * Em erros 5xx não liberamos
       * imediatamente porque pode existir
       * incerteza sobre o processamento
       * da transação.
       */
      if (
        error.statusCode &&
        error.statusCode < 500
      ) {
        await releaseOrderReservation(
          pedidoId
        );

        await query(
          `UPDATE pedidos
           SET payment_attempt_key = NULL
           WHERE id = $1`,
          [pedidoId]
        );
      }

      throw error;
    }
  })
);

router.get(
  '/status/:pedidoId',
  asyncHandler(async (req, res) => {
    const pedidoId =
      Number(req.params.pedidoId);

    const checkoutToken =
      req.query.token;

    const result = await query(
      `SELECT
         id,
         total,
         status,
         pagamento_status,
         pagamento_metodo,
         pagamento_id,
         pago_em
       FROM pedidos
       WHERE
         id = $1
         AND checkout_token = $2`,
      [
        pedidoId,
        checkoutToken
      ]
    );

    if (!result.rows[0]) {
      return res.status(404).json({
        message: 'Pedido não encontrado.'
      });
    }

    const paymentResult =
      await query(
        `SELECT
           status,
           status_detail,
           payment_method_id,
           payment_type_id,
           qr_code,
           qr_code_base64,
           atualizado_em
         FROM pagamentos
         WHERE pedido_id = $1
         ORDER BY id DESC
         LIMIT 1`,
        [pedidoId]
      );

    res.json({
      pedido:
        result.rows[0],

      payment:
        paymentResult.rows[0] ||
        null
    });
  })
);

export async function processMercadoPagoWebhook(
  req,
  res
) {
  /*
   * PRIMEIRO:
   * verifica se a chamada realmente veio
   * do Mercado Pago.
   */

  const signature =
    validateMercadoPagoSignature(req);

  if (!signature.valid) {
    console.error(
      `Webhook Mercado Pago rejeitado: ${signature.reason}`
    );

    return res.status(401).json({
      message:
        'Notificação não autorizada.'
    });
  }

  const paymentId =
    req.body?.data?.id ||
    req.query?.['data.id'];

  const type =
    req.body?.type ||
    req.query?.type ||
    req.body?.topic ||
    req.query?.topic;

  /*
   * Responde rapidamente ao Mercado Pago
   * depois da assinatura ter sido validada.
   */
  res.status(200).json({
    received: true
  });

  if (!paymentId) {
    return;
  }

  if (
    type &&
    !String(type)
      .toLowerCase()
      .includes('payment')
  ) {
    return;
  }

  try {
    /*
     * Nunca confiamos somente nos dados
     * recebidos no webhook.
     *
     * Consultamos novamente o pagamento
     * diretamente na API do Mercado Pago.
     */
    const payment =
      await getPayment(paymentId);

    const pedidoId = Number(
      payment?.metadata?.pedido_id ||
      payment?.external_reference
    );

    if (!pedidoId) {
      console.error(
        `Webhook Mercado Pago ${paymentId}: pedido não identificado.`
      );

      return;
    }

    const orderResult =
      await query(
        `SELECT
           id,
           total
         FROM pedidos
         WHERE id = $1`,
        [pedidoId]
      );

    const order =
      orderResult.rows[0];

    if (!order) {
      console.error(
        `Webhook Mercado Pago: pedido ${pedidoId} não encontrado.`
      );

      return;
    }

    /*
     * Segurança extra:
     * o valor confirmado pelo Mercado Pago
     * precisa ser o mesmo valor do pedido.
     */
    const orderTotal =
      Number(order.total);

    const paymentTotal =
      Number(
        payment.transaction_amount ||
        0
      );

    if (
      Math.abs(
        orderTotal -
        paymentTotal
      ) > 0.01
    ) {
      console.error(
        `Webhook ignorado: valor divergente no pedido ${pedidoId}. Pedido=${orderTotal}, MercadoPago=${paymentTotal}`
      );

      return;
    }

    await saveGatewayPayment(
      pedidoId,
      payment
    );

    await syncOrderPaymentStatus(
      pedidoId,
      payment
    );

    console.log(
      `Webhook Mercado Pago processado: pagamento ${paymentId}, pedido ${pedidoId}, status ${payment.status}.`
    );
  } catch (error) {
    console.error(
      'Erro ao processar webhook Mercado Pago:',
      error.message
    );
  }
}

export default router;