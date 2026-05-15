import { Router } from 'express';
import { query } from '../database/db.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

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
    SELECT p.*, c.nome AS categoria_nome
    FROM produtos p
    LEFT JOIN categorias c ON c.id = p.categoria_id
    WHERE p.ativo = TRUE
  `;

  if (categoria_id) {
    params.push(Number(categoria_id));
    sql += ` AND p.categoria_id = $${params.length}`;
  }

  if (tipo_venda) {
    params.push(tipo_venda);
    sql += ` AND p.tipo_venda = $${params.length}`;
  }

  if (destaque === 'true') {
    sql += ' AND p.destaque = TRUE';
  }

  if (busca) {
    params.push(`%${busca}%`);
    sql += ` AND (LOWER(p.nome) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.descricao, '')) LIKE LOWER($${params.length}) OR LOWER(COALESCE(p.marca, '')) LIKE LOWER($${params.length}))`;
  }

  sql += ' ORDER BY p.destaque DESC, p.nome ASC';
  const result = await query(sql, params);
  res.json(result.rows);
}));

router.get('/produtos/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `SELECT p.*, c.nome AS categoria_nome
     FROM produtos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     WHERE p.id = $1 AND p.ativo = TRUE`,
    [Number(req.params.id)]
  );

  if (!result.rows[0]) {
    return res.status(404).json({ message: 'Produto não encontrado.' });
  }

  return res.json(result.rows[0]);
}));

router.post('/checkout', asyncHandler(async (req, res) => {
  const { cliente, itens, observacoes } = req.body;

  if (!cliente?.nome || !cliente?.whatsapp) {
    return res.status(400).json({ message: 'Informe nome e WhatsApp.' });
  }

  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ message: 'Adicione pelo menos um produto.' });
  }

  const itensNormalizados = itens.map((item) => ({
    produto_id: Number(item.produto_id),
    quantidade: Math.max(1, Number(item.quantidade || 1))
  })).filter((item) => Number.isInteger(item.produto_id) && item.produto_id > 0);

  if (itensNormalizados.length === 0) {
    return res.status(400).json({ message: 'Itens inválidos.' });
  }

  await query('BEGIN');

  try {
    const clienteResult = await query(
      `INSERT INTO clientes (nome, whatsapp, cidade, estado, endereco)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [cliente.nome, cliente.whatsapp, cliente.cidade || '', cliente.estado || '', cliente.endereco || '']
    );

    const clienteCriado = clienteResult.rows[0];
    const itensPedido = [];
    const itensOrcamento = [];

    for (const item of itensNormalizados) {
      const produtoResult = await query('SELECT * FROM produtos WHERE id = $1 AND ativo = TRUE', [item.produto_id]);
      const produto = produtoResult.rows[0];

      if (!produto) {
        throw new Error(`Produto ${item.produto_id} não encontrado.`);
      }

      if (produto.tipo_venda === 'preco_fixo') {
        itensPedido.push({ produto, quantidade: item.quantidade });
      } else {
        itensOrcamento.push({ produto, quantidade: item.quantidade });
      }
    }

    let pedido = null;
    let orcamento = null;

    if (itensPedido.length > 0) {
      const total = itensPedido.reduce((acc, item) => acc + Number(item.produto.preco || 0) * item.quantidade, 0);
      const pedidoResult = await query(
        `INSERT INTO pedidos (cliente_id, total, status, observacoes)
         VALUES ($1, $2, 'pendente', $3)
         RETURNING *`,
        [clienteCriado.id, total, observacoes || '']
      );
      pedido = pedidoResult.rows[0];

      for (const item of itensPedido) {
        await query(
          `INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario)
           VALUES ($1, $2, $3, $4)`,
          [pedido.id, item.produto.id, item.quantidade, item.produto.preco]
        );

        await query(
          `UPDATE produtos
           SET estoque = GREATEST(estoque - $1, 0), atualizado_em = CURRENT_TIMESTAMP
           WHERE id = $2`,
          [item.quantidade, item.produto.id]
        );
      }
    }

    if (itensOrcamento.length > 0) {
      const orcamentoResult = await query(
        `INSERT INTO orcamentos (cliente_id, status, observacoes)
         VALUES ($1, 'pendente', $2)
         RETURNING *`,
        [clienteCriado.id, observacoes || '']
      );
      orcamento = orcamentoResult.rows[0];

      for (const item of itensOrcamento) {
        await query(
          `INSERT INTO itens_orcamento (orcamento_id, produto_id, quantidade)
           VALUES ($1, $2, $3)`,
          [orcamento.id, item.produto.id, item.quantidade]
        );
      }
    }

    await query('COMMIT');

    return res.status(201).json({
      message: 'Solicitação enviada com sucesso.',
      cliente: clienteCriado,
      pedido,
      orcamento
    });
  } catch (error) {
    await query('ROLLBACK');
    throw error;
  }
}));

export default router;
