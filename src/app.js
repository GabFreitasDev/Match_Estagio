const express = require('express');
const cors = require('cors');
const { ZodError } = require('zod');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/saude', (_req, res) => res.json({ ok: true }));
app.use('/auth', require('./routes/auth'));
app.use('/habilidades', require('./routes/habilidades'));
app.use('/vagas', require('./routes/vagas'));

app.use((_req, res) => res.status(404).json({ erro: 'Rota não encontrada.' }));

// Tratamento central de erros
app.use((err, _req, res, _next) => {
  if (err instanceof ZodError) {
    return res.status(400).json({
      erro: 'Dados inválidos.',
      detalhes: err.errors.map((e) => ({ campo: e.path.join('.'), mensagem: e.message })),
    });
  }
  if (err.code === '23505') return res.status(409).json({ erro: 'Registro já existe (e-mail, CNPJ ou outro campo único).' });
  if (err.code === '23503') return res.status(400).json({ erro: 'Referência inválida (ex.: habilidade inexistente).' });
  if (err.code === '23514') return res.status(400).json({ erro: 'Dados violam uma regra do banco.', detalhe: err.constraint });
  console.error(err);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

module.exports = app;
