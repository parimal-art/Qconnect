const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const registerSocket = require('./socket');

const start = async () => {
  await connectDB();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: env.clientUrl, credentials: true },
    pingTimeout: 30000
  });
  app.set('io', io);
  registerSocket(io);

  server.listen(env.port, () => {
    console.log(`API listening on http://localhost:${env.port}`);
  });
};

start().catch(error => {
  console.error('Failed to start server', error);
  process.exit(1);
});
