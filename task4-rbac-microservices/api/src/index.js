const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const amqp = require('amqplib');
const { Pool } = require('pg');
const { z } = require('zod');

const { JWT_SECRET, DATABASE_URL, RABBITMQ_URL, ADMIN_EMAIL, ADMIN_PASSWORD, PORT = 3000 } = process.env;
const QUEUE = 'orders';
const pool = new Pool({ connectionString: DATABASE_URL });

const credentialsSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const orderSchema = z.object({ item: z.string().trim().min(1).max(100), quantity: z.number().int().positive() });

const validate = (schema) => (req, res, next) => {
  const r = schema.safeParse(req.body);
  if (!r.success) return res.status(400).json({ error: 'Validation failed', details: r.error.issues });
  req.body = r.data;
  next();
};

// JWT auth + role check. requireAuth() = any logged-in user; requireAuth('admin') = admin only
const requireAuth = (...roles) => (req, res, next) => {
  try {
    const token = (req.get('authorization') || '').replace(/^Bearer /, '');
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (roles.length && !roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

async function main() {
  const conn = await amqp.connect(RABBITMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });

  // Seed the admin account (public registration only creates 'user' accounts)
  await pool.query(
    "INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin') ON CONFLICT (email) DO NOTHING",
    [ADMIN_EMAIL, await bcrypt.hash(ADMIN_PASSWORD, 10)]
  );

  const app = express();
  app.use(express.json({ limit: '10kb' }));

  app.get('/health', (req, res) => res.json({ status: 'ok' }));

  app.post('/auth/register', validate(credentialsSchema), async (req, res, next) => {
    try {
      const hash = await bcrypt.hash(req.body.password, 10);
      const { rows } = await pool.query(
        'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id, email, role',
        [req.body.email, hash]
      );
      res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code === '23505') return res.status(409).json({ error: 'Email already registered' });
      next(e);
    }
  });

  app.post('/auth/login', validate(credentialsSchema), async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT * FROM users WHERE email = $1', [req.body.email]);
      const user = rows[0];
      if (!user || !(await bcrypt.compare(req.body.password, user.password_hash))) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      const token = jwt.sign({ sub: user.id, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
      res.json({ token });
    } catch (e) {
      next(e);
    }
  });

  // Order requests go to RabbitMQ; the worker does the DB write
  app.post('/orders', requireAuth('user', 'admin'), validate(orderSchema), (req, res) => {
    const payload = { userId: req.user.sub, ...req.body };
    channel.sendToQueue(QUEUE, Buffer.from(JSON.stringify(payload)), { persistent: true });
    res.status(202).json({ message: 'Order accepted for processing' });
  });

  app.get('/orders/mine', requireAuth('user', 'admin'), async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT * FROM orders WHERE user_id = $1 ORDER BY id DESC', [req.user.sub]);
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  app.get('/orders', requireAuth('admin'), async (req, res, next) => {
    try {
      const { rows } = await pool.query('SELECT * FROM orders ORDER BY id DESC');
      res.json(rows);
    } catch (e) {
      next(e);
    }
  });

  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.listen(PORT, () => console.log(`API listening on :${PORT}`));
}

main().catch((e) => { console.error(e); process.exit(1); });
