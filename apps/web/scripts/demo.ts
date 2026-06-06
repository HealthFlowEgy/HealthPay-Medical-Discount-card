/**
 * End-to-end happy-path demo.
 *
 *   pnpm --filter @healthpay/web demo        (needs DATABASE_URL + PII_ENCRYPTION_KEY)
 *   pnpm demo                                (seeds first, then runs this)
 *
 * Exercises the real service/transition/webhook/audit code paths:
 *   create request → ops attaches 3 options → fetch hosted quote → user confirms
 *   → confirmed visible to ops + signed webhooks delivered to a local receiver.
 */

import { createServer } from "node:http";
import { createHmac, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb, closeDb, encryptPii } from "@healthpay/db";
import { partners, opsUsers, serviceRequests } from "@healthpay/db/schema";
import {
  createServiceRequest,
  attachOptions,
  confirmRequest,
  getRequestByToken,
  getOptions,
  getRequestById,
} from "../src/lib/requests.js";

const log = (s: string) => console.log(s);
const step = (n: number, s: string) => console.log(`\n\x1b[36m[${n}]\x1b[0m ${s}`);

interface Hook {
  event: string;
  ok: boolean;
}

async function main() {
  const db = getDb();
  const received: Hook[] = [];

  // Local webhook receiver that verifies the signature.
  const webhookSecret = `whsec_demo_${randomBytes(8).toString("hex")}`;
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      const ts = req.headers["x-hp-webhook-timestamp"] as string;
      const sig = req.headers["x-hp-webhook-signature"] as string;
      const expected = createHmac("sha256", webhookSecret).update(`${ts}.${body}`).digest("hex");
      received.push({
        event: (req.headers["x-hp-event"] as string) ?? "?",
        ok: expected === sig,
      });
      res.writeHead(200);
      res.end("ok");
    });
  });
  const port: number = await new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve((server.address() as { port: number }).port));
  });

  // Demo partner pointing its webhook at our receiver.
  const apiKey = `hp_demo_${randomBytes(8).toString("hex")}`;
  const [partner] = await db
    .insert(partners)
    .values({
      name: "Demo Walkthrough Partner",
      apiKeyHash: createHash("sha256").update(apiKey).digest("hex"),
      apiSecretEncrypted: encryptPii(`hps_demo_${randomBytes(8).toString("hex")}`),
      webhookUrl: `http://127.0.0.1:${port}/hook`,
      webhookSecret,
      status: "active",
    })
    .returning();

  // An ops user to attribute the pricing options to.
  let [ops] = await db.select().from(opsUsers).limit(1);
  if (!ops) {
    [ops] = await db
      .insert(opsUsers)
      .values({ email: "demo@healthpay.test", passwordHash: "x", name: "Demo Ops", role: "agent" })
      .returning();
  }

  step(1, "Partner creates a request (provider-type + specialty + member fields)");
  const { request, quoteUrl } = await createServiceRequest(db, partner!, {
    providerType: "labs",
    specialty: "labs",
    governorate: "Cairo",
    area: "Nasr City",
    nationalId: "30101010123451",
    mobile: "+201001234567",
    memberNameEn: "Ahmed Mansour",
    memberNameAr: "أحمد منصور",
    company: "Acme Corp",
    maritalStatus: "married",
    partnerReference: "demo_order_1",
  } as never);
  const token = quoteUrl.split("/quote/")[1]!;
  log(`    id=${request.id} status=${request.status}`);
  log(`    quote_url=${quoteUrl}`);
  log("    → request now appears on the ops live queue (SSE).");

  step(2, "Ops attaches 3 pricing options → request becomes QUOTED");
  await attachOptions(
    db,
    (await getRequestById(db, request.id))!,
    [
      { providerName: "Cairo Medical Center", serviceDescription: "Standard panel", listPrice: 800, discountedPrice: 560 },
      { providerName: "Nile Diagnostics", serviceDescription: "Panel + report", listPrice: 800, discountedPrice: 480 },
      { providerName: "Delta Health Hub", serviceDescription: "Premium package", listPrice: 800, discountedPrice: 360 },
    ],
    ops!.id,
  );

  step(3, "End user opens the hosted quote page (token auth) and sees the cards");
  const quoted = (await getRequestByToken(db, token))!;
  const options = await getOptions(db, quoted.id);
  log(`    status=${quoted.status}`);
  for (const o of options) {
    log(`    • ${o.providerName}: ${o.discountedPrice} EGP (was ${o.listPrice}, -${o.discountPct}%)`);
  }

  step(4, "User confirms one option → request becomes CONFIRMED");
  const chosen = options[1]!;
  await confirmRequest(db, quoted, chosen.id, "hosted_page", { actorType: "user", actorId: quoted.id });
  const final = (await getRequestById(db, request.id))!;
  log(`    status=${final.status}, chosen=${chosen.providerName} (${chosen.discountedPrice} EGP)`);

  // Allow fire-and-forget webhook deliveries to complete.
  await new Promise((r) => setTimeout(r, 700));

  step(5, "Webhooks delivered to the partner (signature verified by receiver)");
  for (const h of received) log(`    ✓ ${h.event}  signature ${h.ok ? "valid" : "INVALID"}`);
  if (received.length === 0) log("    (no webhooks received — check connectivity)");

  log("\n\x1b[32mDemo complete.\x1b[0m Confirmed request is visible to ops with the chosen option.");

  // Clean up demo partner + its requests (requests first — FK is RESTRICT).
  await db.delete(serviceRequests).where(eq(serviceRequests.partnerId, partner!.id));
  await db.delete(partners).where(eq(partners.id, partner!.id));
  await new Promise<void>((r) => server.close(() => r()));
  await closeDb();
}

main().catch(async (err) => {
  console.error("Demo failed:", err);
  await closeDb();
  process.exit(1);
});
