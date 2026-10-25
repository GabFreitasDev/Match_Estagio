const jwt = require('jsonwebtoken');

function lerToken(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

// auth()            -> exige login (qualquer tipo)
// auth('EMPRESA')   -> exige login de empresa
// auth('CANDIDATO') -> exige login de candidato
function auth(tipo) {
  return (req, res, next) => {
    const token = lerToken(req);
    if (!token) return res.status(401).json({ erro: 'Token ausente.' });
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      if (tipo && payload.tipo !== tipo) {
        return res.status(403).json({ erro: 'Acesso não permitido para este perfil.' });
      }
      req.user = { id: payload.id, tipo: payload.tipo };
      next();
    } catch {
      res.status(401).json({ erro: 'Token inválido ou expirado.' });
    }
  };
}

// Preenche req.user se houver token válido, mas não bloqueia.
function authOpcional(req, _res, next) {
  const token = lerToken(req);
  if (token) {
    try {
      const p = jwt.verify(token, process.env.JWT_SECRET);
      req.user = { id: p.id, tipo: p.tipo };
    } catch { /* ignora */ }
  }
  next();
}

module.exports = { auth, authOpcional };
