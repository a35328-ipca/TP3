const express = require('express');
const cors    = require('cors');

const portfolioRouter = require('./routes/portfolio');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────
app.use(cors({ origin: 'http://localhost:4200' })); // Permite requests do Angular dev server
app.use(express.json());

// ── Rotas ───────────────────────────────────────────────
app.use('/api/portfolio', portfolioRouter);

// Rota de health-check (útil para verificar se o servidor está ativo)
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ── Iniciar Servidor ────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║      StockFolio API Backend              ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  Servidor: http://localhost:${PORT}          ║`);
  console.log(`║  API:      http://localhost:${PORT}/api      ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
});
