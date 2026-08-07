import { Router } from 'express';
import { randomUUID } from 'crypto';
import { query, withTransaction } from '../database/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

function normalizeItems(items) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item) => ({
      produto_id: Number(item.produto_id),
      quantidade: Math.max(1, Math.min(99, Number(item.quantidade || 1)))
    }))
    .filter((item) => Number.isInteger(item.produto_id) && item.produto_id > 0 && Number.isFinite(item.quantidade));
}

router.get('/categorias', asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT id, nome, descricao
     FROM categorias
     WHERE ativo = TRUE
     ORDER BY nome ASC`
  );
  res.json(result.rows);
}));

router.get('/produtos', asyncHandler(async (req, res) => {
  const { categoria_id, tipo_venda, busca, destaque } = req.query;
  const params = [];
  let sql = `
    SELECT p.*, c.nome AS categoria_nome,
           GREATEST(p.estoque - COALESCE(p.estoque_reservado, 0), 0) AS estoque_disponivel
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = TRUE
  `;

  if (categoria_id) {
    params.push(Number(categoria_id));
    sql += ` AND p.categoria_id = $${params.length}`;
  }
  if (tipo_venda && ['preco_fixo', 'orcamento'].includes(tipo_venda)) {
    params.push(tipo_venda);
    sql += ` AND p.tipo_venda = $${params.length}`;
  }
  if (destaque === 'true') sql += ' AND p.destaque = TRUE';
  if (busca) {
    params.push(`%${String(busca).trim()}%`);
    sql += ` AND (
      LOWER(p.nome) LIKE LOWER($${params.length}) OR
      LOWER(COALESCE(p.descricao, '')) LIKE LOWER($${params.length}) OR
      LOWER(COALESCE(p.marca, '')) LIKE LOWER($${params.length}) OR
      LOWER(COALESCE(p.modelo, '')) LIKE LOWER($${params.length})
    )`;
  }

  sql += ' ORDER BY p.destaque DESC, p.nome ASC';
  const result = await query(sql, params);
  res.json(result.rows);
}));

router.get('/produtos/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.*, c.nome AS categoria_nome,
            GREATEST(p.estoque - COALESCE(p.estoque_reservado, 0), 0) AS estoque_disponivel
     FROM produtos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.id = $1 AND p.ativo = TRUE`,
    [Number(req.params.id)]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Produto não encontrado.' });
  return res.json(result.rows[0]);
}));

router.post('/checkout', asyncHandler(async (req, res) => {
  const { cliente, itens, observacoes } = req.body;

  if (!cliente?.nome?.trim() || !cliente?.whatsapp?.trim()) {
    return res.status(400).json({ message: 'Informe nome e WhatsApp.' });
  }

  const itensNormalizados = normalizeItems(itens);
  if (itensNormalizados.length === 0) {
    return res.status(400).json({ message: 'Adicione pelo menos um produto válido.' });
  }

  const response = await withTransaction(async (client) => {
    const clienteResult = await client.query(
      `INSERT INTO clientes (nome, email, cpf, whatsapp, cidade, estado, endereco)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        cliente.nome.trim(),
        cliente.email?.trim().toLowerCase() || null,
        cliente.cpf?.trim() || null,
        cliente.whatsapp.trim(),
        cliente.cidade?.trim() || '',
        cliente.estado?.trim().toUpperCase() || '',
        cliente.endereco?.trim() || ''
      ]
    );

    const clienteCriado = clienteResult.rows[0];
    const itensPedido = [];
    const itensOrcamento = [];

    for (const item of itensNormalizados) {
      const produtoResult = await client.query(
        `SELECT *, GREATEST(estoque - COALESCE(estoque_reservado, 0), 0) AS estoque_disponivel
         FROM produtos WHERE id = $1 AND ativo = TRUE`,
        [item.produto_id]
      );
      const produto = produtoResult.rows[0];
      if (!produto) throw new Error(`Produto ${item.produto_id} não encontrado ou inativo.`);

      if (produto.tipo_venda === 'preco_fixo') {
        if (Number(produto.estoque_disponivel) < item.quantidade) {
          const error = new Error(`Estoque insuficiente para ${produto.nome}. Disponível: ${produto.estoque_disponivel}.`);
          error.statusCode = 409;
          throw error;
        }
        itensPedido.push({ produto, quantidade: item.quantidade });
      } else {
        itensOrcamento.push({ produto, quantidade: item.quantidade });
      }
    }

    let pedido = null;
    let orcamento = null;

    if (itensPedido.length > 0) {
      const total = itensPedido.reduce(
        (acc, item) => acc + Number(item.produto.preco || 0) * item.quantidade,
        0
      );
      const checkoutToken = randomUUID();
      const pedidoResult = await client.query(
        `INSERT INTO pedidos
          (cliente_id, total, status, pagamento_status, checkout_token, observacoes)
         VALUES ($1, $2, 'aguardando_pagamento', 'pending', $3, $4)
         RETURNING *`,
        [clienteCriado.id, total, checkoutToken, observacoes?.trim() || '']
      );
      pedido = pedidoResult.rows[0];

      for (const item of itensPedido) {
        await client.query(
          `INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
           VALUES ($1, $2, $3, $4)`,
          [pedido.id, item.produto.id, item.quantidade, item.produto.preco]
        );
      }
    }

    if (itensOrcamento.length > 0) {
      const orcamentoResult = await client.query(
        `INSERT INTO orcamentos (cliente_id, status, observacoes)
         VALUES ($1, 'pendente', $2)
         RETURNING *`,
        [clienteCriado.id, observacoes?.trim() || '']
      );
      orcamento = orcamentoResult.rows[0];

      for (const item of itensOrcamento) {
        await client.query(
          `INSERT INTO itens_orcamento (orcamento_id, produto_id, quantidade)
           VALUES ($1, $2, $3)`,
          [orcamento.id, item.produto.id, item.quantidade]
        );
      }
    }

    return {
      message: pedido ? 'Pedido criado. Finalize o pagamento.' : 'Solicitação de orçamento enviada.',
      cliente: clienteCriado,
      pedido,
      orcamento,
      pagamento_necessario: Boolean(pedido)
    };
  });

  res.status(201).json(response);
}));

export default router;
