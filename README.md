# MatchEstágio – Back-end

API de cadastro/login, habilidades e vagas (Frente 1 da Sprint 1).
Node.js + Express + PostgreSQL (banco do time hospedado no Neon).

## Entrar no projeto (cada integrante)

1. Instale o **Node.js 18+** (nodejs.org, versão LTS).
2. Clone o repositório e entre na pasta.
3. Copie `.env.example` para `.env` e cole a `DATABASE_URL` que o responsável da Frente 1 enviou **no privado**.
   Troque também o `JWT_SECRET` por qualquer texto longo.
4. Rode:
   ```bash
   npm install
   npm run dev
   ```
5. Teste: abra `http://localhost:3000/habilidades`. Deve listar as habilidades.

> **Não rode `npm run db:init`.** As tabelas já existem no banco compartilhado.
> Ele é protegido (não altera banco que já tem tabelas), mas `npm run db:reset` **apaga tudo**: só use com combinação do grupo.

Mais detalhes e solução de problemas: [`docs/ONBOARDING.md`](docs/ONBOARDING.md).
Contrato das rotas: [`docs/API.md`](docs/API.md).

## Estrutura

```
db/schema.sql              modelo de dados v2 (10 tabelas, restrições, índices, carga de habilidades)
scripts/init-db.js         criação do banco (db:init) e reset (db:reset)
src/app.js                 rotas e tratamento de erros
src/db.js                  conexão com o PostgreSQL
src/middleware/auth.js     JWT: auth('EMPRESA'|'CANDIDATO'), authOpcional
src/routes/auth.js         cadastro e login
src/routes/habilidades.js  listagem (CRUD completo é da Frente 2)
src/routes/vagas.js        UC07: publicar, editar, status, listar com filtros
docs/API.md                contrato da API (Frentes 2, 3 e 4)
docs/ONBOARDING.md         passo a passo para conectar e resolver erros comuns
```

## Para as outras frentes
- Use `src/db.js` para acessar o banco e `src/middleware/auth.js` para proteger rotas.
- Em rota autenticada, `req.user = { id, tipo }`.
- Erros seguem `{ "erro": "mensagem" }` (validação traz também `detalhes`).
- Mudanças no schema: combinar com a Frente 1 e registrar em `db/schema.sql`.
