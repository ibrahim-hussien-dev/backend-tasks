const amqp = require('amqplib');
const { Pool } = require('pg');

const QUEUE = 'orders';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const conn = await amqp.connect(process.env.RABBITMQ_URL);
  const channel = await conn.createChannel();
  await channel.assertQueue(QUEUE, { durable: true });
  channel.prefetch(10); // process up to 10 messages at a time

  channel.consume(QUEUE, async (msg) => {
    try {
      const { userId, item, quantity } = JSON.parse(msg.content.toString());
      await pool.query('INSERT INTO orders (user_id, item, quantity) VALUES ($1, $2, $3)', [userId, item, quantity]);
      channel.ack(msg);
    } catch (e) {
      console.error('Failed to process message:', e.message);
      channel.nack(msg, false, false); // drop bad message instead of looping forever
    }
  });
  console.log('Worker waiting for orders...');
}

main().catch((e) => { console.error(e); process.exit(1); });
