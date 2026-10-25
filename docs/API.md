# Contrato da API – Frente 1

Base: `http://localhost:3000`. Corpo em JSON. Rotas protegidas usam o cabeçalho
`Authorization: Bearer <token>` (token devolvido no cadastro e no login).

## Autenticação

| Método | Rota | Quem | Descrição |
|---|---|---|---|
| POST | `/auth/empresas/cadastro` | público | Cria empresa e já devolve token |
| POST | `/auth/candidatos/cadastro` | público | Cria candidato e já devolve token |
| POST | `/auth/login` | público | Login de empresa ou candidato |
| GET | `/auth/me` | logado | Dados do usuário logado |

**Cadastro de empresa:** `razao_social`, `cnpj` (14 dígitos, aceita máscara), `email`, `senha` (mín. 8), opcionais `setor`, `site`, `descricao`.

**Cadastro de candidato:** `nome`, `email`, `senha` (mín. 8), `curso`, `aceite_lgpd` (deve ser `true`), opcionais `instituicao`, `periodo_atual`, `cidade`, `uf`, `link_perfil`.

**Login:** `{ "email", "senha", "tipo": "EMPRESA" | "CANDIDATO" }` → `{ "token", "usuario": { id, nome, tipo } }`

O token carrega `{ id, tipo }`. Códigos: 201 cadastro, 400 dados inválidos, 401 login inválido, 409 e-mail/CNPJ já cadastrado.

## Habilidades

| Método | Rota | Descrição |
|---|---|---|
| GET | `/habilidades?categoria=TECNICA\|COMPORTAMENTAL\|IDIOMA` | Lista (categoria opcional) |

## Vagas (UC07)

| Método | Rota | Quem | Descrição |
|---|---|---|---|
| GET | `/vagas` | público | Só vagas ABERTAS dentro do prazo |
| GET | `/vagas/minhas?status=` | empresa | Todas as vagas da empresa |
| GET | `/vagas/:id` | público* | Detalhe (*vaga não aberta só aparece para a empresa dona) |
| POST | `/vagas` | empresa | Cria vaga (rascunho ou já aberta) |
| PUT | `/vagas/:id` | empresa dona | Edita campos; `habilidades` substitui a lista inteira |
| PATCH | `/vagas/:id/status` | empresa dona | `{ "status": "ABERTA" \| "PAUSADA" \| "ENCERRADA" }` |

**Filtros do `GET /vagas`:** `curso`, `modelo_trabalho` (PRESENCIAL/HIBRIDO/REMOTO), `uf`, `cidade`, `q` (título ou descrição), `habilidades` (ids separados por vírgula, basta uma bater), `bolsa_min`, `page`, `limit` (máx. 50).
Resposta: `{ total, page, limit, vagas: [...] }`, mais recentes primeiro.

**Corpo do `POST /vagas`:**
```json
{
  "titulo": "Estágio Backend",
  "descricao": "Atuar no desenvolvimento de APIs.",
  "atividades": "...",
  "curso_desejado": "Ciência da Computação",
  "periodo_minimo": 4,
  "modelo_trabalho": "REMOTO",
  "cidade": "Recife", "uf": "PE",
  "carga_horaria_semanal": 30,
  "valor_bolsa": 1500,
  "beneficios": "VT, VR",
  "qtd_vagas": 2,
  "prazo_inscricao": "2026-11-30",
  "status_vaga": "ABERTA",
  "habilidades": [
    { "id_habilidade": 1, "nivel_minimo": 3, "obrigatoria": true, "peso_match": 2 },
    { "id_habilidade": 11 }
  ]
}
```
Obrigatórios: `titulo`, `descricao`, `modelo_trabalho`. `status_vaga` aceita RASCUNHO (padrão) ou ABERTA; para abrir, `prazo_inscricao` deve ser hoje ou depois. Datas no formato `AAAA-MM-DD`. Defaults de habilidade: `nivel_minimo` 1, `obrigatoria` false, `peso_match` 1.

**Ciclo de status:** `RASCUNHO → ABERTA ⇄ PAUSADA → ENCERRADA` (RASCUNHO também pode ir direto para ENCERRADA; ENCERRADA é final e não pode ser editada). Transição inválida devolve 409. Ao abrir pela primeira vez, `data_publicacao` é preenchida.

**Objeto de vaga:** todos os campos da tabela `vaga` + `empresa_nome` + `habilidades: [{ id_habilidade, nome, categoria, nivel_minimo, obrigatoria, peso_match }]`. Datas vêm como `AAAA-MM-DD` e valores numéricos como número.

## Para a Frente 2 (recomendação e candidatura)
A tabela `vaga_habilidade` já traz `obrigatoria` e `peso_match` para o cálculo de `taxa_match`, e `candidato_habilidade` (nível e anos) fica com a Frente 2. A regra de candidatura única por vaga já está no banco (`uq_candidatura`).
