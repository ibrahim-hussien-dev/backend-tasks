// Demo: two clients chat in #general
const { io } = require('socket.io-client');
const url = process.env.URL || 'http://localhost:3000';
const alice = io(url);
const bob = io(url);

bob.on('message', (m) => {
  console.log(`[bob received] ${m.username}@${m.channel}: ${m.text} (${m.timestamp})`);
  alice.close();
  bob.close();
});
bob.on('presence', (p) => console.log('[presence]', p.channel, p.users));

bob.emit('join', { username: 'bob', channel: 'general' }, () => {
  alice.emit('join', { username: 'alice', channel: 'general' }, () => {
    alice.emit('message', { channel: 'general', text: 'Hello Bob!' });
  });
});
