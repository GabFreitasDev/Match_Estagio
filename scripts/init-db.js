// Cria as tabelas do modelo v2 (db/schema.sql) no banco apontado por DATABASE_URL.
//
//   npm run db:init     -> só cria se o banco estiver vazio (seguro)
//   npm run db:reset    -> APAGA tudo e recria (use só se tiver certeza)
//
// O banco do time é compartilhado: normalmente só UMA pessoa roda isto, uma única vez.
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('../src/db');

const force = process.argv.includes('--force');

function destino() {
  try { return new URL(process.env.DATABASE_URL).host; } catch { return '(DATABASE_URL inválida)'; }
}

(async () => {
  try {
    console.log(`Banco de destino: ${destino()}`);
    const { rows } = await pool.query("SELECT to_regclass('public.empresa') AS t");
    const jaExiste = rows[0].t !== null;

    if (jaExiste && !force) {
      console.log('As tabelas já existem. Nada foi alterado.');
      console.log('Se a intenção é apagar tudo e recriar, use: npm run db:reset');
      return;
    }
    if (jaExiste && force) {
      console.log('ATENÇÃO: apagando todas as tabelas e dados (--force)...');
      await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
    }

    const sql = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8');
    await pool.query(sql);
    console.log('Banco criado com sucesso.');
  } catch (e) {
    console.error('Erro ao criar o banco:', e.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
})();
