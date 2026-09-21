process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  "postgresql://codesync:codesync_ci@localhost:5433/codesync";
process.env.REDIS_URL = "redis://localhost:6379";
process.env.JWT_SECRET = "test-ci-secret-for-local-tests";
