export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  database: {
    host: process.env.DATABASE_HOST ?? 'localhost',
    port: parseInt(process.env.DATABASE_PORT ?? '5432', 10),
    user: process.env.DATABASE_USER ?? 'finance',
    password: process.env.DATABASE_PASSWORD ?? 'finance',
    name: process.env.DATABASE_NAME ?? 'finance_secure',
  },
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET ?? '',
    accessExpires: process.env.JWT_ACCESS_EXPIRES ?? '15m',
    refreshExpiresDays: parseInt(process.env.JWT_REFRESH_EXPIRES_DAYS ?? '14', 10),
  },
  masterEncryptionKeyB64: process.env.MASTER_ENCRYPTION_KEY ?? '',
  typeormSync: process.env.TYPEORM_SYNC === 'true',
  oidc: {
    issuer: process.env.OIDC_ISSUER ?? '',
    audience: process.env.OIDC_AUDIENCE ?? '',
    jwksUri: process.env.OIDC_JWKS_URI ?? '',
  },
});
