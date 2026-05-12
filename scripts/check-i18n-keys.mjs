import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "src");

function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.(tsx?|jsx?)$/.test(e.name)) acc.push(p);
  }
  return acc;
}

const files = walk(srcDir);
const re = /\bt\(\s*["']([^"']+)["']/g;
const keys = new Set();
for (const f of files) {
  const s = fs.readFileSync(f, "utf8");
  let m;
  while ((m = re.exec(s))) keys.add(m[1]);
}

function flattenLeaves(obj, prefix = "") {
  const out = [];
  if (obj === null || typeof obj !== "object") return out;
  for (const [k, v] of Object.entries(obj)) {
    const p = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) continue;
    if (v !== null && typeof v === "object") out.push(...flattenLeaves(v, p));
    else out.push(p);
  }
  return out;
}

const locales = ["es", "en", "de", "fr", "it", "pt"];
const byLocale = {};
for (const loc of locales) {
  const fp = path.join(srcDir, "locales", `${loc}.json`);
  if (!fs.existsSync(fp)) continue;
  const data = JSON.parse(fs.readFileSync(fp, "utf8"));
  byLocale[loc] = new Set(flattenLeaves(data));
}

const missing = {};
for (const k of keys) {
  if (k.includes("{{")) continue;
  for (const loc of locales) {
    if (!byLocale[loc]) continue;
    if (!byLocale[loc].has(k)) {
      if (!missing[k]) missing[k] = [];
      missing[k].push(loc);
    }
  }
}

const list = Object.entries(missing).sort((a, b) =>
  a[0].localeCompare(b[0]),
);
console.log("Total t() keys found:", keys.size);
console.log("Keys missing in at least one locale:", list.length);
for (const [k, locs] of list.slice(0, 120)) console.log(`${k} -> ${locs.join(",")}`);
if (list.length > 120) console.log(`... and ${list.length - 120} more`);
