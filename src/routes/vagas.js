const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db');
const { auth, authOpcional } = require('../middleware/auth');

const data = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use o formato AAAA-MM-DD.');

const habilidadeVaga = z.object({
  id_habilidade: z.number().int().positive(),
  nivel_minimo: z.number().int().min(1).max(5).default(1),
  obrigatoria: z.boolean().default(false),
  peso_match: z.number().positive().max(99).default(1),
});

const vagaSchema = z.object({
  titulo: z.string().min(3).max(150),
  descricao: z.string().min(10),
  atividades: z.string().nullish(),
  curso_desejado: z.string().max(120).nullish(),
  periodo_minimo: z.number().int().min(1).max(20).nullish(),
  modelo_trabalho: z.enum(['PRESENCIAL', 'HIBRIDO', 'REMOTO']),
  cidade: z.string().max(100).nullish(),
  uf: z.string().length(2).transform((s) => s.toUpperCase()).nullish(),
  carga_horaria_semanal: z.number().int().min(1).max(30).nullish(),
  valor_bolsa: z.number().min(0).nullish(),
  beneficios: z.string().nullish(),
  qtd_vagas: z.number().int().min(1).default(1),
  prazo_inscricao: data.nullish(),
  status_vaga: z.enum(['RASCUNHO', 'ABERTA']).optional(),
  habilidades: z.array(habilidadeVaga).optional(),
});

const CAMPOS = [
  'titulo', 'descricao', 'atividades', 'curso_desejado', 'periodo_minimo', 'modelo_trabalho',
  'cidade', 'uf', 'carga_horaria_semanal', 'valor_bolsa', 'beneficios', 'qtd_vagas', 'prazo_inscricao',
];

// RASCUNHO -> ABERTA <-> PAUSADA -> ENCERRADA (final)
const TRANSICOES = {
  RASCUNHO: ['ABERTA', 'ENCERRADA'],
  ABERTA: ['PAUSADA', 'ENCERRADA'],
  PAUSADA: ['ABERTA', 'ENCERRADA'],
  ENCERRADA: [],
};

const hoje = () => new Date().toLocaleDateString('en-CA');

const SELECT_VAGA = `
  SELECT v.*, e.razao_social AS empresa_nome,
    (SELECT COALESCE(json_agg(json_build_object(
        'id_habilidade', h.id_habilidade, 'nome', h.nome, 'categoria', h.categoria,
        'nivel_minimo', vh.nivel_minimo, 'obrigatoria', vh.obrigatoria, 'peso_match', vh.peso_match
      ) ORDER BY h.nome), '[]'::json)
     FROM vaga_habilidade vh JOIN habilidade h USING (id_habilidade)
     WHERE vh.id_vaga = v.id_vaga) AS habilidades
  FROM vaga v JOIN empresa e USING (id_empresa)`;

async function salvarHabilidades(client, idVaga, lista) {
  await client.query('DELETE FROM vaga_habilidade WHERE id_vaga = $1', [idVaga]);
  const vistos = new Set();
  for (const h of lista) {
    if (vistos.has(h.id_habilidade)) continue;
    vistos.add(h.id_habilidade);
    await client.query(
      `INSERT INTO vaga_habilidade (id_vaga, id_habilidade, nivel_minimo, obrigatoria, peso_match)
       VALUES ($1,$2,$3,$4,$5)`,
      [idVaga, h.id_habilidade, h.nivel_minimo, h.obrigatoria, h.peso_match]
    );
  }
}

function prazoValidoParaAbrir(prazo) {
  return prazo && String(prazo).slice(0, 10) >= hoje();
}

async function buscarVaga(id) {
  const { rows } = await pool.query(`${SELECT_VAGA} WHERE v.id_vaga = $1`, [id]);
  return rows[0];
}

