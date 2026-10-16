# AION 2 Discord Nicknames

Sets each legion member's Discord server nickname to their main character's live stats, e.g.

`Arno | GS 2177 | CP 102,299`

It **only reads** the legion Google Sheet (the Gear Score / Combat Power your existing sync already
writes) and renames members. It uses Google's read-only permission, so it can't change the sheet.
Runs on GitHub Actions every 15 minutes, a few minutes after the sheet sync.

## How it works

- Takes each row on the **Main** tab: Discord ID (column A), IGN (B), Gear Score (H), Combat Power (I).
- Finds the Discord member by **username**, then **display name**, then **current nickname**
  (only if exactly one member matches). A numeric **user ID** in column A always works.
  Entries like `Halycon#2450` or `Yza / Kamasylvia` are handled.
- Builds the nickname, shortened if needed to fit Discord's 32-character limit:
  `Arno | GS 2177 | CP 102,299` → `Zeraphynez | GS 2712 | CP 139.7k` → `CoconutMochi | 2131 | 95.9k`
- Only renames people whose nickname actually changed.
- Leaves alone: TBC / Invalid IGN rows, anyone in `exclude` (config.js), the **server owner** and anyone
  whose highest role is above the bot's (Discord doesn't allow those).
- Rows that don't match anyone are listed in the run log, e.g. `? row 12 "Casual": no matching member`.

Note: members' own custom nicknames get replaced every run. Add anyone who wants to keep theirs to `exclude`.

---

## Setup

### 1. Create the Discord bot

1. <https://discord.com/developers/applications> → **New Application** → name it e.g. `GS Tracker` → Create.
2. Left menu **Bot**:
   - **Reset Token** → **Copy** (you only see it once; keep it private).
   - Scroll down, turn on **Server Members Intent** → **Save Changes**.
3. Left menu **OAuth2 → URL Generator**:
   - Scopes: tick **bot**.
   - Bot Permissions: tick **Manage Nicknames** (nothing else needed).
   - Open the generated URL at the bottom, choose your server → **Authorize**.
4. In Discord: **Server Settings → Roles** → drag the bot's role **above** the members' roles.

### 2. Get the server ID

Discord **User Settings → Advanced → Developer Mode: on**, then right-click your server icon →
**Copy Server ID**.

### 3. Create the GitHub repo

1. <https://github.com/new> → name e.g. `aion2-discord-nicks` → **Public** → Create.
2. Upload everything from this folder (not `node_modules`).
3. Check `.github/workflows/nicknames.yml` made it in. If not: **Add file → Create new file**,
   name it `.github/workflows/nicknames.yml` and paste the file's contents.

### 4. Add four secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `SHEET_ID` | Same as your other repo: `1wEKMjPNPttqG6g9WDorJQitq4s4YbkhrVn50S4RjrXQ` |
| `GOOGLE_CREDENTIALS` | Same service-account JSON as your other repo (whole file) |
| `DISCORD_TOKEN` | The bot token from step 1 |
| `DISCORD_GUILD_ID` | The server ID from step 2 |

The service account already has access to the sheet, so nothing changes on the Google side.

### 5. Test

**Actions → Discord nicknames → Run workflow**, tick **Dry run** → Run. Open the run → **rename** →
**Update nicknames**. You'll see who would be renamed (`(dry run) arno → "Arno | GS 2177 | CP 102,299"`)
and which rows didn't match. Fix unmatched rows in the sheet, then run again without Dry run.

After that it runs on its own every 15 minutes.

---

## Changing things

- **Columns moved on Main:** update `columns` in `config.js`. If the Gear Score / Combat Power headers
  aren't where it expects, the run stops with a clear error instead of using wrong numbers.
- **Nickname style:** edit `formats` in `config.js`.
- **Leave someone out:** add their username or user ID to `exclude` in `config.js`.
- **How often:** edit the `cron` line in `.github/workflows/nicknames.yml`.
- **Stop it:** Actions → Discord nicknames → **⋯ → Disable workflow**.

## Troubleshooting

| Log says | Fix |
|---|---|
| `Discord rejected the bot token` | Re-copy the token into `DISCORD_TOKEN` (Reset Token gives a new one) |
| `Bot is not in that server, or DISCORD_GUILD_ID is wrong` | Re-invite the bot / re-copy the server ID |
| `Could not list server members ... Server Members Intent` | Turn on Server Members Intent (setup step 1.2) |
| `HTTP 403 Missing Permissions` | Bot needs Manage Nicknames, and its role must be above the member's |
| `? row N "...": no matching member` | Put that member's exact username or user ID in column A |
| `N members share the display name` | Use their username or user ID in column A instead |
