import { query, withTransaction } from '../database/db.js';

export async function reserveStockForOrder(pedidoId) {
  return withTransaction(async (client) => {
    const orderResult = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [pedidoId]);
    const order = orderResult.rows[0];
    if (!order) throw new Error('Pedido não encontrado.');
    if (order.estoque_reservado) return order;

    const itemsResult = await client.query(
      'SELECT produto_id, quantidade FROM itens_pedido WHERE pedido_id = $1 ORDER BY id',
      [pedidoId]
    );

    for (const item of itemsResult.rows) {
      const productResult = await client.query(
        'SELECT id, nome, estoque, estoque_reservado FROM produtos WHERE id = $1 AND ativo = TRUE FOR UPDATE',
        [item.produto_id]
      );
      const product = productResult.rows[0];
      if (!product) throw new Error(`Produto ${item.produto_id} indisponível.`);

      const disponivel = Number(product.estoque) - Number(product.estoque_reservado || 0);
      if (disponivel < Number(item.quantidade)) {
        throw new Error(`Estoque insuficiente para ${product.nome}. Disponível: ${Math.max(0, disponivel)}.`);
      }

      await client.query(
        `UPDATE produtos
         SET estoque_reservado = estoque_reservado + $1, atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [item.quantidade, item.produto_id]
      );
    }

    const updated = await client.query(
      `UPDATE pedidos
       SET estoque_reservado = TRUE,
           reserva_expira_em = CURRENT_TIMESTAMP + INTERVAL '24 hours',
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [pedidoId]
    );
    return updated.rows[0];
  });
}

export async function releaseOrderReservation(pedidoId) {
  return withTransaction(async (client) => {
    const orderResult = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [pedidoId]);
    const order = orderResult.rows[0];
    if (!order || !order.estoque_reservado) return order;

    const itemsResult = await client.query(
      'SELECT produto_id, quantidade FROM itens_pedido WHERE pedido_id = $1',
      [pedidoId]
    );

    for (const item of itemsResult.rows) {
      await client.query(
        `UPDATE produtos
         SET estoque_reservado = GREATEST(estoque_reservado - $1, 0), atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [item.quantidade, item.produto_id]
      );
    }

    const updated = await client.query(
      `UPDATE pedidos
       SET estoque_reservado = FALSE, reserva_expira_em = NULL, atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [pedidoId]
    );
    return updated.rows[0];
  });
}

