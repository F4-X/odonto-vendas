import multer from 'multer';
import path from 'path';
import fs from 'fs';

const uploadDir = path.join(process.cwd(), 'src', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });
const allowedExt = new Set(['.jpg', '.jpeg', '.png', '.webp']);
const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${allowedExt.has(ext) ? ext : '.img'}`);
  }
});

function fileFilter(_req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedMime.has(file.mimetype) || !allowedExt.has(ext)) {
    return cb(new Error('Envie apenas imagens JPG, PNG ou WEBP.'));
  }
  cb(null, true);
}

export const upload = multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } });
