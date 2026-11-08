// End-to-end endpoint tests against the running stack. Run: docker compose up -d --build && npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.BASE_URL || 'http://localhost:3000';
if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD) {
  throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set for endpoint tests');
}
const ADMIN = { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD };
const user = { email: `user${Date.now()}@test.com`, password: 'Password123' };
const state = {};

const call = async (method, path, { body, token } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  return { status: res.status, data: await res.json().catch(() => null) };
};

test('GET /health -> 200', async () => {
  assert.equal((await call('GET', '/health')).status, 200);
});

test('POST /auth/register -> 201 (role is always "user")', async () => {
  const r = await call('POST', '/auth/register', { body: { ...user, role: 'admin' } });
  assert.equal(r.status, 201);
  assert.equal(r.data.role, 'user');
});

test('POST /auth/register duplicate email -> 409', async () => {
  assert.equal((await call('POST', '/auth/register', { body: user })).status, 409);
});

test('POST /auth/register invalid body -> 400', async () => {
  assert.equal((await call('POST', '/auth/register', { body: { email: 'nope', password: '1' } })).status, 400);
});

test('POST /auth/login wrong password -> 401', async () => {
  assert.equal((await call('POST', '/auth/login', { body: { email: user.email, password: 'WrongPass123' } })).status, 401);
});

test('POST /auth/login user and admin -> 200 + token', async () => {
  const u = await call('POST', '/auth/login', { body: user });
  const a = await call('POST', '/auth/login', { body: ADMIN });
  assert.equal(u.status, 200);
  assert.equal(a.status, 200);
  state.userToken = u.data.token;
  state.adminToken = a.data.token;
});

test('POST /orders without token -> 401', async () => {
  assert.equal((await call('POST', '/orders', { body: { item: 'pen', quantity: 1 } })).status, 401);
});

test('POST /orders invalid body -> 400', async () => {
  assert.equal((await call('POST', '/orders', { token: state.userToken, body: { item: '', quantity: 0 } })).status, 400);
});

test('POST /orders as user -> 202 (queued)', async () => {
  const r = await call('POST', '/orders', { token: state.userToken, body: { item: 'notebook', quantity: 3 } });
  assert.equal(r.status, 202);
});

test('GET /orders as user -> 403 (admin only)', async () => {
  assert.equal((await call('GET', '/orders', { token: state.userToken })).status, 403);
});

test('GET /orders/mine -> worker persisted the queued order', async () => {
  let rows = [];
  for (let i = 0; i < 20 && !rows.length; i++) {
    rows = (await call('GET', '/orders/mine', { token: state.userToken })).data;
    if (!rows.length) await new Promise((r) => setTimeout(r, 500));
  }
  assert.equal(rows.length, 1);
  assert.equal(rows[0].item, 'notebook');
});

test('GET /orders as admin -> 200 and includes the order', async () => {
  const r = await call('GET', '/orders', { token: state.adminToken });
  assert.equal(r.status, 200);
  assert.ok(r.data.some((o) => o.item === 'notebook'));
});