export async function approveOrderPayment(pedidoId, payment = {}) {
  return withTransaction(async (client) => {
    const orderResult = await client.query('SELECT * FROM pedidos WHERE id = $1 FOR UPDATE', [pedidoId]);
    const order = orderResult.rows[0];
    if (!order) throw new Error('Pedido não encontrado.');

    if (order.pagamento_status === 'approved' && ['confirmado', 'em_separacao', 'saiu_para_entrega', 'finalizado'].includes(order.status)) {
      return order;
    }

    const itemsResult = await client.query(
      'SELECT produto_id, quantidade FROM itens_pedido WHERE pedido_id = $1',
      [pedidoId]
    );

    for (const item of itemsResult.rows) {
      const productResult = await client.query(
        'SELECT id, nome, estoque, estoque_reservado FROM produtos WHERE id = $1 FOR UPDATE',
        [item.produto_id]
      );
      const product = productResult.rows[0];
      if (!product) throw new Error(`Produto ${item.produto_id} não encontrado.`);

      if (order.estoque_reservado) {
        if (Number(product.estoque) < Number(item.quantidade)) {
          throw new Error(`Estoque físico insuficiente para concluir ${product.nome}.`);
        }
        await client.query(
          `UPDATE produtos
           SET estoque = estoque - $1,
               estoque_reservado = GREATEST(estoque_reservado - $1, 0),
               atualizado_em = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [item.quantidade, item.produto_id]
        );
      } else {
        const disponivel = Number(product.estoque) - Number(product.estoque_reservado || 0);
        if (disponivel < Number(item.quantidade)) {
          await client.query(
            `UPDATE pedidos SET status = 'revisao_estoque', pagamento_status = 'approved', atualizado_em = CURRENT_TIMESTAMP WHERE id = $1`,
            [pedidoId]
          );
          throw new Error(`Pagamento aprovado, mas o estoque de ${product.nome} precisa de revisão manual.`);
        }
        await client.query(
          `UPDATE produtos SET estoque = estoque - $1, atualizado_em = CURRENT_TIMESTAMP WHERE id = $2`,
          [item.quantidade, item.produto_id]
        );
      }
    }

    const updated = await client.query(
      `UPDATE pedidos
       SET status = CASE WHEN status IN ('em_separacao','saiu_para_entrega','finalizado') THEN status ELSE 'confirmado' END,
           pagamento_status = 'approved',
           pagamento_metodo = COALESCE($2, pagamento_metodo),
           pagamento_id = COALESCE($3, pagamento_id),
           estoque_reservado = FALSE,
           reserva_expira_em = NULL,
           pago_em = COALESCE(pago_em, CURRENT_TIMESTAMP),
           payment_attempt_key = NULL,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [pedidoId, payment.payment_method_id || null, payment.id ? String(payment.id) : null]
    );
    return updated.rows[0];
  });
}

export async function syncOrderPaymentStatus(pedidoId, payment) {
  const status = payment?.status || 'pending';

  if (status === 'approved') {
    return approveOrderPayment(pedidoId, payment);
  }

  if (['rejected', 'cancelled'].includes(status)) {
    await releaseOrderReservation(pedidoId);
    const orderStatus = status === 'rejected' ? 'pagamento_recusado' : 'cancelado';
    const result = await query(
      `UPDATE pedidos
       SET status = $2, pagamento_status = $3,
           pagamento_metodo = COALESCE($4, pagamento_metodo),
           pagamento_id = COALESCE($5, pagamento_id),
           payment_attempt_key = NULL,
           atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [pedidoId, orderStatus, status, payment.payment_method_id || null, payment.id ? String(payment.id) : null]
    );
    return result.rows[0];
  }

  if (['refunded', 'charged_back'].includes(status)) {
    const result = await query(
      `UPDATE pedidos
       SET status = $2, pagamento_status = $3,
           pagamento_id = COALESCE($4, pagamento_id), atualizado_em = CURRENT_TIMESTAMP
       WHERE id = $1 RETURNING *`,
      [pedidoId, status === 'refunded' ? 'reembolsado' : 'chargeback', status, payment.id ? String(payment.id) : null]
    );
    return result.rows[0];
  }

  const result = await query(
    `UPDATE pedidos
     SET status = CASE WHEN status IN ('confirmado','em_separacao','saiu_para_entrega','finalizado') THEN status ELSE 'aguardando_pagamento' END,
         pagamento_status = $2,
         pagamento_metodo = COALESCE($3, pagamento_metodo),
         pagamento_id = COALESCE($4, pagamento_id),
         atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $1 RETURNING *`,
    [pedidoId, status, payment?.payment_method_id || null, payment?.id ? String(payment.id) : null]
  );
  return result.rows[0];
}

export async function releaseExpiredReservations() {
  const result = await query(
    `SELECT id FROM pedidos
     WHERE estoque_reservado = TRUE
       AND reserva_expira_em IS NOT NULL
       AND reserva_expira_em < CURRENT_TIMESTAMP
       AND pagamento_status <> 'approved'`
  );

  for (const row of result.rows) {
    try {
      await releaseOrderReservation(row.id);
      await query(
        `UPDATE pedidos
         SET status = CASE WHEN pagamento_status IN ('pending','in_process') THEN 'pagamento_expirado' ELSE status END,
             atualizado_em = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [row.id]
      );
    } catch (error) {
      console.error(`Erro ao liberar reserva do pedido ${row.id}:`, error.message);
    }
  }
}
