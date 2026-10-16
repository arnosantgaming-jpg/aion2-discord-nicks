# Terms of Service — GS Tracker (Discord bot)

_Last updated: 16 October 2026_

These terms apply to the **GS Tracker** Discord bot ("the bot"), run by the admins of the
**Kopitiam** legion ("we", "us") for the Kopitiam Discord server. By being a member of a server
where the bot is installed, you agree to these terms.

## 1. What the bot does

The bot updates members' **server nicknames** to show their AION 2 character name, Gear Score and
Combat Power, for example `Arno | GS 2177 | CP 102,299`.

To do this it:

- reads the legion's Google Sheet (Discord name, character name, Gear Score, Combat Power);
- reads the server's member list (usernames, display names and current nicknames) to match
  members to sheet rows;
- changes the server nickname of matched members, about every 15 minutes.

The bot does **not** read messages, send messages, join voice channels, or change roles,
channels or any other server settings.

## 2. Your nickname

- If you are matched to a row in the legion sheet, your server nickname may be replaced and kept
  up to date automatically. Nicknames you set yourself may be overwritten.
- If your character name is missing, marked TBC, or shows "Invalid IGN", your nickname is left as it is.
- **Opting out:** ask a legion admin to exclude you, or to remove your Discord name from the sheet.
  Your nickname will then no longer be changed (you can change it back yourself).

## 3. Data

- Character data (Gear Score, Combat Power) comes from public AION 2 character information.
- The bot does not keep its own database. The only information it uses is in the legion sheet and
  the Discord server it runs in.
- Run logs (which show usernames and the nicknames set) are kept by GitHub Actions for a limited
  time and are only visible to the legion admins who manage the bot.

## 4. Acceptable use

You agree not to try to misuse the bot, for example by putting someone else's character or
offensive text in the sheet to change another member's nickname. Admins may remove entries or
exclude members at their discretion.

You must also follow [Discord's Terms of Service](https://discord.com/terms) and
[Community Guidelines](https://discord.com/guidelines).

## 5. No warranty

The bot is a free, volunteer-run tool provided **"as is"**, without any guarantee that it will be
available, accurate or up to date. Numbers may be delayed or wrong. We are not responsible for any
loss or inconvenience caused by using it, to the extent allowed by law.

## 6. Not affiliated

The bot is not affiliated with, endorsed by, or sponsored by NCSOFT, AION 2, Shugo.gg or Discord.
All game names and trademarks belong to their owners.

## 7. Changes and ending the service

We may change these terms, change how the bot works, or stop running it at any time. The
"Last updated" date above shows when these terms last changed. Continuing to be in a server where
the bot runs after a change means you accept the updated terms.

## 8. Contact

Questions or opt-out requests: message a legion admin in the Kopitiam Discord server.
