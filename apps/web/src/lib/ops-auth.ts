/**
 * Operations staff authentication.
 *
 * Email/password (bcrypt) with a signed JWT session cookie (jose). Structured so
 * the verification step can be swapped for Keycloak/SSO later without touching
 * route handlers — they only call `requireOpsUser` / `getOpsSession`.
 */

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError, ConflictError } from "@healthpay/shared";
import type { Database } from "@healthpay/db";
import { opsUsers } from "@healthpay/db/schema";
import { env } from "./env.js";

export const OPS_COOKIE = "hp_ops_session";
const SESSION_TTL_SECONDS = 8 * 3600;

export type OpsRole = "agent" | "admin" | "super_admin";

/** Privilege ranking — higher satisfies lower (super_admin ⊇ admin ⊇ agent). */
const ROLE_RANK: Record<OpsRole, number> = { agent: 1, admin: 2, super_admin: 3 };

function coerceRole(value: unknown): OpsRole {
  return value === "super_admin" ? "super_admin" : value === "admin" ? "admin" : "agent";
}

/** True if `role` meets or exceeds the `min` required role. */
export function roleAtLeast(role: OpsRole, min: OpsRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export interface OpsSession {
  userId: string;
  email: string;
  name: string;
  role: OpsRole;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(env.opsSessionSecret);
}

export async function verifyCredentials(
  db: Database,
  email: string,
  password: string,
): Promise<OpsSession> {
  const [user] = await db
    .select()
    .from(opsUsers)
    .where(eq(opsUsers.email, email.toLowerCase().trim()))
    .limit(1);
  if (!user) throw new AuthError("Invalid email or password.");
  if (!user.active) throw new AuthError("This account has been deactivated.");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AuthError("Invalid email or password.");
  return { userId: user.id, email: user.email, name: user.name, role: user.role };
}

/** Create a staff account (self-signup defaults to agent; admins may set role). */
export async function createOpsUser(
  db: Database,
  input: { email: string; name: string; password: string; role: OpsRole },
): Promise<OpsSession> {
  const email = input.email.toLowerCase().trim();
  const [existing] = await db
    .select({ id: opsUsers.id })
    .from(opsUsers)
    .where(eq(opsUsers.email, email))
    .limit(1);
  if (existing) throw new ConflictError("An account with this email already exists.");
  const [user] = await db
    .insert(opsUsers)
    .values({
      email,
      name: input.name,
      passwordHash: await bcrypt.hash(input.password, 10),
      role: input.role,
    })
    .returning();
  return { userId: user!.id, email: user!.email, name: user!.name, role: user!.role };
}

export async function createSessionToken(session: OpsSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

export async function setSessionCookie(session: OpsSession): Promise<void> {
  const token = await createSessionToken(session);
  cookies().set(OPS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearSessionCookie(): void {
  cookies().set(OPS_COOKIE, "", { path: "/", maxAge: 0 });
}

/** Read + verify the current ops session, or null if unauthenticated. */
export async function getOpsSession(): Promise<OpsSession | null> {
  const token = cookies().get(OPS_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    return {
      userId: String(payload.userId),
      email: String(payload.email),
      name: String(payload.name),
      role: coerceRole(payload.role),
    };
  } catch {
    return null;
  }
}

/** Throw AuthError if not authenticated; optionally require a minimum role. */
export async function requireOpsUser(minRole?: OpsRole): Promise<OpsSession> {
  const session = await getOpsSession();
  if (!session) throw new AuthError("Not authenticated.");
  if (minRole && !roleAtLeast(session.role, minRole)) {
    throw new AuthError("Insufficient permissions.");
  }
  return session;
}
