'use strict';
const Redis = require('ioredis');

const RELEASE = process.env.LIFTOFF_COMMIT || 'dev';
const redisUrl = process.env.REDIS_URL;

if (!redisUrl) {
  console.error('[worker] REDIS_URL is not set — nothing to consume');
  process.exit(1);
}

const redis = new Redis(redisUrl, { maxRetriesPerRequest: null });

console.log(`[worker] starting (release ${RELEASE})`);

async function loop() {
  for (;;) {
    try {
      const popped = await redis.brpop('pulsechat:events', 5);
      if (!popped) {
        console.log('[worker] idle — no events in the last 5s');
        continue;
      }
      const event = JSON.parse(popped[1]);
      await redis.hincrby('pulsechat:counters', event.room, 1);
      console.log(`[worker] counted a ${event.type} in room "${event.room}"`);
    } catch (error) {
      console.error('[worker] loop error:', error.message);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}

loop();
