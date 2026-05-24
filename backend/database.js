const Database = require('better-sqlite3');
const path = require('path');

// Cria (ou abre) o ficheiro da base de dados SQLite
const DB_PATH = path.join(__dirname, 'stockfolio.db');
const db = new Database(DB_PATH);

// Ativar WAL mode para melhor performance de leitura/escrita
db.pragma('journal_mode = WAL');

// Criar a tabela da carteira se não existir
db.exec(`
  CREATE TABLE IF NOT EXISTS portfolio (
    id         TEXT PRIMARY KEY,
    ticker     TEXT NOT NULL,
    empresa    TEXT NOT NULL,
    dataCompra TEXT NOT NULL,
    quantidade REAL NOT NULL,
    precoCompra REAL NOT NULL,
    createdAt  TEXT DEFAULT (datetime('now')),
    updatedAt  TEXT DEFAULT (datetime('now'))
  )
`);

console.log(`✅ Base de dados SQLite iniciada: ${DB_PATH}`);

module.exports = db;
