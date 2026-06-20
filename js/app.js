/* ============================================================================
   app.js — UI controller (the glue)
   ----------------------------------------------------------------------------
   Owns the page state and wires the modules together:
     GameModel   -> parse PGN
     BoardRenderer -> draw positions
     ClaudeAPI + Analysis -> get & render coaching

   Everything DOM-related lives here so the other modules stay reusable.
   ========================================================================== */
(function () {
  "use strict";

  var KEY_STORAGE = "claude_api_key";
  var LANG_STORAGE = "analyzer_language";
  var _currentPgn = "";

  // A short sample game (a quick Scholar's-mate-style miniature) so the user can
  // try the app instantly without exporting anything.
  var SAMPLE_PGN =
    '[Event "Sample game"]\n' +
    '[White "You"]\n' +
    '[Black "Opponent"]\n' +
    '[Result "1-0"]\n\n' +
    "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7# 1-0";

  // ── State ────────────────────────────────────────────────────────────────
  var state = {
    game: null, // { headers, moves, fens }
    ply: 0, // current half-move index (0 = start)
    flip: false, // board orientation
    youPlay: "w", // 'w' | 'b'
    analysis: null,
    keyPlies: {}, // set of plies that are key moments (for move-list marking)
  };

  // ── Element lookups ───────────────────────────────────────────────────────
  function $(id) { return document.getElementById(id); }
  var el = {};

  function cacheEls() {
    [
      "apiKey", "language", "saveKey", "keyCard",
      "pgn", "loadGame", "loadSample", "loadError",
      "gameView", "players", "board",
      "navFirst", "navPrev", "navNext", "navLast", "moveLabel",
      "moveList", "analyze", "analyzeStatus", "analyzeError",
      "analysisView", "analysisHeadline", "analysisSummary",
      "wentWell", "wentWrong", "tips", "keyMoments",
      "libraryCard", "libraryList", "libraryClear",
    ].forEach(function (id) { el[id] = $(id); });
  }

  // ── Init ──────────────────────────────────────────────────────────────────
  function init() {
    cacheEls();

    el.apiKey.value = localStorage.getItem(KEY_STORAGE) || "";
    el.language.value = localStorage.getItem(LANG_STORAGE) || "English";

    el.saveKey.addEventListener("click", saveKey);
    el.language.addEventListener("change", function () {
      localStorage.setItem(LANG_STORAGE, el.language.value);
    });

    el.loadGame.addEventListener("click", function () { loadGame(el.pgn.value); });
    el.loadSample.addEventListener("click", function () {
      el.pgn.value = SAMPLE_PGN;
      loadGame(SAMPLE_PGN);
    });

    el.navFirst.addEventListener("click", function () { goTo(0); });
    el.navPrev.addEventListener("click", function () { goTo(state.ply - 1); });
    el.navNext.addEventListener("click", function () { goTo(state.ply + 1); });
    el.navLast.addEventListener("click", function () { goTo(state.game ? state.game.moves.length : 0); });

    // Keyboard arrows for desktop convenience.
    document.addEventListener("keydown", function (e) {
      if (!state.game) return;
      if (e.key === "ArrowLeft") { goTo(state.ply - 1); }
      else if (e.key === "ArrowRight") { goTo(state.ply + 1); }
    });

    Array.prototype.forEach.call(
      document.querySelectorAll('input[name="youplay"]'),
      function (radio) {
        radio.addEventListener("change", function () {
          if (radio.checked) setYouPlay(radio.value);
        });
      }
    );

    el.analyze.addEventListener("click", analyze);

    el.libraryClear.addEventListener("click", function () {
      Library.all().forEach(function (g) { Library.remove(g.id); });
      renderLibrary([]);
    });

    renderLibrary(Library.all());
  }

  // ── API key ────────────────────────────────────────────────────────────────
  function saveKey() {
    localStorage.setItem(KEY_STORAGE, el.apiKey.value.trim());
    el.saveKey.textContent = "Saved ✓";
    setTimeout(function () { el.saveKey.textContent = "Save key"; }, 1200);
  }

  // ── Library ─────────────────────────────────────────────────────────────────
  function renderLibrary(list) {
    el.libraryList.innerHTML = "";
    if (!list || !list.length) {
      hide(el.libraryCard);
      return;
    }
    show(el.libraryCard);
    list.forEach(function (g) {
      var li = document.createElement("li");
      li.className = "library__item";

      var info = document.createElement("button");
      info.className = "library__load";
      info.setAttribute("aria-label", "Load " + g.white + " vs " + g.black);

      var title = document.createElement("span");
      title.className = "library__matchup";
      title.textContent = g.white + " vs " + g.black;

      var meta = document.createElement("span");
      meta.className = "library__meta";
      meta.textContent = [g.result, g.date].filter(Boolean).join(" · ");

      info.appendChild(title);
      info.appendChild(meta);
      info.addEventListener("click", function () {
        el.pgn.value = g.pgn;
        loadGame(g.pgn);
      });

      var del = document.createElement("button");
      del.className = "btn btn--ghost btn--sm library__del";
      del.textContent = "✕";
      del.setAttribute("aria-label", "Remove game");
      del.addEventListener("click", function (e) {
        e.stopPropagation();
        renderLibrary(Library.remove(g.id));
      });

      li.appendChild(info);
      li.appendChild(del);
      el.libraryList.appendChild(li);
    });
  }

  // ── Loading a game ──────────────────────────────────────────────────────────
  function loadGame(pgn) {
    hide(el.loadError);
    try {
      var game = GameModel.parse(pgn);
      state.game = game;
      state.ply = 0;
      state.analysis = null;
      state.keyPlies = {};
      _currentPgn = pgn.trim();

      hide(el.analysisView);
      hide(el.analyzeError);
      hide(el.analyzeStatus);

      // Persist to library (skip the built-in sample game).
      if (pgn.trim() !== SAMPLE_PGN.trim()) {
        renderLibrary(Library.add(pgn, game.headers || {}));
      }

      renderPlayers();
      renderMoveList();
      goTo(0);
      show(el.gameView);
      el.gameView.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (err) {
      showError(el.loadError, err.message);
    }
  }

  function renderPlayers() {
    var h = state.game.headers || {};
    el.players.innerHTML =
      '<span class="p"><span class="dot dot--w"></span>' + escapeHtml(h.White || "White") + "</span>" +
      '<span class="muted">' + escapeHtml(h.Result || "") + "</span>" +
      '<span class="p">' + escapeHtml(h.Black || "Black") + '<span class="dot dot--b"></span></span>';
  }

  // ── Board + navigation ──────────────────────────────────────────────────────
  function goTo(ply) {
    if (!state.game) return;
    var max = state.game.moves.length;
    state.ply = Math.max(0, Math.min(ply, max));
    renderBoard();
    updateMoveLabel();
    updateActiveMove();
  }

  function renderBoard() {
    var fen = state.game.fens[state.ply];
    var highlight = null;
    if (state.ply > 0) {
      var last = state.game.moves[state.ply - 1];
      highlight = { from: last.from, to: last.to };
    }
    BoardRenderer.render(el.board, fen, { flip: state.flip, highlight: highlight });
  }

  function updateMoveLabel() {
    if (state.ply === 0) {
      el.moveLabel.textContent = "Start";
      return;
    }
    var m = state.game.moves[state.ply - 1];
    var dots = m.color === "w" ? "." : "...";
    el.moveLabel.textContent = m.moveNumber + dots + " " + m.san;
  }

  function setYouPlay(color) {
    state.youPlay = color;
    state.flip = color === "b"; // orient the board toward the player
    renderBoard();
  }

  // ── Move list ───────────────────────────────────────────────────────────────
  function renderMoveList() {
    var moves = state.game.moves;
    var frag = document.createDocumentFragment();

    moves.forEach(function (m) {
      if (m.color === "w") {
        var num = document.createElement("span");
        num.className = "num";
        num.textContent = m.moveNumber + ".";
        frag.appendChild(num);
      }
      var span = document.createElement("span");
      span.className = "move";
      span.dataset.ply = m.ply;
      span.textContent = m.san;
      span.addEventListener("click", function () { goTo(m.ply); });
      frag.appendChild(span);
    });

    el.moveList.innerHTML = "";
    el.moveList.appendChild(frag);
    markKeyMoves();
  }

  function updateActiveMove() {
    var prev = el.moveList.querySelector(".move.active");
    if (prev) prev.classList.remove("active");
    if (state.ply > 0) {
      var current = el.moveList.querySelector('.move[data-ply="' + state.ply + '"]');
      if (current) {
        current.classList.add("active");
        current.scrollIntoView({ block: "nearest" });
      }
    }
  }

  function markKeyMoves() {
    Array.prototype.forEach.call(el.moveList.querySelectorAll(".move"), function (span) {
      span.classList.toggle("key", !!state.keyPlies[span.dataset.ply]);
    });
  }

  // ── Analysis ────────────────────────────────────────────────────────────────
  async function analyze() {
    if (!state.game) return;
    hide(el.analyzeError);

    var apiKey = (el.apiKey.value || "").trim();
    if (!apiKey) {
      showError(el.analyzeError, "Add your Anthropic API key in settings first.");
      el.keyCard.open = true;
      return;
    }
    localStorage.setItem(KEY_STORAGE, apiKey); // keep it in sync

    el.analyze.disabled = true;
    show(el.analyzeStatus);
    el.analyzeStatus.textContent = "Asking Claude to review your game…";

    try {
      var prompt = Analysis.buildPrompt(state.game, state.youPlay, el.language.value);
      var reply = await ClaudeAPI.createMessage(apiKey, {
        system: prompt.system,
        messages: [{ role: "user", content: prompt.userText }],
        maxTokens: 2000,
      });
      var analysis = Analysis.parse(reply);
      state.analysis = analysis;
      renderAnalysis(analysis);
      hide(el.analyzeStatus);
    } catch (err) {
      hide(el.analyzeStatus);
      showError(el.analyzeError, err.message);
    } finally {
      el.analyze.disabled = false;
    }
  }

  function renderAnalysis(a) {
    var resultText = a.result
      ? a.result.charAt(0).toUpperCase() + a.result.slice(1)
      : "Analysis";
    el.analysisHeadline.textContent = "Game review — " + resultText;
    el.analysisSummary.textContent = a.summary;

    fillList(el.wentWell, a.wentWell);
    fillList(el.wentWrong, a.wentWrong);
    fillList(el.tips, a.tips);

    // Track which plies are key moments so the move list can mark them.
    state.keyPlies = {};
    a.keyMoments.forEach(function (k) { state.keyPlies[k.ply] = true; });
    markKeyMoves();

    // Render the clickable key-moment cards.
    el.keyMoments.innerHTML = "";
    a.keyMoments.forEach(function (k) {
      var moves = state.game.moves;
      var inRange = k.ply >= 1 && k.ply <= moves.length;
      var move = inRange ? moves[k.ply - 1] : null;
      var where = move
        ? "Move " + move.moveNumber + (move.color === "w" ? "." : "...") + " " + move.san
        : "Move " + k.ply;

      var card = document.createElement("button");
      card.className = "moment";
      card.innerHTML =
        '<span class="moment__title">' + escapeHtml(k.title) + "</span>" +
        '<span class="moment__where">' + escapeHtml(where) + "</span>" +
        '<p class="moment__text">' + escapeHtml(k.explanation) + "</p>";
      card.addEventListener("click", function () {
        if (inRange) {
          goTo(k.ply);
          el.gameView.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
      el.keyMoments.appendChild(card);
    });

    show(el.analysisView);
    el.analysisView.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ── Small DOM helpers ───────────────────────────────────────────────────────
  function fillList(ul, items) {
    ul.innerHTML = "";
    (items.length ? items : ["—"]).forEach(function (text) {
      var li = document.createElement("li");
      li.textContent = text;
      ul.appendChild(li);
    });
  }
  function show(node) { node.hidden = false; }
  function hide(node) { node.hidden = true; }
  function showError(node, msg) { node.textContent = msg; node.hidden = false; }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  // Start once the DOM is ready.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
