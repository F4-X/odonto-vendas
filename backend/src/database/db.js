import dotenv from 'dotenv';
import bcrypt from 'bcryptjs';
import pkg from 'pg';

dotenv.config();

const { Pool } = pkg;

const pool = new Pool({
  host: process.env.PGHOST || '127.0.0.1',
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl:
    String(process.env.PGSSL || 'false').toLowerCase() === 'true'
      ? { rejectUnauthorized: false }
      : false
});

export async function query(sql, params = []) {
  return pool.query(sql, params);
}

export async function closeDB() {
  await pool.end();
}

export async function initDB() {
  await createTables();
  await seedInitialData();
}

async function createTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      senha TEXT NOT NULL,
      role TEXT DEFAULT 'admin',
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS categorias (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      ativo BOOLEAN DEFAULT TRUE,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS produtos (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      descricao TEXT,
      marca TEXT,
      modelo TEXT,
      categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
      preco NUMERIC(10,2),
      tipo_venda TEXT NOT NULL CHECK (tipo_venda IN ('preco_fixo', 'orcamento')),
      estoque INTEGER DEFAULT 0,
      imagem TEXT,
      ativo BOOLEAN DEFAULT TRUE,
      destaque BOOLEAN DEFAULT FALSE,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS clientes (
      id SERIAL PRIMARY KEY,
      nome TEXT NOT NULL,
      whatsapp TEXT NOT NULL,
      cidade TEXT,
      estado TEXT,
      endereco TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pedidos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id),
      total NUMERIC(10,2) DEFAULT 0,
      status TEXT DEFAULT 'pendente',
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id),
      quantidade INTEGER NOT NULL,
      preco_unitario NUMERIC(10,2) NOT NULL
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS orcamentos (
      id SERIAL PRIMARY KEY,
      cliente_id INTEGER REFERENCES clientes(id),
      status TEXT DEFAULT 'pendente',
      observacoes TEXT,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS itens_orcamento (
      id SERIAL PRIMARY KEY,
      orcamento_id INTEGER REFERENCES orcamentos(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id),
      quantidade INTEGER DEFAULT 1
    );
  `);
}

async function seedInitialData() {
  const adminCount = await query(
    'SELECT COUNT(*) AS total FROM usuarios WHERE email = $1',
    ['admin@odontek.com.br']
  );

  if (Number(adminCount.rows[0].count || adminCount.rows[0].total) === 0) {
    const senhaHash = await bcrypt.hash('admin123', 10);

    await query(
      'INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4)',
      ['Administrador', 'admin@odontek.com.br', senhaHash, 'admin']
    );
  }

  const catCount = await query('SELECT COUNT(*) AS total FROM categorias');

  if (Number(catCount.rows[0].count || catCount.rows[0].total) === 0) {
    const categorias = [
      ['Consultórios / Cadeiras', 'Cadeiras odontológicas, consultórios completos e conjuntos de atendimento.'],
      ['Peças de mão', 'Canetas de alta rotação, contra-ângulos, micromotores e peças retas.'],
      ['Esterilização', 'Autoclaves, seladoras e itens para biossegurança.'],
      ['Raio-X', 'Equipamentos de imagem e acessórios radiológicos.'],
      ['Compressores', 'Compressores odontológicos e acessórios.'],
      ['Kits acadêmicos', 'Kits e materiais para estudantes de odontologia.'],
      ['Produtos odontológicos', 'Materiais de consumo e produtos para clínicas.'],
      ['Acessórios', 'Itens de apoio para consultórios e manutenção.']
    ];

    for (const [nome, descricao] of categorias) {
      await query(
        'INSERT INTO categorias (nome, descricao) VALUES ($1, $2)',
        [nome, descricao]
      );
    }
  }

  const prodCount = await query('SELECT COUNT(*) AS total FROM produtos');

  if (Number(prodCount.rows[0].count || prodCount.rows[0].total) === 0) {
    const categoriasRows = await query('SELECT id, nome FROM categorias');

    const categoriaId = Object.fromEntries(
      categoriasRows.rows.map((c) => [c.nome, c.id])
    );

    const produtos = [
      {
        nome: 'Cadeira odontológica completa',
        descricao: 'Consultório odontológico completo para clínicas que buscam conforto, tecnologia e alta durabilidade.',
        marca: 'Linha Premium',
        modelo: 'Consultório Completo',
        categoria: 'Consultórios / Cadeiras',
        preco: null,
        tipo_venda: 'orcamento',
        estoque: 2,
        destaque: true
      },
      {
        nome: 'Caneta de alta rotação',
        descricao: 'Caneta de alta rotação indicada para procedimentos clínicos.',
        marca: 'Odonto Pro',
        modelo: 'Alta 400',
        categoria: 'Peças de mão',
        preco: 449.90,
        tipo_venda: 'preco_fixo',
        estoque: 12,
        destaque: true
      },
      {
        nome: 'Contra-ângulo odontológico',
        descricao: 'Contra-ângulo para uso clínico.',
        marca: 'Odonto Pro',
        modelo: 'CA 1:1',
        categoria: 'Peças de mão',
        preco: 389.90,
        tipo_venda: 'preco_fixo',
        estoque: 8,
        destaque: false
      },
      {
        nome: 'Autoclave odontológica 21L',
        descricao: 'Autoclave para esterilização.',
        marca: 'BioClean',
        modelo: '21L Digital',
        categoria: 'Esterilização',
        preco: null,
        tipo_venda: 'orcamento',
        estoque: 3,
        destaque: true
      }
    ];

    for (const produto of produtos) {
      await query(
        `INSERT INTO produtos
          (nome, descricao, marca, modelo, categoria_id, preco, tipo_venda, estoque, imagem, ativo, destaque)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)`,
        [
          produto.nome,
          produto.descricao,
          produto.marca,
          produto.modelo,
          categoriaId[produto.categoria],
          produto.preco,
          produto.tipo_venda,
          produto.estoque,
          null,
          produto.destaque
        ]
      );
    }
  }
}