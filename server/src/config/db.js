const mongoose = require('mongoose');
const env = require('./env');

const connectDB = async () => {
  mongoose.set('strictQuery', true);
  await mongoose.connect(env.mongoUri, { autoIndex: env.nodeEnv !== 'production' });
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
};

module.exports = connectDB;
