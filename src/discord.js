'use strict';
/**
 * Discord nickname sync.
 * Sets each member's server nickname to "IGN | GS 2177 | CP 102,299" using the Main tab.
 * Members are matched by the sheet's "Discord ID" column (username, display name, or numeric user ID).
 */
const L = require('./lib');

const API = 'https://discord.com/api/v10';
const MAX_NICK = 32;
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------- nickname

function cpShort(cp) {
  if (cp >= 1e6) return (Math.round(cp / 1e5) / 10) + 'm';
  if (cp >= 1e3) return (Math.round(cp / 100) / 10) + 'k';
  return String(cp);
}

const len = s => [...s].length;                 // count characters, not UTF-16 units
const cut = (s, n) => [...s].slice(0, Math.max(0, n)).join('');

function fill(tpl, ign, gs, cp) {
  return tpl
    .replace('{ign}', ign)
    .replace('{gs}', String(gs))
    .replace('{cpk}', cpShort(cp))
    .replace('{cp}', cp.toLocaleString('en-US'));
}

/** First template that fits 32 chars; otherwise the last template with the IGN shortened. */
function buildNick(ign, gs, cp, formats) {
  ign = L.clean(ign);
  for (const tpl of formats) {
    const s = fill(tpl, ign, gs, cp);
    if (len(s) <= MAX_NICK) return s;
  }
  const last = formats[formats.length - 1];
  const rest = len(fill(last, '', gs, cp));
  return fill(last, cut(ign, MAX_NICK - rest), gs, cp);
}

// ---------------------------------------------------------------- matching

const norm = s => L.clean(s).toLowerCase().replace(/^@+/, '');
const isSnowflake = s => /^\d{17,20}$/.test(L.clean(s));

