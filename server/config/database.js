import mongoose from 'mongoose';
import { env } from './env.js';
mongoose.set('strictQuery', true);
// Filters are constructed by services from Zod-validated scalar values, never request objects.
export async function connectDatabase(uri = env.mongoUri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  await Promise.all(Object.values(mongoose.models).map((model) => model.init()));
  return mongoose.connection;
}
