require('dotenv').config();
const { Pool, types } = require('pg');

// DATE -> 'AAAA-MM-DD' (evita deslocamento de fuso) e NUMERIC -> número
types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
module.exports = pool;
