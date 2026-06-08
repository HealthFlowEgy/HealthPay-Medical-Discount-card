/**
 * End-user (client portal) authentication: national ID + password, with a
 * signed JWT session cookie. Mirrors the ops-auth structure but is a separate
 * audience/cookie so portal clients and ops staff never share a session.
 */

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { AuthError, ConflictError } from "@healthpay/shared";
import { encryptPii, type Database, type Client } from "@healthpay/db";
import { clients } from "@healthpay/db/schema";
import { sha256Hex } from "./crypto.js";
import { env } from "./env.js";

export const CLIENT_COOKIE = "hp_client_session";
const TTL = 30 * 24 * 3600; // 30 days

export interface ClientSession {
  clientId: string;
  fullName: string;
  nationalIdLast4: string;
}

function key(): Uint8Array {
  return new TextEncoder().encode(env.opsSessionSecret);
}

export interface RegisterInput {
  fullName: string;
  nationalId: string; // validated digits
  mobile: string; // E.164
  whatsapp: boolean;
  password: string;
  idCardUrl: string | null;
}

export async function registerClient(db: Database, input: RegisterInput): Promise<Client> {
  const nationalIdHash = sha256Hex(input.nationalId.trim());
  const [existing] = await db
    .select({ id: clients.id })
    .from(clients)
    .where(eq(clients.nationalIdHash, nationalIdHash))
    .limit(1);
  if (existing) throw new ConflictError("An account with this national ID already exists.");

  const [client] = await db
    .insert(clients)
    .values({
      fullName: input.fullName,
      nationalIdHash,
      nationalIdEncrypted: encryptPii(input.nationalId),
      nationalIdLast4: input.nationalId.slice(-4),
      mobileEncrypted: encryptPii(input.mobile),
      mobileE164: input.mobile,
      whatsapp: input.whatsapp,
      idCardUrl: input.idCardUrl,
      passwordHash: await bcrypt.hash(input.password, 10),
    })
    .returning();
  return client!;
}

export async function verifyClientCredentials(
  db: Database,
  nationalId: string,
  password: string,
): Promise<Client> {
  const [client] = await db
    .select()
    .from(clients)
    .where(eq(clients.nationalIdHash, sha256Hex(nationalId.trim())))
    .limit(1);
  if (!client) throw new AuthError("Invalid national ID or password.");
  const ok = await bcrypt.compare(password, client.passwordHash);
  if (!ok) throw new AuthError("Invalid national ID or password.");
  return client;
}

export async function setClientSession(client: Client): Promise<void> {
  const token = await new SignJWT({
    clientId: client.id,
    fullName: client.fullName,
    nationalIdLast4: client.nationalIdLast4,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${TTL}s`)
    .sign(key());
  cookies().set(CLIENT_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: TTL,
  });
}

export function clearClientSession(): void {
  cookies().set(CLIENT_COOKIE, "", { path: "/", maxAge: 0 });
}

export async function getClientSession(): Promise<ClientSession | null> {
  const token = cookies().get(CLIENT_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    return {
      clientId: String(payload.clientId),
      fullName: String(payload.fullName),
      nationalIdLast4: String(payload.nationalIdLast4),
    };
  } catch {
    return null;
  }
}

export async function requireClient(): Promise<ClientSession> {
  const s = await getClientSession();
  if (!s) throw new AuthError("Not authenticated.");
  return s;
}

export async function getClientById(db: Database, id: string): Promise<Client | undefined> {
  const [c] = await db.select().from(clients).where(eq(clients.id, id)).limit(1);
  return c;
}
