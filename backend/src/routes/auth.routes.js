import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../database/db.js';
import { auth } from '../middlewares/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.post('/login', asyncHandler(async (req, res) => {
  const { email, senha } = req.body;

  if (!email || !senha) {
    return res.status(400).json({ message: 'Informe e-mail e senha.' });
  }

  const result = await query('SELECT * FROM usuarios WHERE email = $1 AND ativo = TRUE', [email]);
  const usuario = result.rows[0];

  if (!usuario) {
    return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
  }

  const senhaOk = await bcrypt.compare(senha, usuario.senha);
  if (!senhaOk) {
    return res.status(401).json({ message: 'E-mail ou senha inválidos.' });
  }

  const token = jwt.sign(
    { id: usuario.id, nome: usuario.nome, email: usuario.email, role: usuario.role },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '8h' }
  );

  return res.json({
    token,
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      role: usuario.role
    }
  });
}));

router.get('/me', auth, asyncHandler(async (req, res) => {
  const result = await query('SELECT id, nome, email, role FROM usuarios WHERE id = $1 AND ativo = TRUE', [req.user.id]);
  if (!result.rows[0]) {
    return res.status(404).json({ message: 'Usuário não encontrado.' });
  }
  return res.json(result.rows[0]);
}));

export default router;
