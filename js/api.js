/* ============================================================================
   api.js — Anthropic (Claude) API client
   ----------------------------------------------------------------------------
   Thin wrapper around the Messages API. The only thing the rest of the app
   needs to know is `createMessage(apiKey, opts) -> Promise<string>`.

   Notes:
   - Model is claude-sonnet-4-6 (natural-language analysis; no engine).
   - This calls the API *directly from the browser*. That requires the
     `anthropic-dangerous-direct-browser-access` header and exposes the key to
     this page — which is fine for a personal local tool, but don't ship this
     pattern to other users. For that you'd put a tiny proxy in front.
   ========================================================================== */
window.ClaudeAPI = (function () {
  var ENDPOINT = "https://api.anthropic.com/v1/messages";
  var MODEL = "claude-sonnet-4-6";
  var API_VERSION = "2023-06-01";

  /**
   * Send a single message request and return the concatenated text reply.
   * @param {string} apiKey
   * @param {Object} opts
   * @param {string} [opts.system]   - system prompt
   * @param {Array}  opts.messages   - Messages API `messages` array
   * @param {number} [opts.maxTokens]
   * @returns {Promise<string>}
   */
  async function createMessage(apiKey, opts) {
    if (!apiKey) throw new Error("No API key set. Open settings and paste your Anthropic key.");

    var res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": API_VERSION,
          // Required for direct browser-to-Anthropic calls.
          "anthropic-dangerous-direct-browser-access": "true",
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: opts.maxTokens || 2000,
          system: opts.system,
          messages: opts.messages,
        }),
      });
    } catch (networkErr) {
      throw new Error("Network error reaching Claude. Check your connection.");
    }

    if (!res.ok) {
      var detail = res.statusText;
      try {
        var errBody = await res.json();
        detail = (errBody.error && errBody.error.message) || JSON.stringify(errBody);
      } catch (_) {
        /* keep statusText */
      }
      throw new Error("Claude API error (" + res.status + "): " + detail);
    }

    var data = await res.json();
    // Join all text blocks (there should be one for our use case).
    return (data.content || [])
      .filter(function (b) { return b.type === "text"; })
      .map(function (b) { return b.text; })
      .join("");
  }

  return { createMessage: createMessage, MODEL: MODEL };
})();