// ---- Listagem pública (só vagas ABERTAS e dentro do prazo) ----
// filtros: curso, modelo_trabalho, uf, cidade, q, habilidades (ids separados por vírgula),
//          bolsa_min, page, limit
router.get('/', async (req, res, next) => {
  try {
    const { curso, modelo_trabalho, uf, cidade, q, habilidades, bolsa_min } = req.query;
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50);

    const where = [`v.status_vaga = 'ABERTA'`, `(v.prazo_inscricao IS NULL OR v.prazo_inscricao >= CURRENT_DATE)`];
    const params = [];
    const add = (sql, val) => { params.push(val); where.push(sql.replace('?', `$${params.length}`)); };

    if (curso) add('v.curso_desejado ILIKE ?', `%${curso}%`);
    if (modelo_trabalho) add('v.modelo_trabalho = ?', String(modelo_trabalho).toUpperCase());
    if (uf) add('v.uf = ?', String(uf).toUpperCase());
    if (cidade) add('v.cidade ILIKE ?', `%${cidade}%`);
    if (q) { params.push(`%${q}%`); where.push(`(v.titulo ILIKE $${params.length} OR v.descricao ILIKE $${params.length})`); }
    if (bolsa_min) add('v.valor_bolsa >= ?', Number(bolsa_min));
    if (habilidades) {
      const ids = String(habilidades).split(',').map(Number).filter(Number.isInteger);
      if (ids.length) add(
        'EXISTS (SELECT 1 FROM vaga_habilidade x WHERE x.id_vaga = v.id_vaga AND x.id_habilidade = ANY(?::int[]))',
        ids
      );
    }

    const W = where.join(' AND ');
    const total = (await pool.query(`SELECT COUNT(*)::int AS n FROM vaga v WHERE ${W}`, params)).rows[0].n;
    const { rows } = await pool.query(
      `${SELECT_VAGA} WHERE ${W}
       ORDER BY v.data_publicacao DESC NULLS LAST, v.id_vaga DESC
       LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
      params
    );
    res.json({ total, page, limit, vagas: rows });
  } catch (e) { next(e); }
});

// ---- Vagas da empresa logada (todos os status) ----
router.get('/minhas', auth('EMPRESA'), async (req, res, next) => {
  try {
    const params = [req.user.id];
    let extra = '';
    if (req.query.status) { params.push(String(req.query.status).toUpperCase()); extra = ' AND v.status_vaga = $2'; }
    const { rows } = await pool.query(
      `${SELECT_VAGA} WHERE v.id_empresa = $1${extra} ORDER BY v.criado_em DESC`, params
    );
    res.json(rows);
  } catch (e) { next(e); }
});

// ---- Detalhe (vaga não aberta só aparece para a empresa dona) ----
router.get('/:id(\\d+)', authOpcional, async (req, res, next) => {
  try {
    const v = await buscarVaga(req.params.id);
    const dono = req.user?.tipo === 'EMPRESA' && req.user.id === v?.id_empresa;
    if (!v || (v.status_vaga !== 'ABERTA' && !dono)) {
      return res.status(404).json({ erro: 'Vaga não encontrada.' });
    }
    res.json(v);
  } catch (e) { next(e); }
});

// ---- UC07: publicar vaga ----
router.post('/', auth('EMPRESA'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const d = vagaSchema.parse(req.body);
    if (d.status_vaga === 'ABERTA' && !prazoValidoParaAbrir(d.prazo_inscricao)) {
      return res.status(400).json({ erro: 'Para publicar, informe prazo_inscricao igual ou posterior a hoje.' });
    }
    const cols = [], ph = [], vals = [];
    for (const c of CAMPOS) if (d[c] !== undefined) { vals.push(d[c]); cols.push(c); ph.push(`$${vals.length}`); }
    vals.push(req.user.id); cols.push('id_empresa'); ph.push(`$${vals.length}`);
    vals.push(d.status_vaga || 'RASCUNHO'); cols.push('status_vaga'); ph.push(`$${vals.length}`);
    if (d.status_vaga === 'ABERTA') { cols.push('data_publicacao'); ph.push('CURRENT_DATE'); }

    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO vaga (${cols.join(',')}) VALUES (${ph.join(',')}) RETURNING id_vaga`, vals
    );
    if (d.habilidades?.length) await salvarHabilidades(client, rows[0].id_vaga, d.habilidades);
    await client.query('COMMIT');
    res.status(201).json(await buscarVaga(rows[0].id_vaga));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

// ---- Editar vaga (parcial). Se "habilidades" vier, substitui a lista inteira ----
router.put('/:id(\\d+)', auth('EMPRESA'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const d = vagaSchema.omit({ status_vaga: true }).partial().parse(req.body);
    const atual = await buscarVaga(req.params.id);
    if (!atual) return res.status(404).json({ erro: 'Vaga não encontrada.' });
    if (atual.id_empresa !== req.user.id) return res.status(403).json({ erro: 'Esta vaga pertence a outra empresa.' });
    if (atual.status_vaga === 'ENCERRADA') return res.status(409).json({ erro: 'Vaga encerrada não pode ser editada.' });

    const sets = [], vals = [];
    for (const c of CAMPOS) if (d[c] !== undefined) { vals.push(d[c]); sets.push(`${c} = $${vals.length}`); }
    if (!sets.length && !d.habilidades) return res.status(400).json({ erro: 'Nenhum campo para atualizar.' });

    await client.query('BEGIN');
    if (sets.length) {
      vals.push(req.params.id);
      await client.query(`UPDATE vaga SET ${sets.join(', ')} WHERE id_vaga = $${vals.length}`, vals);
    }
    if (d.habilidades) await salvarHabilidades(client, req.params.id, d.habilidades);
    await client.query('COMMIT');
    res.json(await buscarVaga(req.params.id));
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    next(e);
  } finally { client.release(); }
});

// ---- Mudar status: ABERTA / PAUSADA / ENCERRADA ----
router.patch('/:id(\\d+)/status', auth('EMPRESA'), async (req, res, next) => {
  try {
    const { status } = z.object({ status: z.enum(['ABERTA', 'PAUSADA', 'ENCERRADA']) }).parse(req.body);
    const v = await buscarVaga(req.params.id);
    if (!v) return res.status(404).json({ erro: 'Vaga não encontrada.' });
    if (v.id_empresa !== req.user.id) return res.status(403).json({ erro: 'Esta vaga pertence a outra empresa.' });
    if (!TRANSICOES[v.status_vaga].includes(status)) {
      return res.status(409).json({ erro: `Transição inválida: ${v.status_vaga} -> ${status}.` });
    }
    if (status === 'ABERTA' && !prazoValidoParaAbrir(v.prazo_inscricao)) {
      return res.status(400).json({ erro: 'Defina um prazo_inscricao igual ou posterior a hoje antes de abrir a vaga.' });
    }
    await pool.query(
      `UPDATE vaga SET status_vaga = $1::varchar,
         data_publicacao = CASE WHEN $1::varchar = 'ABERTA' THEN COALESCE(data_publicacao, CURRENT_DATE) ELSE data_publicacao END
       WHERE id_vaga = $2`,
      [status, req.params.id]
    );
    res.json(await buscarVaga(req.params.id));
  } catch (e) { next(e); }
});

module.exports = router;
