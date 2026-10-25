const router = require('express').Router();
const pool = require('../db');

// Leitura pública. O CRUD completo de Habilidade é da Frente 2.
router.get('/', async (req, res, next) => {
  try {
    const { categoria } = req.query;
    const { rows } = categoria
      ? await pool.query('SELECT * FROM habilidade WHERE categoria = $1 ORDER BY nome', [String(categoria).toUpperCase()])
      : await pool.query('SELECT * FROM habilidade ORDER BY categoria, nome');
    res.json(rows);
  } catch (e) { next(e); }
});

module.exports = router;
