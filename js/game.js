/* ============================================================================
   game.js — PGN parsing + position model
   ----------------------------------------------------------------------------
   Wraps chess.js to turn a pasted PGN into the three things the UI needs:
     - headers : the PGN tags (White, Black, Result, ...)
     - moves   : a flat list of half-moves with ply index, SAN, from/to, etc.
     - fens    : FEN for every position (fens[0] = start, fens[i] = after ply i)

   Keeping this here means the rest of the app never talks to chess.js directly,
   so move-handling logic stays in one place and is easy to extend (e.g. opening
   detection, multi-game libraries) later.
   ========================================================================== */
window.GameModel = (function () {
  /**
   * Parse a PGN string into a game model.
   * @param {string} pgn
   * @returns {{headers:Object, moves:Array, fens:string[]}}
   * @throws {Error} with a friendly message if parsing fails
   */
  function parse(pgn) {
    if (typeof Chess === "undefined") {
      throw new Error(
        "chess.js failed to load. Check your internet connection and reload."
      );
    }

    var game = new Chess();
    // `sloppy` lets chess.js tolerate Chess.com export quirks (clock comments,
    // annotation glyphs, etc.).
    var ok = game.load_pgn(pgn, { sloppy: true });
    if (!ok) {
      throw new Error(
        "Could not read that PGN. Make sure you pasted a full game export from Chess.com."
      );
    }

    var headers = game.header();
    var verbose = game.history({ verbose: true });
    if (verbose.length === 0) {
      throw new Error("That PGN has no moves in it.");
    }

    // Replay the moves on a fresh board to capture a FEN after each half-move.
    // (chess.js 0.13 verbose history doesn't include FENs, so we build them.)
    var replay = new Chess();
    var fens = [replay.fen()];
    var moves = [];

    verbose.forEach(function (mv, i) {
      replay.move(mv);
      fens.push(replay.fen());
      moves.push({
        ply: i + 1, // 1-based half-move index (matches what we send to Claude)
        san: mv.san, // e.g. "Nf3", "exd5", "O-O"
        color: mv.color, // 'w' | 'b'
        from: mv.from, // e.g. "g1"
        to: mv.to, // e.g. "f3"
        moveNumber: Math.floor(i / 2) + 1, // full-move number
      });
    });

    return { headers: headers, moves: moves, fens: fens };
  }

  return { parse: parse };
})();
