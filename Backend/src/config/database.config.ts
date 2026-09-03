import { registerAs } from '@nestjs/config';

export default registerAs('database', () => ({
  uri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/sproutly',
  dbName: process.env.MONGODB_DB_NAME || 'sproutly',
}));
