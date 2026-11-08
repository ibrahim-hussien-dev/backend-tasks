const http = require('http');
const fs = require('fs');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const Redis = require('ioredis');

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// Persistent transaction log (JSON lines, append-only)
fs.mkdirSync('logs', { recursive: true });
const logStream = fs.createWriteStream(path.join('logs', 'transactions.log'), { flags: 'a' });
const log = (event, data) =>
  logStream.write(JSON.stringify({ timestamp: new Date().toISOString(), event, ...data }) + '\n');

// Redis: one hash per channel -> { socketId: username }
const key = (channel) => `channel:${channel}:users`;
const users = async (channel) => Object.values(await redis.hgetall(key(channel)));
const valid = (s) => typeof s === 'string' && /^[\w-]{1,32}$/.test(s);

async function leave(socket, channel) {
  socket.data.channels.delete(channel);
  socket.leave(channel);
  await redis.hdel(key(channel), socket.id);
  log('leave', { channel, username: socket.data.username, socketId: socket.id });
  io.to(channel).emit('presence', { channel, users: await users(channel) });
}

io.on('connection', (socket) => {
  socket.data.channels = new Set();

  socket.on('join', async ({ username, channel } = {}, ack) => {
    if (!valid(username) || !valid(channel)) return ack?.({ error: 'Invalid username or channel' });
    socket.data.username = username;
    socket.join(channel);
    socket.data.channels.add(channel);
    await redis.hset(key(channel), socket.id, username);
    log('join', { channel, username, socketId: socket.id });
    io.to(channel).emit('presence', { channel, users: await users(channel) });
    ack?.({ ok: true });
  });

  socket.on('message', ({ channel, text } = {}, ack) => {
    if (!socket.data.channels.has(channel)) return ack?.({ error: 'Join the channel first' });
    if (typeof text !== 'string' || !text.trim() || text.length > 1000) return ack?.({ error: 'Invalid text' });
    const msg = { channel, username: socket.data.username, text: text.trim(), timestamp: new Date().toISOString() };
    io.to(channel).emit('message', msg);
    log('message', msg);
    ack?.({ ok: true });
  });

  socket.on('leave', ({ channel } = {}) => {
    if (socket.data.channels.has(channel)) leave(socket, channel);
  });

  socket.on('disconnecting', () => {
    [...socket.data.channels].forEach((c) => leave(socket, c));
  });
});

// Read active users straight from the Redis cache
app.get('/channels/:channel/users', async (req, res) => {
  if (!valid(req.params.channel)) return res.status(400).json({ error: 'Invalid channel' });
  res.json({ channel: req.params.channel, users: await users(req.params.channel) });
});

const port = process.env.PORT || 3000;
server.listen(port, () => console.log(`Chat hub listening on :${port}`));
