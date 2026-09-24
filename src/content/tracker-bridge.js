/* =====================================================
   Doinp Bet Logger — tracker bridge (content script)
   Runs only on doinp.com.br/tools/betting-tracker (and
   localhost for development). Hands the bets you chose to
   send over to the tracker page with window.postMessage.
   The tracker adds nothing by itself: its inbox shows the
   bets and you confirm them there.

   Protocol (all messages carry version: 1)
     ext  → page  { source:"doinp-bet-logger", type:"hello" }
     page → ext   { source:"doinp-tracker",    type:"ready" }
     ext  → page  { source:"doinp-bet-logger", type:"bets", bets:[...] }
     page → ext   { source:"doinp-tracker",    type:"imported",  ids:[...] }
     page → ext   { source:"doinp-tracker",    type:"dismissed", ids:[...] }
   ===================================================== */
(function () {
  "use strict";
  if (window.__dblBridge) return;
  window.__dblBridge = true;
  var api = globalThis.browser || globalThis.chrome;
  var ready = false;

  function post(msg) { window.postMessage(Object.assign({ source: "doinp-bet-logger", version: 1 }, msg), location.origin); }

  function pushOutbox() {
    if (!ready) return;
    api.runtime.sendMessage({ type: "bridge-get-outbox" }).then(function (r) {
      if (r && r.bets && r.bets.length) post({ type: "bets", bets: r.bets });
    }).catch(function () {});
  }

  window.addEventListener("message", function (e) {
    if (e.source !== window || !e.data || e.data.source !== "doinp-tracker") return;
    var d = e.data;
    if (d.type === "ready") { ready = true; pushOutbox(); }
    else if ((d.type === "imported" || d.type === "dismissed") && Array.isArray(d.ids)) {
      api.runtime.sendMessage({ type: "bridge-done", ids: d.ids.map(String), how: d.type }).catch(function () {});
    }
  });

  // the popup's "Send to tracker" pings open tracker tabs through the background
  api.runtime.onMessage.addListener(function (m) {
    if (m && m.type === "outbox-updated") pushOutbox();
  });

  post({ type: "hello" });
})();
