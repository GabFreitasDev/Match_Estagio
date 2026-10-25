require('dotenv').config();
if (!process.env.JWT_SECRET) { console.error('Defina JWT_SECRET no .env'); process.exit(1); }
const app = require('./app');
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API MatchEstágio em http://localhost:${port}`));
