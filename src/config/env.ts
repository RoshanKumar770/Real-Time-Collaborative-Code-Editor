const requiredEnvVars = [
  "DATABASE_URL",
  "REDIS_URL",
  "JWT_SECRET",
] as const;

export function validateEnvironment(): void {
  const missing = requiredEnvVars.filter((key) => {
    const value = process.env[key];
    return !value || value.trim() === "";
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }

  if (process.env.NODE_ENV === "production") {
    const jwtSecret = process.env.JWT_SECRET!;

    if (jwtSecret.length < 32) {
      throw new Error(
        "JWT_SECRET must be at least 32 characters in production"
      );
    }

    if (
      jwtSecret === "change-this-to-a-long-random-secret" ||
      jwtSecret.includes("change-this")
    ) {
      throw new Error(
        "JWT_SECRET is using an insecure default value"
      );
    }
  }
}
