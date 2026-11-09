# Same Difference 🎭

A party game for phones. Each round, every player gets a character from movies, TV,
anime, video games or cartoons. **You can see everyone's character except your own.**
All the characters in a round share something: a look (bald, red hair, wears a cape),
something about them (is a dog, can fly, is royalty) or something they're known for
(a catchphrase, a famous vehicle, a favorite food).

Ask questions, give clues, guess who you are. The sooner you guess right, the more points you get.

## Run it

```bash
npm install
npm start
```

Open http://localhost:3000, create a game, and share the code / QR.

- **Same room:** everyone on the same Wi-Fi scans the QR in the lobby. It uses your
  computer's local network address, which the server prints when it starts.
- **Remote:** deploy it (below) and send friends the link. Play over a video call or use
  the in-game "Table talk" chat.

## How a round works

1. The host picks the categories and starts the round. The server picks a shared trait
   that has enough characters for everyone, and deals one character to each player.
2. Everyone's screen shows the other players' characters (picture, name, where they're from).
   Your own card shows **?**.
3. **Don't know someone's character?** Tap *Don't know — skip* on their card. They get a new
   character with the same trait.
4. Type guesses for your own character. Guessing ignores capitals and accents and allows small typos, and it
   accepts aliases ("Vader", "Baby Yoda", "Heisenberg"). If your guess is close but not
   accepted, another player can tap **Close enough ✓**.
5. The first correct guess earns the most points (number of players), then one fewer for each next
   correct guess, with a minimum of 1. Giving up scores 0. The round ends when everyone is done, or when the host
   ends it.

Host setting: *Show the round's shared trait as a hint*. Turn it off to make the trait a
mystery that is revealed at the end.

## Characters & images

- `data/characters.js` has about 345 characters and 52 traits. Each row looks like this:
  `['Name', 'category', 'From', 'Wikipedia title', 'trait trait', 'alias|alias']`.
  Run `npm run check-data` to see how many characters each trait has.
- Pictures are fetched automatically and cached in `data/image-cache.json`, in this order:
  1. **Wikipedia** (MediaWiki `pageimages` API, then the article's infobox). No key needed.
  2. **Fandom wikis** for the franchise (same API, no key).
  3. **Jikan** (unofficial MyAnimeList API) for anime.
  You can override any character with `{ img: 'https://…' }` or `{ imgFrom: 'fandom' }`.
- Browse every character and picture at http://localhost:3000/gallery.html to spot bad ones.

Other APIs if you want more: TMDB (movie/TV posters and cast photos, free key),
Giant Bomb (game characters, free key), Comic Vine (comics).

> Pictures are hot-linked from Wikimedia/Fandom and many are non-free promotional art.
> That's fine for a private game with friends. Check the licensing before you put this on a public or commercial site.

## Deploy for remote play

Any Node host with WebSocket support works. Examples:

- **Render:** create a new Web Service from this folder's repo. Build: `npm install`. Start: `npm start`.
- **Railway / Fly.io:** same commands. `PORT` is read from the environment.

Game rooms live in memory, so restarting the server ends any games in progress.

## Testing alone

```bash
node scripts/bots.js ROOMCODE 3
```

This adds 3 bot players to your room.
