'use strict';
const test = require('node:test');
const assert = require('node:assert');
const D = require('../src/discord');
const cfg = require('../config');
const F = cfg.formats;

test('buildNick picks the longest format that fits 32 chars', () => {
  assert.equal(D.buildNick('Arno', 2177, 102299, F), 'Arno | GS 2177 | CP 102,299');
  assert.equal(D.buildNick('Zeraphynez', 2712, 139736, F), 'Zeraphynez | GS 2712 | CP 139.7k');
  assert.equal(D.buildNick('Mayumi1', 2338, 116466, F), 'Mayumi1 | GS 2338 | CP 116,466');
  assert.equal(D.buildNick('CoconutMochi', 2131, 95944, F), 'CoconutMochi | 2131 | 95.9k'); // 33 chars with labels
  assert.equal(D.buildNick('Charkwayteowww', 2153, 87076, F), 'Charkwayteowww | 2153 | 87.1k');
  const long = D.buildNick('ThisIsAVeryLongCharacterName', 2131, 95944, F);
  assert.equal([...long].length, 32, long);
  assert.equal(long, 'ThisIsAVeryLongCh | 2131 | 95.9k');
  assert.equal(D.buildNick('墨颜', 2206, 100374, F), '墨颜 | GS 2206 | CP 100,374');
  assert.equal(D.buildNick('Smol', 0, 1832, F), 'Smol | GS 0 | CP 1,832');
});

test('candidateKeys handles tags, @ and combined names', () => {
  assert.deepEqual(D.candidateKeys('Halycon#2450'), ['halycon#2450', 'halycon']);
  assert.ok(D.candidateKeys('Yza / Kamasylvia').includes('kamasylvia'));
  assert.ok(D.candidateKeys('@Zeal').includes('zeal'));
  assert.deepEqual(D.candidateKeys(''), []);
});

const M = (id, username, global_name, nick, roles = ['r_mem']) => ({ user: { id, username, global_name }, nick, roles });

test('findMember: username > display name > nickname, unique only, user ID supported', () => {
  const idx = D.indexMembers([
    M('100000000000000001', 'zeal', 'Zeal', null),
    M('100000000000000002', 'halycon', 'Halycon', null),
    M('100000000000000003', 'casketdealer', 'Casket Dealer', null),
    M('100000000000000004', 'twin1', 'Twin', null),
    M('100000000000000005', 'twin2', 'Twin', null),
    M('100000000000000006', 'kamasylvia_', 'Kamasylvia', 'Yza'),
    { user: { id: '9', username: 'somebot', bot: true } },
  ]);
  assert.equal(D.findMember('Zeal', idx).member.user.id, '100000000000000001');
  assert.equal(D.findMember('Halycon#2450', idx).how, 'username');
  assert.equal(D.findMember('Casket Dealer', idx).how, 'display name');
  assert.match(D.findMember('Twin', idx).error, /2 members/);
  assert.equal(D.findMember('Yza / Kamasylvia', idx).member.user.id, '100000000000000006');
  assert.equal(D.findMember('100000000000000002', idx).how, 'user ID');
  assert.match(D.findMember('nobody', idx).error, /no matching/);
  assert.match(D.findMember('somebot', idx).error, /no matching/, 'bots are ignored');
});

test('syncNicknames: renames, skips owner/high roles/TBC, handles 429, only changed', async () => {
  const patches = [];
  let rateLimited = false;
  const members = [
    M('1', 'owner', 'Owner', null),                       // server owner
    M('2', 'arno', 'Arno', null),
    M('3', 'zen', 'Zen', 'Zen | GS 1733 | CP 76,123'),    // already correct
    M('4', 'admin', 'Admin', null, ['r_admin']),          // role above bot
    M('5', 'ahbeer', 'AhBeer', null),                     // TBC row
    M('6', 'yam', 'Yam', 'my nick'),
  ];
  global.fetch = async (url, opt = {}) => {
    const path = url.replace('https://discord.com/api/v10', '');
    const json = (status, body) => ({ status, json: async () => body });
    if (opt.method === 'GET' && path === '/guilds/G') return json(200, { name: 'Kopitiam', owner_id: '1',
      roles: [{ id: 'r_mem', position: 1 }, { id: 'r_bot', position: 5 }, { id: 'r_admin', position: 10 }] });
    if (path === '/users/@me') return json(200, { id: 'bot' });
    if (path === '/guilds/G/members/bot') return json(200, { roles: ['r_bot'] });
    if (path.startsWith('/guilds/G/members?')) return json(200, members);
    if (opt.method === 'PATCH') {
      if (!rateLimited) { rateLimited = true; return json(429, { retry_after: 0.01 }); }
      patches.push([path.split('/').pop(), JSON.parse(opt.body).nick, opt.headers['X-Audit-Log-Reason']]);
      return json(200, {});
    }
    throw new Error('unexpected ' + opt.method + ' ' + path);
  };
  const rows = [
    { row: 2, discordId: 'Owner', ign: 'Boss', gs: 2000, cp: 100000 },
    { row: 3, discordId: 'Arno', ign: 'Arno', gs: 2177, cp: 102299 },
    { row: 4, discordId: 'zen', ign: 'Zen', gs: 1733, cp: 76123 },
    { row: 5, discordId: 'Admin', ign: 'Adm', gs: 1, cp: 1 },
    { row: 6, discordId: 'AhBeer', ign: 'TBC', gs: 'Invalid IGN', cp: 'Invalid IGN' },
    { row: 7, discordId: 'Yam', ign: 'Yam', gs: 1829, cp: 92419 },
    { row: 8, discordId: 'Ghosty', ign: 'Ghost', gs: 1, cp: 1 },
    { row: 9, discordId: 'arno', ign: 'ArnoAlt', gs: 1, cp: 1 },       // duplicate member -> first row wins
  ];
  const logs = [];
  const s = await D.syncNicknames({ rows, token: 't', guildId: 'G', dcfg: { ...cfg, delayMs: 0 }, dryRun: false, log: m => logs.push(m) });
  assert.deepEqual(patches.map(p => p.slice(0, 2)), [['2', 'Arno | GS 2177 | CP 102,299'], ['6', 'Yam | GS 1829 | CP 92,419']]);
  assert.equal(patches[0][2], 'AION%202%20GS%2FCP%20sync');
  assert.deepEqual(s, { matched: 6, renamed: 2, unchanged: 1, unmatched: 1, skipped: 3, failed: 0 });
  assert.ok(logs.some(l => /server owner/.test(l)));
  assert.ok(logs.some(l => /role above the bot/.test(l)));
  assert.ok(logs.some(l => /Ghosty/.test(l)));
});

test('syncNicknames: clear errors for bad token and missing members intent', async () => {
  global.fetch = async () => ({ status: 401, json: async () => ({}) });
  await assert.rejects(D.syncNicknames({ rows: [], token: 'x', guildId: 'G', dcfg: cfg, log: () => {} }), /token/);
  global.fetch = async (url) => {
    if (url.endsWith('/guilds/G')) return { status: 200, json: async () => ({ name: 'S', owner_id: '1', roles: [] }) };
    if (url.endsWith('/users/@me')) return { status: 200, json: async () => ({ id: 'bot' }) };
    if (url.endsWith('/members/bot')) return { status: 200, json: async () => ({ roles: [] }) };
    return { status: 403, json: async () => ({ message: 'Missing Access' }) };
  };
  await assert.rejects(D.syncNicknames({ rows: [], token: 'x', guildId: 'G', dcfg: cfg, log: () => {} }), /Server Members Intent/);
});
