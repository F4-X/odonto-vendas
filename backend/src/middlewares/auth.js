import jwt from 'jsonwebtoken';

function jwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 24) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET precisa estar configurado com pelo menos 24 caracteres.');
    }
    return 'dev-only-secret-change-this-123456789';
  }
  return secret;
}

export function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token não informado.' });
  }

  const token = header.slice(7).trim();
  try {
    req.user = jwt.verify(token, jwtSecret());
    return next();
  } catch {
    return res.status(401).json({ message: 'Token inválido ou expirado.' });
  }
}

export { jwtSecret };
