import { createGameServer } from './server.js';

const corsOrigins = (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const server = createGameServer({ corsOrigins, socketPath: process.env.SOCKET_PATH ?? '/socket.io' });
const port = Number(process.env.PORT ?? 3001);

server.listen(port).then((actualPort) => {
  process.stdout.write(`Game server listening on ${actualPort}\n`);
}).catch(() => {
  process.stderr.write('Game server failed to start\n');
  process.exitCode = 1;
});

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void server.close().then(() => process.exit(0));
  });
}
