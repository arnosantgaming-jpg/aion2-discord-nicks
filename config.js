// =====================================================================
//  SETTINGS — edit this file if the Main tab's columns change.
//  Column numbers: A=1, B=2, C=3 ...
// =====================================================================

module.exports = {
  sheet: 'Main',          // tab with each member's main character
  startRow: 2,            // first data row (headers are on the row above)

  columns: {
    discordId: 1,         // A: Discord username / display name / numeric user ID
    ign: 2,               // B: IGN Name
    gs: 8,                // H: Gear Score
    cp: 9,                // I: Combat Power
  },

  // Nickname formats. The first one that fits Discord's 32-character limit is used;
  // if none fit, the last one is used with the IGN shortened.
  // {ign}  {gs}  {cp} = 102,299  {cpk} = 102.3k
  formats: [
    
    '{ign} | {gs} | {cpk}'
  ],

  exclude: [],            // usernames or user IDs to never rename, e.g. ['someuser', '123456789012345678']
  delayMs: 250,           // pause between renames
};
