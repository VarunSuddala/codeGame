import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true });
export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/codearena',
  jwtSecret: process.env.JWT_SECRET,
  origins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean),
  onlineCompilerUrl: (
    process.env.ONLINECOMPILER_API_URL || 'https://api.onlinecompiler.io/api'
  ).replace(/\/$/, ''),
  onlineCompilerKey: process.env.ONLINECOMPILER_API_KEY || '',
  onlineCompilerCompiler: process.env.ONLINECOMPILER_COMPILER || 'python-3.14',
  onlineCompilerConcurrency: Math.max(1, Number(process.env.ONLINECOMPILER_CONCURRENCY || 2)),
  onlineCompilerRetries: Math.max(0, Number(process.env.ONLINECOMPILER_RETRIES || 3)),
};
export function validateEnv() {
  if (!env.jwtSecret || env.jwtSecret.length < 32)
    throw new Error('Set JWT_SECRET to at least 32 random characters in the root .env file.');
  if (!/^mongodb(\+srv)?:\/\//.test(env.mongoUri))
    throw new Error('MONGO_URI must be a MongoDB connection string.');
}
