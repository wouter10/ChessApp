/* ============================================================================
   analysis.js — prompt building + response parsing
   ----------------------------------------------------------------------------
   This is the "what do we ask Claude, and how do we read the answer" layer.
   Kept separate from api.js (transport) and app.js (UI) so the coaching prompt
   is easy to tweak without touching anything else.

   We ask Claude to reference moves by their *ply index* (half-move number),
   which we also print in the move list we send. That makes mapping a key moment
   back to a board position exact and unambiguous.
   ========================================================================== */
window.Analysis = (function () {
  /**
   * Build a numbered, ply-indexed move list for the prompt, e.g.
   *   "1. e4 [ply 1]\n1... e5 [ply 2]\n2. Nf3 [ply 3] ..."
   */
  function buildMoveList(moves) {
    return moves
      .map(function (m) {
        var prefix = m.color === "w" ? m.moveNumber + "." : m.moveNumber + "...";
        return prefix + " " + m.san + " [ply " + m.ply + "]";
      })
      .join("\n");
  }

  /**
   * Build the system + user prompt for a game.
   * @param {{headers:Object, moves:Array}} game
   * @param {'w'|'b'} youPlay
   * @param {string} language - "English" | "Dutch"
   */
  function buildPrompt(game, youPlay, language) {
    var h = game.headers || {};
    var white = h.White || "White";
    var black = h.Black || "Black";
    var result = h.Result || "*";
    var youName = youPlay === "w" ? white : black;
    var oppName = youPlay === "w" ? black : white;
    var youColor = youPlay === "w" ? "White" : "Black";

    var system =
      "You are a friendly, encouraging chess coach for a club-level player. " +
      "You explain games in plain " + language + " that a non-expert can follow. " +
      "STRICT RULES:\n" +
      "- Never use engine evaluations or numbers like \"+0.3\" or \"-2.1\". Explain ideas in words.\n" +
      "- Talk about plans, threats, tactics, king safety, and mistakes in human terms.\n" +
      "- Refer to specific moves by their ply number from the list you are given.\n" +
      "- Be concrete and kind. Point out 2-3 genuinely important turning points.\n" +
      "- Respond with ONLY a single JSON object, no markdown, no commentary.";

    var schema =
      "{\n" +
      '  "result": "win" | "loss" | "draw",            // outcome from the player\'s point of view\n' +
      '  "summary": "2-3 sentences: the story of the game and why it ended this way",\n' +
      '  "wentWell": ["short bullet", "..."],            // 2-3 things the player did well\n' +
      '  "wentWrong": ["short bullet", "..."],           // 2-3 mistakes or missed chances\n' +
      '  "tips": ["short, actionable tip", "..."],       // 1-2 things to watch next game\n' +
      '  "keyMoments": [                                  // 2-3 turning points\n' +
      '    { "ply": <number>, "title": "short label", "explanation": "what happened and why it mattered, in plain language" }\n' +
      "  ]\n" +
      "}";

    var userText =
      "Here is a chess game to analyze.\n\n" +
      "White: " + white + "\n" +
      "Black: " + black + "\n" +
      "Result: " + result + "\n" +
      "I played as: " + youColor + " (" + youName + "). My opponent was " + oppName + ".\n\n" +
      "Moves (each tagged with its ply number):\n" +
      buildMoveList(game.moves) +
      "\n\n" +
      "Analyze the game from MY perspective (" + youColor + "). " +
      "Tell me why I won or lost, the 2-3 key turning points (with their ply numbers), " +
      "what I did well, what I did wrong, and what to watch out for next time.\n\n" +
      "Reply with ONLY this JSON shape (fill in real values, keep the keys):\n" +
      schema;

    return { system: system, userText: userText };
  }

  /**
   * Parse Claude's reply into a normalized analysis object.
   * Tolerant of code fences / stray text around the JSON.
   * @param {string} text
   */
  function parse(text) {
    var t = (text || "").trim();

    // Strip a ```json ... ``` fence if present.
    var fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();

    // Otherwise, slice from the first "{" to the last "}".
    var first = t.indexOf("{");
    var last = t.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      t = t.slice(first, last + 1);
    }

    var data;
    try {
      data = JSON.parse(t);
    } catch (e) {
      throw new Error("Claude's reply wasn't valid JSON. Raw reply:\n\n" + text);
    }

    // Normalize so the UI can render safely.
    function arr(v) { return Array.isArray(v) ? v.filter(Boolean) : []; }
    return {
      result: typeof data.result === "string" ? data.result : "",
      summary: typeof data.summary === "string" ? data.summary : "",
      wentWell: arr(data.wentWell),
      wentWrong: arr(data.wentWrong),
      tips: arr(data.tips),
      keyMoments: arr(data.keyMoments)
        .map(function (k) {
          return {
            ply: parseInt(k.ply, 10),
            title: k.title || "Key moment",
            explanation: k.explanation || "",
          };
        })
        .filter(function (k) { return !isNaN(k.ply); }),
    };
  }

  return { buildPrompt: buildPrompt, parse: parse };
})();
