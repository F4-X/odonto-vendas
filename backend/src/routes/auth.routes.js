import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';
import { auth, jwtSecret } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const attempts = new Map();

function loginKey(req, email) {
  return `${req.ip}:${String(email || '').toLowerCase()}`;
}

function blocked(key) {
  const entry = attempts.get(key);
  if (!entry) return false;
  if (entry.until && entry.until > Date.now()) return true;
  if (entry.until) attempts.delete(key);
  return false;
}

function fail(key) {
  const current = attempts.get(key) || { count: 0, until: null };
  current.count += 1;
  if (current.count >= 5) {
    current.until = Date.now() + 10 * 60 * 1000;
    current.count = 0;
  }
  attempts.set(key, current);
}

router.post('/login', asyncHandler(async (req, res) => {
  const email = String(req.body.email || '').trim().toLowerCase();
  const senha = String(req.body.senha || '');
  if (!email || !senha) return res.status(400).json({ message: 'Informe e-mail e senha.' });

  const key = loginKey(req, email);
  if (blocked(key)) return res.status(429).json({ message: 'Muitas tentativas. Tente novamente em alguns minutos.' });

  const result = await query('SELECT * FROM usuarios WHERE LOWER(email) = $1 AND ativo = TRUE', [email]);
  const usuario = result.rows[0];
  if (!usuario || !(await bcrypt.compare(senha, usuario.senha))) {
    fail(key);
    return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
  }

  attempts.delete(key);
  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role },
    jwtSecret(),
    { expiresIn: '8h' }
  );

  res.json({
    token,
    usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role }
  });
}));

router.get('/me', auth, asyncHandler(async (req, res) => {
  const result = await query(
    'SELECT id, nome, email, role FROM usuarios WHERE id = $1 AND ativo = TRUE',
    [req.user.id]
  );
  if (!result.rows[0]) return res.status(404).json({ message: 'Usuário não encontrado.' });
  res.json(result.rows[0]);
}));

export default router;
