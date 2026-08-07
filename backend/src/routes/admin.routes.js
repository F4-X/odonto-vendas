import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { query } from '../database/db.js';
import { auth } from '../middlewares/auth.js';
import { upload } from '../middlewares/upload.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { releaseOrderReservation } from '../services/orderService.js';

const router = Router();
router.use(auth);

const pedidoStatus = ['pendente', 'aguardando_pagamento', 'pagamento_recusado', 'pagamento_expirado', 'revisao_estoque', 'confirmado', 'em_separacao', 'saiu_para_entrega', 'finalizado', 'cancelado', 'reembolsado', 'chargeback'];
const orcamentoStatus = ['pendente', 'em_atendimento', 'enviado', 'aprovado', 'recusado', 'cancelado'];

function toBoolean(value) {
  return value === true || value === 'true' || value === '1' || value === 1 || value === 'on';
}

function parsePrice(value, tipoVenda) {
  if (tipoVenda === 'orcamento') return null;
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(String(value).replace(',', '.'));
  return Number.isNaN(parsed) ? null : parsed;
}


router.put('/minha-senha', asyncHandler(async (req, res) => {
  const senhaAtual = String(req.body.senha_atual || '');
  const novaSenha = String(req.body.nova_senha || '');
  if (!senhaAtual || novaSenha.length < 10) {
    return res.status(400).json({ message: 'Informe a senha atual e uma nova senha com pelo menos 10 caracteres.' });
  }

  const result = await query('SELECT senha FROM usuarios WHERE id = $1 AND ativo = TRUE', [req.user.id]);
  const usuario = result.rows[0];
  if (!usuario || !(await bcrypt.compare(senhaAtual, usuario.senha))) {
    return res.status(401).json({ message: 'Senha atual incorreta.' });
  }

  const hash = await bcrypt.hash(novaSenha, 12);
  await query('UPDATE usuarios SET senha = $1 WHERE id = $2', [hash, req.user.id]);
  res.json({ message: 'Senha alterada com sucesso.' });
}));

router.get('/dashboard', asyncHandler(async (_req, res) => {
  const [produtos, categorias, pedidos, orcamentos, vendas, pendentes] = await Promise.all([
    query('SELECT COUNT(*) AS total FROM produtos WHERE ativo = TRUE'),
    query('SELECT COUNT(*) AS total FROM categorias WHERE ativo = TRUE'),
    query('SELECT COUNT(*) AS total FROM pedidos'),
    query('SELECT COUNT(*) AS total FROM orcamentos'),
    query("SELECT COALESCE(SUM(total), 0) AS total FROM pedidos WHERE pagamento_status = 'approved'"),
    query("SELECT COUNT(*) AS total FROM pedidos WHERE status IN ('aguardando_pagamento','confirmado','em_separacao')")
  ]);

  res.json({
    produtos: Number(produtos.rows[0].total),
    categorias: Number(categorias.rows[0].total),
    pedidos: Number(pedidos.rows[0].total),
    orcamentos: Number(orcamentos.rows[0].total),
    vendas: Number(vendas.rows[0].total),
    pedidos_pendentes: Number(pendentes.rows[0].total)
  });
}));

router.get('/categorias', asyncHandler(async (_req, res) => {
  const result = await query('SELECT * FROM categorias ORDER BY ativo DESC, nome ASC');
  res.json(result.rows);
}));

router.post('/categorias', asyncHandler(async (req, res) => {
  const { nome, descricao } = req.body;
  if (!nome) {
    return res.status(400).json({ message: 'Nome da categoria é obrigatório.' });
  }

  const result = await query(
    `INSERT INTO categorias (nome, descricao, ativo)
     VALUES ($1, $2, TRUE)
     RETURNING *`,
    [nome, descricao || '']
  );
  res.status(201).json(result.rows[0]);
}));

router.put('/categorias/:id', asyncHandler(async (req, res) => {
  const { nome, descricao, ativo } = req.body;
  if (!nome) {
    return res.status(400).json({ message: 'Nome da categoria é obrigatório.' });
  }

  const result = await query(
    `UPDATE categorias
     SET nome = $1, descricao = $2, ativo = $3, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $4
     RETURNING *`,
    [nome, descricao || '', toBoolean(ativo), Number(req.params.id)]
  );

  if (!result.rows[0]) return res.status(404).json({ message: 'Categoria não encontrada.' });
  res.json(result.rows[0]);
}));

