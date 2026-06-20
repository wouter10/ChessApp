/* ============================================================================
   board.js — lightweight chessboard renderer
   ----------------------------------------------------------------------------
   Renders a position (given as a FEN string) into an 8x8 CSS grid. Pure view
   layer: it knows nothing about the API or the game flow, so it can be swapped
   for chessboard.js or an SVG renderer later without touching the rest of the
   app.

   We deliberately avoid drag-and-drop and external piece images: this app only
   needs to *step through* a game, so click-to-navigate + Unicode glyphs keeps
   the whole thing self-contained (no jQuery, no image CDN).
   ========================================================================== */
window.BoardRenderer = (function () {
  // Filled chess glyphs. We use the same (solid) glyphs for both colors and
  // tint them with CSS — this looks consistent across devices/fonts.
  var GLYPH = { p: "♟", n: "♞", b: "♝", r: "♜", q: "♛", k: "♚" };
  var FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];

  /**
   * Render a FEN position into `container`.
   * @param {HTMLElement} container
   * @param {string} fen
   * @param {Object} [opts]
   * @param {boolean} [opts.flip]   - show from Black's perspective
   * @param {{from:string,to:string}} [opts.highlight] - squares to highlight
   */
  function render(container, fen, opts) {
    opts = opts || {};
    var flip = !!opts.flip;
    var hi = opts.highlight || null;

    // chess.js gives us a clean 8x8 array (rank 8 first, files a..h).
    var board = new Chess(fen).board();
    var frag = document.createDocumentFragment();

    for (var dr = 0; dr < 8; dr++) {
      for (var dc = 0; dc < 8; dc++) {
        // Display position (dr,dc) -> actual board index (r,c).
        var r = flip ? 7 - dr : dr; // 0 = rank 8
        var c = flip ? 7 - dc : dc; // 0 = file a
        var piece = board[r][c];
        var square = FILES[c] + (8 - r);

        var sq = document.createElement("div");
        var light = (r + c) % 2 === 0; // a8 (0,0) is light
        sq.className = "square " + (light ? "light" : "dark");
        sq.dataset.square = square;

        if (hi && (hi.from === square || hi.to === square)) {
          sq.classList.add("hl");
        }
        if (piece) {
          var span = document.createElement("span");
          span.className = "piece " + (piece.color === "w" ? "white" : "black");
          span.textContent = GLYPH[piece.type];
          sq.appendChild(span);
        }
        frag.appendChild(sq);
      }
    }

    container.innerHTML = "";
    container.appendChild(frag);
  }

  return { render: render };
})();
