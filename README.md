# Odonto Vendas

Sistema inicial de vendas para produtos odontológicos, com duas partes:

- **Site público do cliente**: vitrine de produtos, categorias, carrinho, pedido e solicitação de orçamento.
- **Área gerencial**: login administrativo, dashboard, cadastro de categorias, cadastro de produtos com imagem, pedidos e orçamentos.

## Stack

- Front-end: React + Vite
- Back-end: Node.js + Express
- Banco local inicial: PGlite
- Autenticação: JWT
- Upload de imagens: Multer

## Como rodar o backend

```bash
cd backend
npm install
cp .env.example .env
npm run dev
```

No Windows PowerShell, se o comando `cp` não funcionar, use:

```powershell
Copy-Item .env.example .env
```

Se aparecer erro do PGlite parecido com `RuntimeError: Aborted()` ou se a primeira inicialização foi interrompida, resete o banco local uma vez:

```bash
npm run reset-db
npm run dev
```

Evite iniciar dois backends ao mesmo tempo usando a mesma pasta `backend/data/pglite`.

O backend sobe em:

```txt
http://localhost:3001
```

## Como rodar o frontend

Em outro terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

No Windows PowerShell, se o comando `cp` não funcionar, use:

```powershell
Copy-Item .env.example .env
```

O frontend sobe em:

```txt
http://localhost:5173
```

## Acessos

Site público:

```txt
http://localhost:5173
```

Área gerencial:

```txt
http://localhost:5173/admin/login
```

Login inicial:

```txt
E-mail: admin@odontek.com.br
Senha: admin123
```

## Observações importantes

- O banco PGlite fica salvo localmente em `backend/data/pglite`.
- Imagens enviadas ficam em `backend/src/uploads`.
- Esta é uma primeira versão funcional para desenvolvimento local.
- Para produção, o ideal é migrar o banco para PostgreSQL real e configurar variáveis seguras no `.env`.

## Correção aplicada para desenvolvimento local

Esta versão usa `nodemon` ignorando a pasta do banco e dos uploads. Isso evita reinicializações enquanto o PGlite cria arquivos internos. Também atualizamos o PGlite para uma versão mais nova e adicionamos fechamento seguro do banco ao encerrar o backend.
