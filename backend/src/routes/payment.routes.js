import { Router } from 'express';
import { randomUUID } from 'crypto';

import {
  WebhookSignatureValidator,
  InvalidWebhookSignatureError
} from 'mercadopago';

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

/*
 * ============================================================
 * CONFIGURAÇÃO PÚBLICA DO MERCADO PAGO
 * ============================================================
 */

router.get('/config', (_req, res) => {
  res.json({
    enabled: mercadoPagoEnabled(),
    publicKey: mercadoPagoPublicKey()
  });
});

/*
 * ============================================================
 * CRIAR PAGAMENTO
 * ============================================================
 */

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
        message: 'Dados de pagamento incompletos.'
      });
    }

    /*
     * Busca o pedido e confirma que o token
     * pertence ao pedido informado.
     */
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

    /*
     * Impede pagamento duplicado.
     */
    if (
      order.pagamento_status === 'approved'
    ) {
      return res.status(409).json({
        message: 'Este pedido já está pago.'
      });
    }

    if (Number(order.total) <= 0) {
      return res.status(400).json({
        message: 'Pedido sem valor para pagamento.'
      });
    }

    /*
     * Reserva estoque antes de criar o pagamento.
     */
    await reserveStockForOrder(pedidoId);

    /*
     * A mesma tentativa usa a mesma chave.
     *
     * Isso evita cobranças duplicadas caso
     * o navegador repita a requisição.
     */
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

    /*
     * Dados do pagador.
     */
    const payer = {
      ...(payment.payer || {}),

      email:
        payment?.payer?.email ||
        order.email ||
        undefined
    };

    /*
     * Caso o Brick não mande o CPF,
     * usamos o CPF cadastrado no pedido.
     */
    if (
      !payer.identification?.number &&
      order.cpf
    ) {
      payer.identification = {
        type: 'CPF',
        number: normalizeDigits(order.cpf)
      };
    }

    /*
     * Payload enviado ao Mercado Pago.
     */
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

      /*
       * O Mercado Pago usará esta URL
       * para avisar mudanças no pagamento.
       */
      notification_url:
        process.env.PUBLIC_BASE_URL
          ? `${process.env.PUBLIC_BASE_URL.replace(
              /\/$/,
              ''
            )}/api/webhooks/mercadopago`
          : undefined
    };

    /*
     * Remove propriedades undefined.
     */
    Object.keys(payload).forEach(
      (key) => {
        if (payload[key] === undefined) {
          delete payload[key];
        }
      }
    );

    try {
      /*
       * Cria o pagamento no gateway.
       */
      const gatewayPayment =
        await createPayment(
          payload,
          idempotencyKey
        );

      /*
       * Salva resposta do gateway.
       */
      await saveGatewayPayment(
        pedidoId,
        gatewayPayment,
        idempotencyKey
      );

      /*
       * Sincroniza status do pedido.
       *
       * Exemplos:
       *
       * approved -> confirmado
       * pending  -> aguardando_pagamento
       */
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
       * Se o Mercado Pago recusou explicitamente
       * com erro 4xx, sabemos que o pagamento
       * não foi criado.
       *
       * Podemos então liberar a reserva.
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

      /*
       * Em erro 5xx não liberamos imediatamente.
       *
       * Pode existir incerteza sobre o pagamento
       * ter sido criado no gateway.
       */
      throw error;
    }
  })
);

/*
 * ============================================================
 * CONSULTAR STATUS DO PAGAMENTO
 * ============================================================
 */

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

/*
 * ============================================================
 * WEBHOOK MERCADO PAGO
 * ============================================================
 */

