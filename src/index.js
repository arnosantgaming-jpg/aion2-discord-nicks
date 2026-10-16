'use strict';
/**
 * AION 2 Discord nicknames
 * Reads Discord ID + IGN + Gear Score + Combat Power from the Main tab (read-only)
 * and sets each member's server nickname to e.g. "Arno | GS 2177 | CP 102,299".
 *
 * Env:
 *   SHEET_ID            spreadsheet ID (from its URL)
 *   GOOGLE_CREDENTIALS  service-account JSON (the whole file contents)
 *   DISCORD_TOKEN       bot token
 *   DISCORD_GUILD_ID    server ID
 *   DRY_RUN=1           optional: show what would change, rename nobody
 */
const fs = require('fs');
const cfg = require('../config');
const { Sheets } = require('./sheets');
const L = require('./lib');
const { syncNicknames } = require('./discord');

const DRY_RUN = process.env.DRY_RUN === '1';
const log = (...a) => console.log(...a);

/** Reads the Main tab and returns [{row, discordId, ign, gs, cp}]. */
async function readRows(sheets) {
  const meta = await sheets.meta();
  if (!meta.sheets.some(s => s.title === cfg.sheet)) throw new Error(`Tab "${cfg.sheet}" not found in the sheet`);

  const c = cfg.columns, s = cfg.startRow;
  const [hdrRows] = await sheets.batchGet([L.quoteSheet(cfg.sheet) + '!' + (s - 1) + ':' + (s - 1)]);
  const hdr = (hdrRows[0] || []).map(L.clean);
  const problems = [];
  if (!/gear/i.test(hdr[c.gs - 1] || ''))   problems.push(`column ${L.colLetter(c.gs)} is "${hdr[c.gs - 1] || ''}", expected Gear Score`);
  if (!/combat/i.test(hdr[c.cp - 1] || '')) problems.push(`column ${L.colLetter(c.cp)} is "${hdr[c.cp - 1] || ''}", expected Combat Power`);
  if (problems.length) throw new Error(problems.join('; ') + '. Update config.js.');

  const res = await sheets.batchGet([
    L.colRange(cfg.sheet, c.discordId, s), L.colRange(cfg.sheet, c.ign, s),
    L.colRange(cfg.sheet, c.gs, s), L.colRange(cfg.sheet, c.cp, s),
  ]);
  const n = Math.max(...res.map(r => r.length));
  const [ids, igns, gss, cps] = res.map(r => L.column(r, n));
  const rows = [];
  for (let i = 0; i < n; i++) {
    const discordId = L.clean(ids[i]), ign = L.clean(igns[i]);
    if (discordId && ign) rows.push({ row: i + s, discordId, ign, gs: gss[i], cp: cps[i] });
  }
  return rows;
}

async function main({ sheets, token, guildId }) {
  const t0 = Date.now();
  log(`===== DISCORD NICKNAMES ${new Date().toISOString()} ${DRY_RUN ? '(DRY RUN)' : ''} =====`);
  const rows = await readRows(sheets);
  const stats = await syncNicknames({ rows, token, guildId, dcfg: cfg, dryRun: DRY_RUN, log });
  log(`===== DONE in ${((Date.now() - t0) / 1000).toFixed(1)}s =====`);

  if (process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,
      `### Discord nicknames${DRY_RUN ? ' (dry run)' : ''}\n\n| Matched | Renamed | Unchanged | Skipped | Unmatched | Failed |\n|---|---|---|---|---|---|\n` +
      `| ${stats.matched} | ${stats.renamed} | ${stats.unchanged} | ${stats.skipped} | ${stats.unmatched} | ${stats.failed} |\n`);
  }
  if (stats.failed && !stats.renamed && !stats.unchanged) process.exitCode = 1;
  return stats;
}

module.exports = { main, readRows };

if (require.main === module) {
  (async () => {
    const need = ['SHEET_ID', 'GOOGLE_CREDENTIALS', 'DISCORD_TOKEN', 'DISCORD_GUILD_ID'].filter(k => !process.env[k]);
    if (need.length) throw new Error('Missing secret(s): ' + need.join(', '));
    let creds;
    try { creds = JSON.parse(process.env.GOOGLE_CREDENTIALS); }
    catch { throw new Error('GOOGLE_CREDENTIALS is not valid JSON (paste the whole service-account .json file)'); }
    await main({
      sheets: new Sheets(process.env.SHEET_ID, creds),
      token: process.env.DISCORD_TOKEN,
      guildId: process.env.DISCORD_GUILD_ID,
    });
  })().catch(err => {
    console.error('❌ FATAL:', err && err.response && err.response.data ? JSON.stringify(err.response.data) : (err.message || err));
    process.exit(1);
  });
}
