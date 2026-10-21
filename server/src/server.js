import { createServer } from 'node:http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { connectDatabase } from './db.js';
import { config } from './config.js';
import { registerPresentationSockets } from './sockets/presentation.js';

export async function startServer({ port = config.port, mongoUri = config.mongoUri } = {}) {
  await connectDatabase(mongoUri);
  const httpServer = createServer(createApp());
  const io = new Server(httpServer, {
    cors: { origin: config.clientOrigin === '*' ? true : config.clientOrigin.split(',') },
  });
  registerPresentationSockets(io);
  await new Promise((resolve) => httpServer.listen(port, resolve));
  const address = httpServer.address();
  console.log(`Server listening on port ${address.port}`);
  return { httpServer, io, port: address.port };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch((err) => {
    console.error('Failed to start server:', err);
    process.exit(1);
  });
}
