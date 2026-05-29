const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const connectDB = require('./config/db');
const env = require('./config/env');
const registerSocket = require('./socket');
const { runTrackingSweep } = require('./services/trackingService');

const start = async () => {
  await connectDB();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: {
      origin: env.clientUrl,
      credentials: true
    }
  });

  app.set('io', io);
  registerSocket(io);

  setInterval(() => {
    runTrackingSweep().catch(error => {
      console.error('Tracking sweep failed', error);
    });
  }, 60 * 1000);

  server.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

start().catch(error => {
  console.error(error);
  process.exit(1);
});
