const express = require('express');
const router = express.Router();
const db = require('../database');

// ─────────────────────────────────────────────
// GET /api/portfolio  → Devolver todos os ativos
// ─────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const rows = db.prepare('SELECT * FROM portfolio ORDER BY createdAt ASC').all();
    res.json(rows);
  } catch (err) {
    console.error('Erro ao obter portfolio:', err);
    res.status(500).json({ error: 'Erro interno ao obter a carteira.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/portfolio  → Adicionar novo ativo
// ─────────────────────────────────────────────
router.post('/', (req, res) => {
  const { id, ticker, empresa, dataCompra, quantidade, precoCompra } = req.body;

  if (!ticker || !empresa || !dataCompra || quantidade == null || precoCompra == null) {
    return res.status(400).json({ error: 'Campos obrigatórios em falta (ticker, empresa, dataCompra, quantidade, precoCompra).' });
  }

  // Gerar ID se não foi enviado
  const newId = id || require('crypto').randomUUID();

  try {
    db.prepare(`
      INSERT INTO portfolio (id, ticker, empresa, dataCompra, quantidade, precoCompra)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(newId, ticker.toUpperCase().trim(), empresa.trim(), dataCompra, Number(quantidade), Number(precoCompra));

    const inserted = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(newId);
    res.status(201).json(inserted);
  } catch (err) {
    console.error('Erro ao adicionar ativo:', err);
    res.status(500).json({ error: 'Erro interno ao adicionar o ativo.' });
  }
});

// ─────────────────────────────────────────────
// PUT /api/portfolio/:id  → Atualizar ativo existente
// ─────────────────────────────────────────────
router.put('/:id', (req, res) => {
  const { id } = req.params;
  const { ticker, empresa, dataCompra, quantidade, precoCompra } = req.body;

  const existing = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: `Ativo com id '${id}' não encontrado.` });
  }

  try {
    db.prepare(`
      UPDATE portfolio
      SET ticker      = ?,
          empresa     = ?,
          dataCompra  = ?,
          quantidade  = ?,
          precoCompra = ?,
          updatedAt   = datetime('now')
      WHERE id = ?
    `).run(
      (ticker || existing.ticker).toUpperCase().trim(),
      (empresa || existing.empresa).trim(),
      dataCompra || existing.dataCompra,
      Number(quantidade ?? existing.quantidade),
      Number(precoCompra ?? existing.precoCompra),
      id
    );

    const updated = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(id);
    res.json(updated);
  } catch (err) {
    console.error('Erro ao atualizar ativo:', err);
    res.status(500).json({ error: 'Erro interno ao atualizar o ativo.' });
  }
});

// ─────────────────────────────────────────────
// DELETE /api/portfolio/:id  → Remover ativo
// ─────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  const { id } = req.params;

  const existing = db.prepare('SELECT * FROM portfolio WHERE id = ?').get(id);
  if (!existing) {
    return res.status(404).json({ error: `Ativo com id '${id}' não encontrado.` });
  }

  try {
    db.prepare('DELETE FROM portfolio WHERE id = ?').run(id);
    res.json({ message: `Ativo '${existing.ticker}' removido com sucesso.` });
  } catch (err) {
    console.error('Erro ao remover ativo:', err);
    res.status(500).json({ error: 'Erro interno ao remover o ativo.' });
  }
});

// ─────────────────────────────────────────────
// POST /api/portfolio/import  → Importar vários ativos de uma vez (substitui tudo)
// ─────────────────────────────────────────────
router.post('/import', (req, res) => {
  const items = req.body;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'O corpo deve ser um array de ativos.' });
  }

  try {
    // Importação dentro de uma transação atómica
    const importAll = db.transaction((stocks) => {
      db.prepare('DELETE FROM portfolio').run(); // Limpa a carteira atual
      const insert = db.prepare(`
        INSERT INTO portfolio (id, ticker, empresa, dataCompra, quantidade, precoCompra)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const s of stocks) {
        const newId = s.id || require('crypto').randomUUID();
        insert.run(
          newId,
          String(s.ticker).toUpperCase().trim(),
          String(s.empresa || s.ticker).trim(),
          s.dataCompra || new Date().toISOString().split('T')[0],
          Number(s.quantidade),
          Number(s.precoCompra)
        );
      }
    });

    importAll(items);

    const all = db.prepare('SELECT * FROM portfolio ORDER BY createdAt ASC').all();
    res.json({ message: `${all.length} ativos importados com sucesso.`, data: all });
  } catch (err) {
    console.error('Erro ao importar portfolio:', err);
    res.status(500).json({ error: 'Erro interno ao importar a carteira.' });
  }
});

module.exports = router;
