import { betterAuth } from "better-auth";
import { nextCookies } from "better-auth/next-js";
import { bearer, username } from "better-auth/plugins";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required.");
}

const globalForBetterAuth = globalThis as unknown as {
  betterAuthPool?: Pool;
};

const database =
  globalForBetterAuth.betterAuthPool ??
  new Pool({
    connectionString,
    max: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForBetterAuth.betterAuthPool = database;
}

const trustedOrigins = [
  "http://localhost:3000",
  "http://localhost:*",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:*",
  "http://10.0.2.2:3000",
  "http://10.0.2.2:*",
  ...(process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
];

export const auth = betterAuth({
  database,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: "kasir",
      },
    },
  },
  plugins: [username(), bearer(), nextCookies()],
});
