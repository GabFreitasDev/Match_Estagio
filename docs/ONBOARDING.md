# Onboarding: conectar ao banco do time

O banco fica na nuvem (Neon). Ninguém precisa instalar PostgreSQL.

## Passo a passo
1. Instale o Node.js 18+ e confira com `node -v`.
2. Clone o repositório.
3. Na pasta do projeto, crie o `.env`:
   - Windows (PowerShell): `copy .env.example .env`
   - Mac/Linux: `cp .env.example .env`
4. Abra o `.env` e cole a `DATABASE_URL` completa recebida no privado, **sem alterar nada dentro dela** (usuário e senha já estão na URL).
5. Troque o `JWT_SECRET` por um texto longo (para gerar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
6. `npm install` e depois `npm run dev`.
7. Abra `http://localhost:3000/saude` (deve mostrar `{"ok":true}`) e `http://localhost:3000/habilidades` (lista de habilidades).

O terminal do `npm run dev` fica ocupado enquanto a API roda. Para parar: `Ctrl+C`.
Se mudar o `.env`, pare e rode `npm run dev` de novo.

## Testando no PowerShell (Windows)
```powershell
$body = @{ email = 'teste@empresa.com'; senha = 'senha1234'; tipo = 'EMPRESA' } | ConvertTo-Json
$r = Invoke-RestMethod -Method Post -Uri http://127.0.0.1:3000/auth/login -ContentType 'application/json' -Body $body
$h = @{ Authorization = "Bearer $($r.token)" }
Invoke-RestMethod -Uri http://127.0.0.1:3000/vagas/minhas -Headers $h
```
Dica: a extensão **Thunder Client** do VS Code monta essas requisições sem se preocupar com aspas.

## Ver o banco no pgAdmin (opcional)
*Add New Server*: Host e Database vêm da `DATABASE_URL` (`postgresql://usuario:senha@HOST/BANCO`), Port `5432`, Username e Password os da URL, e na aba **SSL** use `Require`.

## Problemas comuns
| Sintoma | Causa provável |
|---|---|
| `Defina JWT_SECRET no .env` | `.env` fora da raiz do projeto ou com nome errado (`.env.txt`) |
| `Cannot find module ...` | Faltou `npm install` |
| `{"erro":"Rota não encontrada."}` em `/` | Normal: a raiz não tem rota. Use `/saude` ou `/habilidades` |
| `{"erro":"Erro interno do servidor."}` | Veja a mensagem real no terminal do `npm run dev` |
| Erro de conexão / `ECONNREFUSED` / timeout | `DATABASE_URL` errada, ou sem internet |
| Erro citando `channel_binding` | Apague `&channel_binding=require` do fim da URL |
| Primeira requisição demora alguns segundos | O banco gratuito pode suspender sem uso; a seguinte é rápida |
| `Token ausente` no PowerShell | A variável `$h` está vazia: refaça o login na mesma janela |

## Regras do banco compartilhado
- **Não rodar** `npm run db:reset` (apaga tudo) sem combinar com o grupo.
- Mudanças em tabelas: avisar a Frente 1 e registrar em `db/schema.sql`.
- Não usar dados pessoais reais nos testes.
- Nunca subir o `.env` nem colar a `DATABASE_URL` em lugar público.
