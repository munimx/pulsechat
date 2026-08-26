# PulseChat

A three-service chat demo deployed with [Liftoff](https://tryliftoff.tech).

| Service  | Kind       | Port | Notes                                        |
|----------|------------|------|----------------------------------------------|
| `web`    | web        | 3000 | Static UI, proxies the API over its link     |
| `api`    | web        | 3000 | Fastify REST API, reads and writes Redis     |
| `worker` | worker     | —    | Drains `pulsechat:events` and counts rooms   |

`web` reaches `api` through the service link Liftoff injects as
`INTERNAL_API_URL`; `GET /link-check` on the web service proves it resolves.
Both `api` and `worker` need a Redis resource bound as `REDIS_URL`.
