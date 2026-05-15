import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

const dataDir = path.resolve(process.cwd(), process.env.PGLITE_DATA_DIR || './data/pglite');

if (fs.existsSync(dataDir)) {
  fs.rmSync(dataDir, { recursive: true, force: true });
  console.log(`Banco local removido: ${dataDir}`);
} else {
  console.log(`Nenhum banco local encontrado em: ${dataDir}`);
}

console.log('Ao iniciar novamente, o sistema recria tabelas, categorias, produtos de exemplo e usuário admin.');
