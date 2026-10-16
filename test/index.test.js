'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { main, readRows } = require('../src/index');

// Fake read-only sheet: Main tab laid out like the real one.
function fakeSheets(grid) {
  const colNum = s => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  return {
    async meta() { return { sheets: [{ title: 'Main' }] }; },
    async batchGet(ranges) {
      return ranges.map(r => {
        const m = r.match(/^'Main'!(?:([A-Z]+)(\d+):[A-Z]+\d*|(\d+):\d+)$/);
        if (m[3]) return [grid[+m[3] - 1]];                     // header row
        const c = colNum(m[1]) - 1, start = +m[2] - 1;
        return grid.slice(start).map(row => [row[c] ?? '']);
      });
    },
    async batchUpdate() { throw new Error('must never write'); },
  };
}

const HDR = ['Discord ID', 'IGN Name', 'Status', 'Legion', 'Region', 'Class', 'Server', 'Gear Score', 'Combat Power'];
const row = (d, ign, gs, cp) => [d, ign, '', '', 'SG', 'Glad', 'siel', gs, cp];

test('readRows picks Discord ID, IGN, GS, CP and skips blank rows', async () => {
  const rows = await readRows(fakeSheets([HDR, row('Arno', 'Arno', 2177, 102299), row('', 'NoId', 1, 1), row('E', 'TBC', 'Invalid IGN', 'Invalid IGN')]));
  assert.deepEqual(rows, [
    { row: 2, discordId: 'Arno', ign: 'Arno', gs: 2177, cp: 102299 },
    { row: 4, discordId: 'E', ign: 'TBC', gs: 'Invalid IGN', cp: 'Invalid IGN' },
  ]);
});

test('readRows refuses to run if the columns moved', async () => {
  const bad = [...HDR]; bad[7] = 'Exp';
  await assert.rejects(readRows(fakeSheets([bad, row('Arno', 'Arno', 1, 1)])), /expected Gear Score/);
});

test('main renames matched members end to end', async () => {
  const patches = [];
  global.fetch = async (url, opt = {}) => {
    const path = url.replace('https://discord.com/api/v10', '');
    const json = (status, body) => ({ status, json: async () => body });
    if (path === '/guilds/G') return json(200, { name: 'Kopitiam', owner_id: '1', roles: [{ id: 'bot', position: 5 }] });
    if (path === '/users/@me') return json(200, { id: 'b' });
    if (path === '/guilds/G/members/b') return json(200, { roles: ['bot'] });
    if (path.startsWith('/guilds/G/members?')) return json(200, [
      { user: { id: '11', username: 'arno', global_name: 'Arno' }, nick: null, roles: [] },
      { user: { id: '12', username: 'zen', global_name: 'Zen' }, nick: 'Zen | GS 1733 | CP 76,123', roles: [] },
    ]);
    if (opt.method === 'PATCH') { patches.push([path.split('/').pop(), JSON.parse(opt.body).nick]); return json(200, {}); }
    throw new Error('unexpected ' + path);
  };
  const s = await main({
    sheets: fakeSheets([HDR, row('Arno', 'Arno', 2177, 102299), row('zen', 'Zen', 1733, 76123), row('Ghost', 'Ghost', 1, 1)]),
    token: 't', guildId: 'G',
  });
  assert.deepEqual(patches, [['11', 'Arno | GS 2177 | CP 102,299']]);
  assert.equal(s.unchanged, 1);
  assert.equal(s.unmatched, 1);
});