export async function processMercadoPagoWebhook(
  req,
  res
) {
  const secret =
    process.env.MERCADOPAGO_WEBHOOK_SECRET;

  /*
   * Não aceitamos webhook sem uma
   * assinatura secreta configurada.
   */
  if (!secret) {
    console.error(
      'Webhook Mercado Pago rejeitado: MERCADOPAGO_WEBHOOK_SECRET não configurado.'
    );

    return res.status(503).json({
      message: 'Webhook não configurado.'
    });
  }

  /*
   * Cabeçalhos enviados pelo Mercado Pago.
   */
  const xSignature =
    req.headers['x-signature'];

  const xRequestId =
    req.headers['x-request-id'];

  /*
   * O Mercado Pago normalmente envia:
   *
   * ?data.id=123456&type=payment
   *
   * Mas mantemos fallback para body
   * para deixar a rota mais robusta.
   */
  const dataId =
    req.query?.['data.id'] ||
    req.body?.data?.id;

  if (
    !xSignature ||
    !xRequestId ||
    !dataId
  ) {
    console.error(
      'Webhook Mercado Pago rejeitado: cabeçalhos ou data.id ausentes.'
    );

    return res.status(401).json({
      message: 'Notificação não autorizada.'
    });
  }

  /*
   * ==========================================================
   * VALIDAÇÃO OFICIAL DA ASSINATURA
   * ==========================================================
   *
   * Usamos o SDK oficial mercadopago@3.3.0.
   */
  try {
    WebhookSignatureValidator.validate({
      xSignature:
        String(xSignature),

      xRequestId:
        String(xRequestId),

      dataId:
        String(dataId),

      secret
    });
  } catch (error) {
    if (
      error instanceof
      InvalidWebhookSignatureError
    ) {
      console.error(
        `Webhook Mercado Pago rejeitado: assinatura inválida. Data ID: ${dataId}`
      );

      return res.status(401).json({
        message: 'Assinatura inválida.'
      });
    }

    console.error(
      'Erro inesperado ao validar webhook Mercado Pago:',
      error
    );

    return res.status(500).json({
      message: 'Erro ao validar webhook.'
    });
  }

  /*
   * ==========================================================
   * ASSINATURA VÁLIDA
   * ==========================================================
   *
   * Respondemos rapidamente 200 para
   * o Mercado Pago não considerar timeout.
   */
  res.status(200).json({
    received: true
  });

  const paymentId =
    String(dataId);

  const type =
    req.body?.type ||
    req.query?.type ||
    req.body?.topic ||
    req.query?.topic;

  /*
   * Ignora eventos que não sejam pagamento.
   */
  if (
    type &&
    !String(type)
      .toLowerCase()
      .includes('payment')
  ) {
    console.log(
      `Webhook Mercado Pago ignorado: evento ${type}.`
    );

    return;
  }

  try {
    /*
     * ========================================================
     * CONSULTA O PAGAMENTO NO MERCADO PAGO
     * ========================================================
     *
     * Nunca confiamos somente nos dados
     * recebidos pelo webhook.
     */
    const payment =
      await getPayment(paymentId);

    /*
     * Recupera qual pedido da Odontek
     * pertence a esse pagamento.
     */
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

    /*
     * Busca o valor original do pedido.
     */
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
     * ========================================================
     * VERIFICAÇÃO DE VALOR
     * ========================================================
     *
     * Um pagamento só pode atualizar o pedido
     * se o valor confirmado pelo Mercado Pago
     * for igual ao valor registrado na Odontek.
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
        `Webhook Mercado Pago ignorado: valor divergente no pedido ${pedidoId}. Pedido=${orderTotal}, MercadoPago=${paymentTotal}`
      );

      return;
    }

    /*
     * Atualiza registro do pagamento.
     */
    await saveGatewayPayment(
      pedidoId,
      payment
    );

    /*
     * Atualiza pedido e estoque conforme
     * o status confirmado pelo gateway.
     */
    await syncOrderPaymentStatus(
      pedidoId,
      payment
    );

    console.log(
      `Webhook Mercado Pago processado com sucesso: pagamento=${paymentId}, pedido=${pedidoId}, status=${payment.status}.`
    );
  } catch (error) {
    /*
     * O webhook já recebeu HTTP 200.
     *
     * Registramos qualquer falha interna
     * para investigação.
     */
    console.error(
      'Erro ao processar webhook Mercado Pago:',
      error
    );
  }
}

export default router;