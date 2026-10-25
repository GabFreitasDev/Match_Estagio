const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const pool = require('../db');

const senha = z.string().min(8, 'A senha deve ter ao menos 8 caracteres.').max(72);
const uf = z.string().length(2).transform((s) => s.toUpperCase());

const empresaSchema = z.object({
  razao_social: z.string().min(2).max(200),
  cnpj: z.string().transform((s) => s.replace(/\D/g, '')).refine((s) => s.length === 14, 'CNPJ deve ter 14 dígitos.'),
  email: z.string().email().max(150).transform((s) => s.toLowerCase()),
  senha,
  setor: z.string().max(100).optional(),
  site: z.string().max(255).optional(),
  descricao: z.string().optional(),
});

const candidatoSchema = z.object({
  nome: z.string().min(2).max(150),
  email: z.string().email().max(150).transform((s) => s.toLowerCase()),
  senha,
  curso: z.string().min(2).max(120),
  instituicao: z.string().max(150).optional(),
  periodo_atual: z.number().int().min(1).max(20).optional(),
  cidade: z.string().max(100).optional(),
  uf: uf.optional(),
  link_perfil: z.string().max(255).optional(),
  aceite_lgpd: z.literal(true, { errorMap: () => ({ message: 'É necessário aceitar os termos da LGPD.' }) }),
});

const loginSchema = z.object({
  email: z.string().email().transform((s) => s.toLowerCase()),
  senha: z.string().min(1),
  tipo: z.enum(['EMPRESA', 'CANDIDATO']),
});

function gerarToken(id, tipo) {
  return jwt.sign({ id, tipo }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '8h',
  });
}

router.post('/empresas/cadastro', async (req, res, next) => {
  try {
    const d = empresaSchema.parse(req.body);
    const hash = await bcrypt.hash(d.senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO empresa (razao_social, cnpj, email, senha_hash, setor, site, descricao, origem_cadastro)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'PROPRIA')
       RETURNING id_empresa, razao_social, cnpj, email, setor, site, descricao`,
      [d.razao_social, d.cnpj, d.email, hash, d.setor ?? null, d.site ?? null, d.descricao ?? null]
    );
    res.status(201).json({ empresa: rows[0], token: gerarToken(rows[0].id_empresa, 'EMPRESA') });
  } catch (e) { next(e); }
});

router.post('/candidatos/cadastro', async (req, res, next) => {
  try {
    const d = candidatoSchema.parse(req.body);
    const hash = await bcrypt.hash(d.senha, 10);
    const { rows } = await pool.query(
      `INSERT INTO candidato (nome, email, senha_hash, curso, instituicao, periodo_atual,
                              cidade, uf, link_perfil, aceite_lgpd, aceite_lgpd_em)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,TRUE,NOW())
       RETURNING id_candidato, nome, email, curso, instituicao, periodo_atual, cidade, uf, link_perfil`,
      [d.nome, d.email, hash, d.curso, d.instituicao ?? null, d.periodo_atual ?? null,
       d.cidade ?? null, d.uf ?? null, d.link_perfil ?? null]
    );
    res.status(201).json({ candidato: rows[0], token: gerarToken(rows[0].id_candidato, 'CANDIDATO') });
  } catch (e) { next(e); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, senha: pwd, tipo } = loginSchema.parse(req.body);
    const empresa = tipo === 'EMPRESA';
    const { rows } = await pool.query(
      empresa
        ? 'SELECT id_empresa AS id, razao_social AS nome, senha_hash FROM empresa WHERE email = $1'
        : 'SELECT id_candidato AS id, nome, senha_hash FROM candidato WHERE email = $1',
      [email]
    );
    const u = rows[0];
    const ok = u && u.senha_hash && (await bcrypt.compare(pwd, u.senha_hash));
    if (!ok) return res.status(401).json({ erro: 'E-mail ou senha inválidos.' });
    res.json({ token: gerarToken(u.id, tipo), usuario: { id: u.id, nome: u.nome, tipo } });
  } catch (e) { next(e); }
});

// Dados do usuário logado
router.get('/me', require('../middleware/auth').auth(), async (req, res, next) => {
  try {
    const empresa = req.user.tipo === 'EMPRESA';
    const { rows } = await pool.query(
      empresa
        ? `SELECT id_empresa, razao_social, cnpj, email, setor, site, descricao FROM empresa WHERE id_empresa = $1`
        : `SELECT id_candidato, nome, email, curso, instituicao, periodo_atual, cidade, uf, link_perfil
           FROM candidato WHERE id_candidato = $1`,
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.json({ tipo: req.user.tipo, usuario: rows[0] });
  } catch (e) { next(e); }
});

module.exports = router;
