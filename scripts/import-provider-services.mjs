/**
 * Import per-provider services from an Excel file into HealthPay.
 *
 *   BASE_URL=https://... CRON_SECRET=... \
 *     node scripts/import-provider-services.mjs <file.xlsx>
 *
 * Expected columns (auto-detected by header, Arabic or English):
 *   - provider name   (اسم مقدم الخدمة / مقدم الخدمة / الاسم / provider / name)
 *   - governorate     (المحافظة / governorate)         [optional, for disambiguation]
 *   - service         (الخدمة / الخدمات / service)
 * One service per row; a cell with several services separated by ، , or newlines
 * is also split. Rows are grouped per provider and posted in batches.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

const file = process.argv[2];
const BASE = process.env.BASE_URL;
const SECRET = process.env.CRON_SECRET;
if (!file || !BASE || !SECRET) {
  console.error("Usage: BASE_URL=.. CRON_SECRET=.. node scripts/import-provider-services.mjs <file.xlsx>");
  process.exit(1);
}

// Unzip xlsx to a temp dir and parse the first sheet.
const tmp = `/tmp/xlsx-import-${Date.now()}`;
execSync(`mkdir -p ${tmp} && cd ${tmp} && unzip -o ${JSON.stringify(file)} >/dev/null`, { stdio: "ignore" });
const dec = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
const ss = readFileSync(`${tmp}/xl/sharedStrings.xml`, "utf8");
const strings = [];
for (const m of ss.matchAll(/<si>([\s\S]*?)<\/si>/g)) {
  strings.push([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((x) => dec(x[1])).join(""));
}
const xml = readFileSync(`${tmp}/xl/worksheets/sheet1.xml`, "utf8");
const rows = {};
for (const c of xml.matchAll(/<c r="([A-Z]+)(\d+)"(?:[^>]*?\st="([a-z]+)")?[^>]*>(?:<v>([\s\S]*?)<\/v>|<is><t[^>]*>([\s\S]*?)<\/t><\/is>)?<\/c>/g)) {
  const col = c[1], r = +c[2], t = c[3], v = c[4], inl = c[5];
  const val = inl != null ? dec(inl) : v != null ? (t === "s" ? strings[+v] ?? "" : v) : "";
  (rows[r] = rows[r] || {})[col] = String(val).replace(/[\r\n]+/g, " ").trim();
}
const rnums = Object.keys(rows).map(Number).sort((a, b) => a - b);
const header = rows[rnums[0]] || {};
const cols = Object.keys(header);

function findCol(patterns) {
  for (const col of cols) {
    const h = (header[col] || "").toLowerCase();
    if (patterns.some((p) => h.includes(p))) return col;
  }
  return null;
}
let nameCol = findCol(["اسم مقدم", "مقدم الخدمة", "الاسم", "provider", "name"]);
const govCol = findCol(["محافظ", "governorate"]);
let svcCol = findCol(["خدم", "service"]);
// Fallback: 2-column files -> name, service.
if (!nameCol) nameCol = cols[0];
if (!svcCol) svcCol = cols[cols.length - 1];
console.log(`columns -> name:${nameCol} governorate:${govCol ?? "-"} service:${svcCol}`);

const grouped = new Map(); // key: name|gov -> {providerName, governorate, services:Set}
for (const r of rnums.slice(1)) {
  const row = rows[r];
  const name = (row[nameCol] || "").trim();
  const gov = govCol ? (row[govCol] || "").trim() : "";
  const raw = (row[svcCol] || "").trim();
  if (!name || !raw) continue;
  const services = raw.split(/[،,\n]+/).map((s) => s.trim()).filter(Boolean);
  const key = `${name}|${gov}`;
  if (!grouped.has(key)) grouped.set(key, { providerName: name, governorate: gov || undefined, services: new Set() });
  for (const s of services) grouped.get(key).services.add(s);
}
const items = [...grouped.values()].map((g) => ({ ...g, services: [...g.services] }));
console.log(`grouped providers: ${items.length}, total service rows: ${items.reduce((a, b) => a + b.services.length, 0)}`);

// Post in batches.
const BATCH = 400;
let matched = 0, inserted = 0, unmatched = 0;
for (let i = 0; i < items.length; i += BATCH) {
  const res = await fetch(`${BASE}/api/v1/internal/provider-services/import`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({ items: items.slice(i, i + BATCH), replace: true }),
  });
  const j = await res.json();
  if (!res.ok) { console.error("batch failed", res.status, JSON.stringify(j)); process.exit(1); }
  matched += j.matchedProviders; inserted += j.servicesInserted; unmatched += j.unmatchedCount;
  process.stdout.write(`.`);
}
console.log(`\nDone. matched providers: ${matched}, services inserted: ${inserted}, unmatched: ${unmatched}`);
