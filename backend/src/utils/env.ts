function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const env = {
  get JWT_SECRET() {
    return requireEnv('JWT_SECRET');
  },
  get JWT_REFRESH_SECRET() {
    return requireEnv('JWT_REFRESH_SECRET');
  },
  get DATABASE_URL() {
    return requireEnv('DATABASE_URL');
  },
  get NODE_ENV() {
    return process.env.NODE_ENV || 'development';
  },
  get PORT() {
    return parseInt(process.env.PORT || '3001', 10);
  },
};
