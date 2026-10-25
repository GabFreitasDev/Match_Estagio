require('dotenv').config();
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) {
  console.log('DATABASE_URL não foi carregada. O .env está na pasta certa?');
  process.exit(1);
}

const u = new URL(url);
console.log('Host:', u.host, '| Banco:', u.pathname.slice(1), '| Usuário:', u.username);

const pool = new Pool({ connectionString: url });
pool
  .query('select current_database() as banco, version() as versao')
  .then((r) => console.log('Conectou:', r.rows[0]))
  .catch((e) => console.log('ERRO:', e.message))
  .finally(() => pool.end());