/** Possible Discord names for a sheet value: "Halycon#2450" -> halycon; "Yza / Kamasylvia" -> yza, kamasylvia. */
function candidateKeys(value) {
  const v = norm(value);
  if (!v) return [];
  const keys = [v, v.replace(/#\d{1,4}$/, '').trim()];
  for (const part of v.split(/[\/|,]+/)) keys.push(part.trim(), part.replace(/#\d{1,4}$/, '').trim());
  return [...new Set(keys.filter(Boolean))];
}

function indexMembers(members) {
  const byId = new Map(), username = new Map(), display = new Map(), nick = new Map();
  const add = (map, k, m) => { if (!k) return; k = norm(k); if (!map.has(k)) map.set(k, []); map.get(k).push(m); };
  for (const m of members) {
    if (!m.user || m.user.bot) continue;
    byId.set(m.user.id, m);
    add(username, m.user.username, m);
    add(display, m.user.global_name, m);
    add(nick, m.nick, m);
  }
  return { byId, username, display, nick };
}

/** Returns { member, how } or { error }. Only accepts unambiguous matches. */
function findMember(value, idx) {
  if (isSnowflake(value)) {
    const m = idx.byId.get(L.clean(value));
    return m ? { member: m, how: 'user ID' } : { error: 'no member with that user ID' };
  }
  const keys = candidateKeys(value);
  for (const [map, how] of [[idx.username, 'username'], [idx.display, 'display name'], [idx.nick, 'nickname']]) {
    for (const k of keys) {
      const hits = map.get(k);
      if (!hits) continue;
      if (hits.length === 1) return { member: hits[0], how };
      return { error: `${hits.length} members share the ${how} "${k}"` };
    }
  }
  return { error: 'no matching member' };
}

// ---------------------------------------------------------------- Discord REST

function client(token, log) {
  return async function call(method, path, body, reason) {
    for (let attempt = 1; attempt <= 5; attempt++) {
      const headers = {
        Authorization: 'Bot ' + token,
        'User-Agent': 'DiscordBot (https://github.com, 1.0) aion2-gs-sync',
      };
      if (body) headers['Content-Type'] = 'application/json';
      if (reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(reason);
      const res = await fetch(API + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
      if (res.status === 429) {
        const j = await res.json().catch(() => ({}));
        const wait = Math.ceil(((j.retry_after || 1) * 1000)) + 250;
        log(`   Discord rate limit, waiting ${(wait / 1000).toFixed(1)}s`);
        await sleep(wait);
        continue;
      }
      const data = res.status === 204 ? null : await res.json().catch(() => null);
      return { status: res.status, data };
    }
    return { status: 429, data: { message: 'rate limited too many times' } };
  };
}

async function listMembers(call, guildId) {
  const all = [];
  let after = '0';
  for (;;) {
    const r = await call('GET', `/guilds/${guildId}/members?limit=1000&after=${after}`);
    if (r.status !== 200) return r;
    all.push(...r.data);
    if (r.data.length < 1000) break;
    after = r.data[r.data.length - 1].user.id;
  }
  return { status: 200, data: all };
}

// ---------------------------------------------------------------- main step

/**
 * rows: [{ row, discordId, ign, gs, cp }] from the Main tab.
 * Returns stats. Never throws for per-member problems.
 */
async function syncNicknames({ rows, token, guildId, dcfg, dryRun, log }) {
  const call = client(token, log);
  const stats = { matched: 0, renamed: 0, unchanged: 0, unmatched: 0, skipped: 0, failed: 0 };

  log('---- Discord nicknames ----');
  const guild = await call('GET', `/guilds/${guildId}`);
  if (guild.status === 401) throw new Error('Discord rejected the bot token (check the DISCORD_TOKEN secret)');
  if (guild.status === 403 || guild.status === 404) throw new Error('Bot is not in that server, or DISCORD_GUILD_ID is wrong');
  if (guild.status !== 200) throw new Error('Discord GET guild failed: HTTP ' + guild.status);
  const ownerId = guild.data.owner_id;
  const rolePos = new Map((guild.data.roles || []).map(r => [r.id, r.position]));
  const topRole = roles => Math.max(0, ...(roles || []).map(id => rolePos.get(id) || 0));

  const me = await call('GET', '/users/@me');
  const meMember = await call('GET', `/guilds/${guildId}/members/${me.data.id}`);
  const botTop = topRole(meMember.data && meMember.data.roles);

  const mem = await listMembers(call, guildId);
  if (mem.status !== 200) {
    throw new Error(`Could not list server members (HTTP ${mem.status}). Turn on "Server Members Intent" ` +
      'in the Discord Developer Portal → your app → Bot.');
  }
  const idx = indexMembers(mem.data);
  log(`Server "${guild.data.name}": ${idx.byId.size} members | sheet rows with a Discord ID: ${rows.length}`);

  const exclude = new Set((dcfg.exclude || []).map(norm));
  const claimed = new Map(); // member id -> sheet row that claimed it
  const noPerm = [];
  let consecutive403 = 0;

  for (const r of rows) {
    const found = findMember(r.discordId, idx);
    if (found.error) {
      stats.unmatched++;
      log(`   ? row ${r.row} "${r.discordId}" (${r.ign}): ${found.error}`);
      continue;
    }
    const m = found.member, uid = m.user.id;
    const who = `${m.user.username}${m.nick ? ' / ' + m.nick : ''}`;
    if (claimed.has(uid)) {
      log(`   ↷ row ${r.row} "${r.discordId}": same member as row ${claimed.get(uid)}, using the first row`);
      continue;
    }
    claimed.set(uid, r.row);
    stats.matched++;

    if (exclude.has(norm(m.user.username)) || exclude.has(uid)) { stats.skipped++; continue; }
    if (!L.isGood(r.gs) || !L.isGood(r.cp)) { stats.skipped++; continue; } // TBC / Invalid IGN: leave alone
    if (uid === ownerId) { stats.skipped++; noPerm.push(who + ' (server owner)'); continue; }
    if (topRole(m.roles) >= botTop) { stats.skipped++; noPerm.push(who + ' (role above the bot)'); continue; }

    const nick = buildNick(r.ign, r.gs, r.cp, dcfg.formats);
    if (m.nick === nick) { stats.unchanged++; continue; }

    if (dryRun) { stats.renamed++; log(`   (dry run) ${who} → "${nick}"`); continue; }
    if (consecutive403 >= 3) { stats.failed++; continue; }

    const res = await call('PATCH', `/guilds/${guildId}/members/${uid}`, { nick }, 'AION 2 GS/CP sync');
    if (res.status === 200 || res.status === 204) {
      stats.renamed++; consecutive403 = 0;
      log(`   ✏️  ${who} → "${nick}"`);
    } else {
      stats.failed++;
      if (res.status === 403) consecutive403++;
      log(`   ❌ ${who}: HTTP ${res.status} ${res.data && res.data.message ? res.data.message : ''}`);
      if (consecutive403 === 3) log('   Stopping renames: the bot needs "Manage Nicknames" and its role must be above members\' roles.');
    }
    await sleep(dcfg.delayMs || 250);
  }

  if (noPerm.length) log(`   Can't rename (Discord doesn't allow it): ${noPerm.join(', ')}`);
  log(`Discord: ${stats.matched} matched | ✏️ ${stats.renamed} renamed | ${stats.unchanged} unchanged | ` +
      `${stats.skipped} skipped | ❓ ${stats.unmatched} unmatched | ❌ ${stats.failed} failed`);
  return stats;
}

module.exports = { buildNick, cpShort, candidateKeys, indexMembers, findMember, syncNicknames };
