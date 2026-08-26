'use strict';
const Fastify = require('fastify');
const Redis = require('ioredis');

const PORT = Number(process.env.PORT || 3000);
const RELEASE = process.env.LIFTOFF_COMMIT || 'dev';
const ROOM = process.env.DEFAULT_ROOM || 'lobby';

const app = Fastify({ logger: true });

// REDIS_URL is the binding name on both DigitalOcean and Azure.
const redisUrl = process.env.REDIS_URL;
const redis = redisUrl
  ? new Redis(redisUrl, { maxRetriesPerRequest: 2, lazyConnect: true })
  : null;

app.get('/health', async () => ({ status: 'ok', service: 'api', release: RELEASE }));
app.get('/api/health', async () => ({ status: 'ok', service: 'api', release: RELEASE }));

app.get('/api/rooms/:room/messages', async (request, reply) => {
  if (!redis) return reply.code(503).send({ error: 'REDIS_URL is not bound' });
  const key = `room:${request.params.room}`;
  const raw = await redis.lrange(key, 0, 49);
  return { room: request.params.room, messages: raw.map((r) => JSON.parse(r)) };
});

app.post('/api/rooms/:room/messages', async (request, reply) => {
  if (!redis) return reply.code(503).send({ error: 'REDIS_URL is not bound' });
  const body = request.body || {};
  if (!body.text) return reply.code(400).send({ error: 'text is required' });
  const message = {
    text: String(body.text),
    author: String(body.author || 'anonymous'),
    at: new Date().toISOString(),
  };
  const key = `room:${request.params.room}`;
  await redis.lpush(key, JSON.stringify(message));
  await redis.ltrim(key, 0, 199);
  // The worker drains this queue and records per-room counters.
  await redis.lpush('pulsechat:events', JSON.stringify({ type: 'message', room: request.params.room }));
  return reply.code(201).send({ message });
});

app.get('/api/stats', async (_request, reply) => {
  if (!redis) return reply.code(503).send({ error: 'REDIS_URL is not bound' });
  const counters = await redis.hgetall('pulsechat:counters');
  return { counters, defaultRoom: ROOM, release: RELEASE };
});

const start = async () => {
  if (redis) {
    try { await redis.connect(); app.log.info('connected to redis'); }
    catch (err) { app.log.error({ err: err.message }, 'redis connect failed'); }
  } else {
    app.log.warn('REDIS_URL not set — running without a cache');
  }
  await app.listen({ port: PORT, host: '0.0.0.0' });
};
start();