router.delete('/categorias/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE categorias
     SET ativo = FALSE, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [Number(req.params.id)]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Categoria não encontrada.' });
  res.json({ message: 'Categoria desativada.' });
}));

router.get('/produtos', asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT p.*, c.nome AS categoria_nome,
            GREATEST(p.estoque - COALESCE(p.estoque_reservado, 0), 0) AS estoque_disponivel
     FROM produtos p
     LEFT JOIN categorias c ON c.id = p.categoria_id
     ORDER BY p.ativo DESC, p.destaque DESC, p.nome ASC`
  );
  res.json(result.rows);
}));

router.post('/produtos', upload.single('imagem'), asyncHandler(async (req, res) => {
  const { nome, descricao, marca, modelo, categoria_id, preco, tipo_venda, estoque, destaque, ativo } = req.body;

  if (!nome || !tipo_venda) {
    return res.status(400).json({ message: 'Nome e tipo de venda são obrigatórios.' });
  }

  if (!['preco_fixo', 'orcamento'].includes(tipo_venda)) {
    return res.status(400).json({ message: 'Tipo de venda inválido.' });
  }

  const imagem = req.file ? `/api/uploads/${req.file.filename}` : null;
  const result = await query(
    `INSERT INTO produtos
      (nome, descricao, marca, modelo, categoria_id, preco, tipo_venda, estoque, imagem, ativo, destaque)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
     RETURNING *`,
    [
      nome,
      descricao || '',
      marca || '',
      modelo || '',
      categoria_id ? Number(categoria_id) : null,
      parsePrice(preco, tipo_venda),
      tipo_venda,
      Number(estoque || 0),
      imagem,
      ativo === undefined ? true : toBoolean(ativo),
      toBoolean(destaque)
    ]
  );

  res.status(201).json(result.rows[0]);
}));

router.put('/produtos/:id', upload.single('imagem'), asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const atualResult = await query('SELECT * FROM produtos WHERE id = $1', [id]);
  const atual = atualResult.rows[0];

  if (!atual) {
    return res.status(404).json({ message: 'Produto não encontrado.' });
  }

  const { nome, descricao, marca, modelo, categoria_id, preco, tipo_venda, estoque, destaque, ativo } = req.body;
  const tipoVendaFinal = tipo_venda || atual.tipo_venda;

  if (!['preco_fixo', 'orcamento'].includes(tipoVendaFinal)) {
    return res.status(400).json({ message: 'Tipo de venda inválido.' });
  }

  const imagem = req.file ? `/api/uploads/${req.file.filename}` : atual.imagem;
  const result = await query(
    `UPDATE produtos
     SET nome = $1,
         descricao = $2,
         marca = $3,
         modelo = $4,
         categoria_id = $5,
         preco = $6,
         tipo_venda = $7,
         estoque = $8,
         imagem = $9,
         ativo = $10,
         destaque = $11,
         atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $12
     RETURNING *`,
    [
      nome || atual.nome,
      descricao ?? atual.descricao,
      marca ?? atual.marca,
      modelo ?? atual.modelo,
      categoria_id ? Number(categoria_id) : atual.categoria_id,
      parsePrice(preco, tipoVendaFinal),
      tipoVendaFinal,
      estoque !== undefined ? Number(estoque) : atual.estoque,
      imagem,
      ativo === undefined ? atual.ativo : toBoolean(ativo),
      destaque === undefined ? atual.destaque : toBoolean(destaque),
      id
    ]
  );

  res.json(result.rows[0]);
}));

router.delete('/produtos/:id', asyncHandler(async (req, res) => {
  const result = await query(
    `UPDATE produtos
     SET ativo = FALSE, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [Number(req.params.id)]
  );

  if (!result.rows[0]) return res.status(404).json({ message: 'Produto não encontrado.' });
  res.json({ message: 'Produto desativado.' });
}));

