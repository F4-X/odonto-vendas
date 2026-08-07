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
  max: Number(process.env.PGPOOL_MAX || 10),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
  ssl: String(process.env.PGSSL || 'false').toLowerCase() === 'true'
    ? { rejectUnauthorized: false }
    : false
});

pool.on('error', (error) => {
  console.error('Erro inesperado no pool PostgreSQL:', error);
});

export function query(sql, params = []) {
  return pool.query(sql, params);
}

export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function closeDB() {
  await pool.end();
}

export async function initDB() {
  await createTables();
  await runMigrations();
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
      preco NUMERIC(12,2),
      tipo_venda TEXT NOT NULL CHECK (tipo_venda IN ('preco_fixo', 'orcamento')),
      estoque INTEGER DEFAULT 0,
      estoque_reservado INTEGER DEFAULT 0,
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
      email TEXT,
      cpf TEXT,
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
      total NUMERIC(12,2) DEFAULT 0,
      status TEXT DEFAULT 'aguardando_pagamento',
      pagamento_status TEXT DEFAULT 'pending',
      pagamento_metodo TEXT,
      pagamento_id TEXT,
      checkout_token TEXT UNIQUE,
      payment_attempt_key TEXT,
      estoque_reservado BOOLEAN DEFAULT FALSE,
      reserva_expira_em TIMESTAMP,
      observacoes TEXT,
      pago_em TIMESTAMP,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS itens_pedido (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER REFERENCES pedidos(id) ON DELETE CASCADE,
      produto_id INTEGER REFERENCES produtos(id),
      quantidade INTEGER NOT NULL CHECK (quantidade > 0),
      preco_unitario NUMERIC(12,2) NOT NULL
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
      quantidade INTEGER DEFAULT 1 CHECK (quantidade > 0)
    );
  `);

  await query(`
    CREATE TABLE IF NOT EXISTS pagamentos (
      id SERIAL PRIMARY KEY,
      pedido_id INTEGER NOT NULL REFERENCES pedidos(id) ON DELETE CASCADE,
      gateway TEXT NOT NULL DEFAULT 'mercadopago',
      gateway_payment_id TEXT UNIQUE,
      status TEXT,
      status_detail TEXT,
      payment_method_id TEXT,
      payment_type_id TEXT,
      installments INTEGER,
      transaction_amount NUMERIC(12,2),
      idempotency_key TEXT,
      qr_code TEXT,
      qr_code_base64 TEXT,
      raw_response JSONB,
      criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

async function runMigrations() {
  const statements = [
    `ALTER TABLE produtos ADD COLUMN IF NOT EXISTS estoque_reservado INTEGER DEFAULT 0`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS email TEXT`,
    `ALTER TABLE clientes ADD COLUMN IF NOT EXISTS cpf TEXT`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagamento_status TEXT DEFAULT 'pending'`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagamento_metodo TEXT`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pagamento_id TEXT`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS checkout_token TEXT`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS payment_attempt_key TEXT`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS estoque_reservado BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS reserva_expira_em TIMESTAMP`,
    `ALTER TABLE pedidos ADD COLUMN IF NOT EXISTS pago_em TIMESTAMP`,
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_pedidos_checkout_token ON pedidos(checkout_token) WHERE checkout_token IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS idx_pedidos_pagamento_status ON pedidos(pagamento_status)`,
    `CREATE INDEX IF NOT EXISTS idx_pagamentos_pedido ON pagamentos(pedido_id)`,
    `CREATE INDEX IF NOT EXISTS idx_produtos_ativo_categoria ON produtos(ativo, categoria_id)`
  ];

  for (const statement of statements) {
    await query(statement);
  }
}

async function seedInitialData() {
  const adminEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME?.trim() || 'Administrador';

  const adminCount = await query('SELECT COUNT(*) AS total FROM usuarios');
  if (Number(adminCount.rows[0].total) === 0) {
    if (adminEmail && adminPassword && adminPassword.length >= 10) {
      const senhaHash = await bcrypt.hash(adminPassword, 12);
      await query(
        'INSERT INTO usuarios (nome, email, senha, role) VALUES ($1, $2, $3, $4)',
        [adminName, adminEmail, senhaHash, 'admin']
      );
      console.log(`Administrador inicial criado para ${adminEmail}.`);
    } else {
      console.warn('Nenhum usuário admin existe. Defina ADMIN_EMAIL e ADMIN_PASSWORD (mínimo 10 caracteres) no .env e reinicie uma vez.');
    }
  }

  const catCount = await query('SELECT COUNT(*) AS total FROM categorias');
  if (Number(catCount.rows[0].total) === 0) {
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
      await query('INSERT INTO categorias (nome, descricao) VALUES ($1, $2)', [nome, descricao]);
    }
  }
}
