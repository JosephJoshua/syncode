/**
 * Tests Redis connectivity (BullMQ's backing store).
 *
 * Usage: node healthcheck-worker.mjs
 * Exit code 0 = healthy, 1 = unhealthy
 */
import { createConnection } from 'node:net';

const url = new URL(process.env.REDIS_URL || 'redis://localhost:6379');
const host = url.hostname;
const port = Number(url.port) || 6379;

const socket = createConnection({ host, port }, () => {
  socket.end();
  process.exit(0);
});

socket.setTimeout(3000);
socket.on('timeout', () => {
  socket.destroy();
  process.exit(1);
});

socket.on('error', () => {
  process.exit(1);
});
