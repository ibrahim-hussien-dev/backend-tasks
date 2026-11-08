const Database = require('better-sqlite3');

const db = new Database(process.env.DB_FILE || 'data.db');
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    price      REAL    NOT NULL CHECK (price >= 0),
    stock      INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    created_at TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`);

module.exports = db;
