/** Thin re-export of the shared Drizzle client + schema for the app. */
export { getDb, type Database } from "@healthpay/db";
export * as schema from "@healthpay/db/schema";
export { encryptPii, decryptPii } from "@healthpay/db";
