/* ============================================================================
   library.js — game history stored in localStorage
   ============================================================================ */
var Library = (function () {
  "use strict";

  var STORAGE_KEY = "chess_library";
  var MAX_GAMES = 30;

  function _load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (_) {
      return [];
    }
  }

  function _save(list) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch (_) {}
  }

  // Returns all saved games, newest first.
  function all() {
    return _load();
  }

  // Saves a game. De-duplicates by PGN so reloading the same game only moves
  // it to the top rather than adding a second copy.
  function add(pgn, headers) {
    var list = _load();
    var trimmed = pgn.trim();

    // Remove existing entry for the same game (compare by PGN text).
    list = list.filter(function (g) { return g.pgn !== trimmed; });

    list.unshift({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      pgn: trimmed,
      white: headers.White || "White",
      black: headers.Black || "Black",
      result: headers.Result || "",
      date: headers.Date || "",
      savedAt: Date.now(),
    });

    if (list.length > MAX_GAMES) list = list.slice(0, MAX_GAMES);
    _save(list);
    return list;
  }

  // Removes a single game by id.
  function remove(id) {
    var list = _load().filter(function (g) { return g.id !== id; });
    _save(list);
    return list;
  }

  return { all: all, add: add, remove: remove };
})();