router.get('/pedidos', asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT p.*, c.nome AS cliente_nome, c.whatsapp, c.cidade, c.estado,
            COUNT(ip.id) AS total_itens
     FROM pedidos p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     LEFT JOIN itens_pedido ip ON ip.pedido_id = p.id
     GROUP BY p.id, c.nome, c.whatsapp, c.cidade, c.estado
     ORDER BY p.criado_em DESC`
  );
  res.json(result.rows);
}));

router.get('/pedidos/:id', asyncHandler(async (req, res) => {
  const pedidoResult = await query(
    `SELECT p.*, c.nome AS cliente_nome, c.email, c.cpf, c.whatsapp, c.cidade, c.estado, c.endereco
     FROM pedidos p
     LEFT JOIN clientes c ON c.id = p.cliente_id
     WHERE p.id = $1`,
    [Number(req.params.id)]
  );

  if (!pedidoResult.rows[0]) return res.status(404).json({ message: 'Pedido não encontrado.' });

  const itensResult = await query(
    `SELECT ip.*, pr.nome AS produto_nome, pr.imagem, pr.marca, pr.modelo
     FROM itens_pedido ip
     LEFT JOIN produtos pr ON pr.id = ip.produto_id
     WHERE ip.pedido_id = $1
     ORDER BY ip.id ASC`,
    [Number(req.params.id)]
  );

  const pagamentosResult = await query(
    `SELECT gateway_payment_id, status, status_detail, payment_method_id, payment_type_id, installments, transaction_amount, criado_em, atualizado_em
     FROM pagamentos WHERE pedido_id = $1 ORDER BY id DESC`,
    [Number(req.params.id)]
  );

  res.json({ ...pedidoResult.rows[0], itens: itensResult.rows, pagamentos: pagamentosResult.rows });
}));

router.put('/pedidos/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!pedidoStatus.includes(status)) {
    return res.status(400).json({ message: 'Status de pedido inválido.' });
  }

  const pedidoId = Number(req.params.id);
  if (status === 'cancelado') {
    const paymentCheck = await query('SELECT pagamento_status FROM pedidos WHERE id = $1', [pedidoId]);
    if (paymentCheck.rows[0]?.pagamento_status === 'approved') {
      return res.status(409).json({ message: 'Pedido pago não deve ser cancelado sem tratar o reembolso no Mercado Pago.' });
    }
    await releaseOrderReservation(pedidoId);
  }

  const result = await query(
    `UPDATE pedidos
     SET status = $1, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [status, pedidoId]
  );

  if (!result.rows[0]) return res.status(404).json({ message: 'Pedido não encontrado.' });
  res.json(result.rows[0]);
}));

router.get('/orcamentos', asyncHandler(async (_req, res) => {
  const result = await query(
    `SELECT o.*, c.nome AS cliente_nome, c.whatsapp, c.cidade, c.estado,
            COUNT(io.id) AS total_itens
     FROM orcamentos o
     LEFT JOIN clientes c ON c.id = o.cliente_id
     LEFT JOIN itens_orcamento io ON io.orcamento_id = o.id
     GROUP BY o.id, c.nome, c.whatsapp, c.cidade, c.estado
     ORDER BY o.criado_em DESC`
  );
  res.json(result.rows);
}));

router.get('/orcamentos/:id', asyncHandler(async (req, res) => {
  const orcamentoResult = await query(
    `SELECT o.*, c.nome AS cliente_nome, c.whatsapp, c.cidade, c.estado, c.endereco
     FROM orcamentos o
     LEFT JOIN clientes c ON c.id = o.cliente_id
     WHERE o.id = $1`,
    [Number(req.params.id)]
  );

  if (!orcamentoResult.rows[0]) return res.status(404).json({ message: 'Orçamento não encontrado.' });

  const itensResult = await query(
    `SELECT io.*, pr.nome AS produto_nome, pr.imagem, pr.marca, pr.modelo
     FROM itens_orcamento io
     LEFT JOIN produtos pr ON pr.id = io.produto_id
     WHERE io.orcamento_id = $1
     ORDER BY io.id ASC`,
    [Number(req.params.id)]
  );

  res.json({ ...orcamentoResult.rows[0], itens: itensResult.rows });
}));

router.put('/orcamentos/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!orcamentoStatus.includes(status)) {
    return res.status(400).json({ message: 'Status de orçamento inválido.' });
  }

  const result = await query(
    `UPDATE orcamentos
     SET status = $1, atualizado_em = CURRENT_TIMESTAMP
     WHERE id = $2
     RETURNING *`,
    [status, Number(req.params.id)]
  );

  if (!result.rows[0]) return res.status(404).json({ message: 'Orçamento não encontrado.' });
  res.json(result.rows[0]);
}));

export default router;
