import { createServer } from 'node:http';
import mongoose from 'mongoose';
import { createApp } from './app.js';
import { connectDatabase } from './config/database.js';
import { env, validateEnv } from './config/env.js';
import { attachSockets } from './sockets/index.js';
import { reconcileAll } from './services/contestService.js';
import { runWorkerTick } from './services/judgeService.js';
validateEnv();
await connectDatabase();
await reconcileAll();
const server = createServer(createApp());
const io = attachSockets(server);
const timer = setInterval(() => {
  reconcileAll().catch((e) => console.error('Reconciliation failed:', e.message));
  runWorkerTick().catch((e) => console.error('Judging worker failed:', e.message));
}, 1000);
server.listen(env.port, '0.0.0.0', () =>
  console.log(`CodeArena listening on http://localhost:${env.port} (LAN enabled)`),
);
async function shutdown() {
  clearInterval(timer);
  io.close();
  server.close();
  await mongoose.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
