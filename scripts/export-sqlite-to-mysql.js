/**
 * Export prisma/dev.db (SQLite) → SQL INSERT untuk MySQL (phpMyAdmin).
 * Usage: node scripts/export-sqlite-to-mysql.js
 */
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const dbPath = path.join(__dirname, "..", "prisma", "dev.db");
const outPath = path.join(__dirname, "..", "deploy-fix", "data-from-local.sql");

const db = new Database(dbPath, { readonly: true });

const tables = db
  .prepare(
    `SELECT name FROM sqlite_master
     WHERE type='table'
       AND name NOT LIKE 'sqlite_%'
       AND name NOT LIKE '_prisma%'
     ORDER BY name`,
  )
  .all()
  .map((r) => r.name);

// Urutan insert agar FK aman
const preferredOrder = [
  "User",
  "CashSource",
  "Category",
  "Project",
  "ProjectAssignment",
  "ProjectFund",
  "FundingStage",
  "WorkItem",
  "Contractor",
  "ContractorAdvance",
  "ContractorExpense",
  "Transaction",
  "CashTransfer",
  "MandorDisbursement",
];

const ordered = [
  ...preferredOrder.filter((t) => tables.includes(t)),
  ...tables.filter((t) => !preferredOrder.includes(t)),
];

function toMysqlDateTime(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n, w = 2) => String(n).padStart(w, "0");
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` +
    ` ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}` +
    `.${pad(d.getUTCMilliseconds(), 3)}`
  );
}

function sqlLiteral(value, columnName = "") {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "NULL";
    return String(value);
  }
  if (typeof value === "bigint") return String(value);
  if (typeof value === "boolean") return value ? "1" : "0";
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString("hex")}'`;
  }
  let s = String(value);
  // Prisma SQLite DateTime sering ISO + timezone → ubah ke DATETIME(3) MySQL
  if (
    /At$|Date$|createdAt|updatedAt|^date$/i.test(columnName) ||
    /^\d{4}-\d{2}-\d{2}T/.test(s)
  ) {
    const mysql = toMysqlDateTime(s);
    if (mysql) return `'${mysql}'`;
  }
  s = s.replace(/\\/g, "\\\\").replace(/'/g, "''");
  return `'${s}'`;
}

function escapeIdent(name) {
  return `\`${name.replace(/`/g, "``")}\``;
}

const lines = [];
lines.push("-- Generated from local prisma/dev.db");
lines.push("-- Import di phpMyAdmin → database u6424712__kasproyek");
lines.push("SET FOREIGN_KEY_CHECKS=0;");
lines.push("SET NAMES utf8mb4;");
lines.push("");
lines.push("-- Hapus akun seed minimal supaya tidak bentrok username unik");
lines.push("DELETE FROM `User` WHERE `id` LIKE 'cmseed%';");
lines.push("DELETE FROM `CashSource` WHERE `id` LIKE 'cmseed%';");
lines.push("DELETE FROM `Category` WHERE `id` LIKE 'cmseed%';");
lines.push("");

for (const table of ordered) {
  const count = db.prepare(`SELECT COUNT(*) AS c FROM "${table}"`).get().c;
  console.log(`${table}: ${count}`);
  if (count === 0) continue;

  const cols = db.prepare(`PRAGMA table_info("${table}")`).all().map((c) => c.name);
  const rows = db.prepare(`SELECT * FROM "${table}"`).all();

  lines.push(`-- ${table} (${rows.length} rows)`);
  // Hapus data seed minimal yang bentrok id/username jika ada, lalu insert ulang dari lokal
  // Untuk User: replace by primary key
  const colList = cols.map(escapeIdent).join(", ");

  for (const row of rows) {
    const values = cols.map((c) => sqlLiteral(row[c], c)).join(", ");
    lines.push(
      `REPLACE INTO ${escapeIdent(table)} (${colList}) VALUES (${values});`,
    );
  }
  lines.push("");
}

lines.push("SET FOREIGN_KEY_CHECKS=1;");

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, lines.join("\n"), "utf8");
console.log(`\nWrote ${outPath}`);
console.log(`Size: ${(fs.statSync(outPath).size / 1024).toFixed(1)} KB`);
