#!/usr/bin/env node
// Usage: node manage.js start | stop | test
// Ports: Task2 -> 3001, Task3 -> 3002, Task4 -> 3000. Needs Node 18+ and Docker (Task 3 + 4).
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = __dirname;
const T2 = path.join(root, 'task2-crud-api');
const T3 = path.join(root, 'task3-websocket-hub');
const T4 = path.join(root, 'task4-rbac-microservices');
const PID_FILE = path.join(root, '.pids.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function run(cmd, cwd, opts = {}) {
  const r = spawnSync(cmd, { cwd, shell: true, stdio: 'inherit', ...opts });
  if (r.status !== 0) throw new Error(`Command failed: "${cmd}" in ${path.basename(cwd)}`);
}

async function waitFor(url, label, timeout = 240000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if ((await fetch(url)).ok) return console.log(`  OK  ${label} -> ${url}`); } catch {}
    await sleep(2000);
  }
  throw new Error(`${label} not ready: ${url} (see logs/ folder)`);
}

function startNode(name, cwd, port) {
  fs.mkdirSync(path.join(root, 'logs'), { recursive: true });
  const out = fs.openSync(path.join(root, 'logs', `${name}.log`), 'a');
  const child = spawn(process.execPath, ['src/server.js'], {
    cwd, detached: true, windowsHide: true, stdio: ['ignore', out, out],
    env: { ...process.env, PORT: String(port) },
  });
  child.unref();
  return child.pid;
}

function stop() {
  if (fs.existsSync(PID_FILE)) {
    for (const pid of JSON.parse(fs.readFileSync(PID_FILE, 'utf8'))) {
      try { process.kill(pid); } catch {}
    }
    fs.unlinkSync(PID_FILE);
  }
  for (const dir of [T3, T4]) spawnSync('docker compose down', { cwd: dir, shell: true, stdio: 'ignore' });
  console.log('Everything stopped.');
}

async function start() {
  if (spawnSync('docker info', { shell: true, stdio: 'ignore' }).status !== 0) {
    throw new Error('Docker is not running. Start Docker Desktop and try again.');
  }
  stop(); // clean previous run
  for (const dir of [T2, T3]) {
    if (!fs.existsSync(path.join(dir, 'node_modules'))) run('npm install', dir);
  }
  run('docker compose up -d', T3);               // Redis
  run('docker compose up -d --build', T4);       // API + worker + Postgres + RabbitMQ
  const pids = [startNode('task2', T2, 3001), startNode('task3', T3, 3002)];
  fs.writeFileSync(PID_FILE, JSON.stringify(pids));

  console.log('Waiting for services...');
  await waitFor('http://localhost:3001/products', 'Task 2 CRUD API');
  await waitFor('http://localhost:3002/channels/general/users', 'Task 3 WebSocket hub');
  await waitFor('http://localhost:3000/health', 'Task 4 RBAC API');
  console.log('\nAll running. Run "node manage.js test" to verify, "node manage.js stop" to stop.');
}

async function test() {
  console.log('\n== Task 2 ==');
  const B = 'http://localhost:3001';
  const call = async (m, p, body, key) => {
    const r = await fetch(B + p, {
      method: m,
      headers: { 'Content-Type': 'application/json', ...(key && { 'x-api-key': key }) },
      body: body && JSON.stringify(body),
    });
    return { status: r.status, data: await r.json().catch(() => null) };
  };
  const K = 'dev-key';
  let r = await call('POST', '/products', { name: 'Pen', price: 1.5, stock: 3 }, K);
  assert.equal(r.status, 201); const id = r.data.id;
  assert.equal((await call('POST', '/products', { name: 'Pen', price: 1 })).status, 401);
  assert.equal((await call('POST', '/products', { name: '', price: -1 }, K)).status, 400);
  assert.equal((await call('GET', '/products')).status, 200);
  assert.equal((await call('GET', `/products/${id}`)).data.name, 'Pen');
  assert.equal((await call('PUT', `/products/${id}`, { name: 'Pen2', price: 2, stock: 1 }, K)).data.name, 'Pen2');
  assert.equal((await call('DELETE', `/products/${id}`, null, K)).status, 204);
  assert.equal((await call('GET', `/products/${id}`)).status, 404);
  console.log('Task 2 passed (create/read/update/delete + auth + validation)');

  console.log('\n== Task 3 ==');
  run('node test/client.js', T3, { env: { ...process.env, URL: 'http://localhost:3002' }, timeout: 20000 });
  console.log('Task 3 passed. Log file: task3-websocket-hub/logs/transactions.log');

  console.log('\n== Task 4 ==');
  run('npm test', T4);
}

const cmd = process.argv[2];
const actions = { start, stop, test };
if (!actions[cmd]) { console.log('Usage: node manage.js start | stop | test'); process.exit(1); }
Promise.resolve(actions[cmd]()).catch((e) => { console.error('\nERROR:', e.message); process.exit(1); });
