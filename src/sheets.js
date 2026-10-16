'use strict';
// Read-only Google Sheets client. Uses the read-only scope, so this app cannot change the sheet.
const { GoogleAuth } = require('google-auth-library');

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets/';

class Sheets {
  constructor(spreadsheetId, credentials) {
    this.id = spreadsheetId;
    this.auth = new GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });
  }

  async request(path) {
    const client = await this.auth.getClient();
    const res = await client.request({ url: BASE + encodeURIComponent(this.id) + path, method: 'GET', retry: true });
    return res.data;
  }

  /** { sheets: [{title}] } */
  async meta() {
    const d = await this.request('?fields=sheets.properties(title)');
    return { sheets: (d.sheets || []).map(s => s.properties) };
  }

  /** Read many A1 ranges at once. Returns arrays of rows in the same order. */
  async batchGet(ranges) {
    if (!ranges.length) return [];
    const q = ranges.map(r => 'ranges=' + encodeURIComponent(r)).join('&');
    const d = await this.request('/values:batchGet?' + q + '&valueRenderOption=UNFORMATTED_VALUE');
    return (d.valueRanges || []).map(v => v.values || []);
  }
}

module.exports = { Sheets };
