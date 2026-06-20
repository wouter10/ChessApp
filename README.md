# ♟ Chess Game Analyzer

A personal, local web app to understand your Chess.com games. Paste a PGN, step
through the moves on an interactive board, and let **Claude** explain — in plain
language, not engine scores — why you won or lost, the key turning points, and
what to watch out for next time.

No build tools, no server, no npm. Just open the file in a browser (works great
on a phone).

## Quick start

1. Open `index.html` in your browser (desktop or mobile).
2. Open **API key & settings** and paste your Anthropic API key
   (from <https://console.anthropic.com>). It's stored only in your browser
   (`localStorage`).
3. Paste a PGN you exported from Chess.com (or tap **Try a sample**) and press
   **Load game**.
4. Step through the moves with the arrows / move list.
5. Pick which side you played, then press **Analyze with Claude**.

You'll get:
- A short summary of the game.
- ✅ What went well / ⚠️ what went wrong / 🎯 tips for next time.
- 🔑 2–3 key moments — tap one to jump the board to that exact position.
  Those moves are also marked in the move list.

## How it works

The app uses the Claude Messages API model **`claude-sonnet-4-6`** for natural-language
analysis — deliberately **no Stockfish / engine**. The PGN (with each move tagged
by its ply number) is sent to Claude, which returns structured JSON that the app
renders and maps back onto the board.

> The API key is sent directly from your browser to Anthropic (using the
> `anthropic-dangerous-direct-browser-access` header). That's fine for a private
> local tool, but don't host this for others without putting a small proxy in
> front to keep the key server-side.

## Project layout

Concerns are split so the app is easy to extend:

```
index.html        markup + script includes
css/styles.css    mobile-first styling
js/board.js       BoardRenderer  – draws a FEN into the board (view only)
js/game.js        GameModel      – PGN → headers / moves / FENs (wraps chess.js)
js/api.js         ClaudeAPI      – Anthropic Messages API client
js/analysis.js    Analysis       – builds the coaching prompt, parses the reply
js/app.js         UI controller  – state + wiring
```

`chess.js@0.12.1` is loaded from a CDN for move validation and PGN parsing.

### Ideas for extending it later

- **Game library / history** — store loaded games in `localStorage`, list them.
- **Opening detection** — match the first moves against an ECO table.
- **Multi-game stats** — recurring mistakes, results over time.
- **Game comparison** — diff two games' key moments.

The seams are already there: `GameModel` is your data layer, `Analysis` owns the
prompt, and `app.js` is the only place that touches the DOM.
