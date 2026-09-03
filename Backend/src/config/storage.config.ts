import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  driver: process.env.STORAGE_DRIVER || 'local',
  localPath: process.env.STORAGE_LOCAL_PATH || './uploads',
  maxFileSize: parseInt(process.env.STORAGE_MAX_FILE_SIZE || '10485760', 10),
  s3: {
    bucket: process.env.S3_BUCKET || '',
    region: process.env.S3_REGION || '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || '',
    endpoint: process.env.S3_ENDPOINT || '',
  },
}));
