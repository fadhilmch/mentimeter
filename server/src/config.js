import 'dotenv/config';

const requiredInProduction = ['JWT_SECRET', 'MONGODB_URI'];

for (const key of requiredInProduction) {
  if (process.env.NODE_ENV === 'production' && !process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  mongoUri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017/livepoll',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  clientOrigin: process.env.CLIENT_ORIGIN ?? 'http://localhost:5173',
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    serviceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT ?? '',
    // How recently the user must have typed their password to delete the account.
    recentSignInSeconds: Number(process.env.FIREBASE_RECENT_SIGN_IN_SECONDS ?? 300),
  },
  accessCode: {
    length: Number(process.env.ACCESS_CODE_LENGTH ?? 6),
    alphabet: process.env.ACCESS_CODE_ALPHABET ?? '0123456789',
    maxAttempts: Number(process.env.ACCESS_CODE_MAX_ATTEMPTS ?? 25),
  },
};
