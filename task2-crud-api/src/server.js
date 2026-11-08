const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const db = require('./db');
const { productSchema, validate, validateId, requireApiKey } = require('./middleware');

const app = express();
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(rateLimit({ windowMs: 60_000, limit: 100 }));

// CREATE
app.post('/products', requireApiKey, validate(productSchema), (req, res) => {
  const { name, price, stock } = req.body;
  const info = db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)').run(name, price, stock);
  res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(info.lastInsertRowid));
});

// READ (list with pagination)
app.get('/products', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  res.json(db.prepare('SELECT * FROM products ORDER BY id LIMIT ? OFFSET ?').all(limit, offset));
});

// READ (one)
app.get('/products/:id', validateId, (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.id);
  row ? res.json(row) : res.status(404).json({ error: 'Not found' });
});

// UPDATE
app.put('/products/:id', requireApiKey, validateId, validate(productSchema), (req, res) => {
  const { name, price, stock } = req.body;
  const info = db.prepare('UPDATE products SET name = ?, price = ?, stock = ? WHERE id = ?').run(name, price, stock, req.id);
  if (!info.changes) return res.status(404).json({ error: 'Not found' });
  res.json(db.prepare('SELECT * FROM products WHERE id = ?').get(req.id));
});

// DELETE
app.delete('/products/:id', requireApiKey, validateId, (req, res) => {
  const info = db.prepare('DELETE FROM products WHERE id = ?').run(req.id);
  info.changes ? res.status(204).end() : res.status(404).json({ error: 'Not found' });
});

// Malformed JSON and other errors
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`API listening on :${port}`));
