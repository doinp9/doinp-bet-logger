/* =====================================================
   Doinp Bet Logger — placement watcher (content script)
   Runs on every page and frame (automatic mode) or on listed sites, in
   the extension's isolated world: page scripts can't see
   its variables or listeners, and it adds NOTHING to the
   page (no elements, no requests, no clicks, no typing).
   1. A press on a "place bet" control (any element: button,
      role=button or plain div) or Enter in the slip's stake
      box → snapshot the slip before the page reacts.
   2. For up to 20 s, watch for a receipt, an error, or the
      slip clearing.
   3. Receipt / cleared → report the bet to the extension,
      which asks you (system notification) whether to save it.
   Every step is written to a local detection log (Settings →
   Diagnostics) so a site that isn't detected can be fixed.
   ===================================================== */
(function () {
  "use strict";
  var api = globalThis.browser || globalThis.chrome;
  // After an update the old copy in an open tab is cut off from the extension ("orphaned"):
  // it may still be here, but it can't report anything. Only a live copy blocks a new one.
  function alive() { try { return !!(api && api.runtime && api.runtime.id); } catch (_) { return false; } }
  if (typeof window.__dblWatch === "function" && window.__dblWatch()) return;
  window.__dblWatch = alive;
  var P = globalThis.DBL_PARSE, X = globalThis.DBL_EXTRACT;
  var WINDOW_MS = 20000, CLEARED_STABLE_MS = 1500, TICK_MS = 350, SAME_PRESS_MS = 2500;
  // kind: "sportsbook" | "exchange" | "prediction" — a first guess from this frame's address,
  // replaced by the extension's answer (the top page's address, or what you set in Settings)
  var cfg = { fmt: "auto", kind: P.kindFor(location.hostname, location.pathname), commission: null };
  function xopts() { return { fmt: cfg.fmt, kind: cfg.kind, commission: cfg.commission }; }
  function applyConfig(c) { if (!c) return; cfg.fmt = c.fmt || cfg.fmt; if (c.kind) cfg.kind = c.kind; if ("commission" in c) cfg.commission = c.commission; }
  var pending = null;
  var lastPress = { el: null, t: 0 };

  function bg(msg) { try { return api.runtime.sendMessage(msg).catch(function () {}); } catch (_) { return Promise.resolve(); } }
  function trace(step, detail) { bg({ type: "trace", ev: { t: Date.now(), host: location.hostname, frame: window === top ? "top" : "frame", step: step, detail: detail || "" } }); }

  bg({ type: "site-config", host: location.hostname, path: location.pathname }).then(applyConfig);

  /* ---------- 1. the press ---------- */
  function onPress(e) {
    if (retireIfOrphaned()) return;
    if (e.type === "pointerdown" && e.button !== 0) return;
    var btn = X.placeTarget(e.target, cfg.kind);
    if (!btn) return;
    begin(btn, (btn.innerText || btn.getAttribute("aria-label") || "").trim().slice(0, 40));
  }
  function onKey(e) {
    if (retireIfOrphaned()) return;
    if (e.key !== "Enter" || !e.target || e.target.tagName !== "INPUT") return;
    var slip = X.slipFromElement(e.target, cfg.fmt, cfg.kind);
    if (!slip || !slipHasPlaceControl(slip)) return;
    begin(e.target, "Enter");
  }
  function slipHasPlaceControl(slip) {
    var w = document.createTreeWalker(slip, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) { var t = n.nodeValue.trim(); if (t && t.length < 60 && P.isPlaceButton(t, cfg.kind)) return true; }
    return false;
  }
  function begin(anchor, label) {
    // pointerdown + click (+ a retry click) on the same control is one placement
    if (lastPress.el === anchor && Date.now() - lastPress.t < SAME_PRESS_MS) return;
    lastPress = { el: anchor, t: Date.now() };
    var slip = X.slipFromElement(anchor, cfg.fmt, cfg.kind);
    var snap = slip ? X.extractSlip(slip, xopts()) : null;
    if (snap && snap.skipped === "sell") { trace("press", label + " \u00b7 sell order: closes a position, not logged"); return; }
    // the slip is read synchronously (before the page reacts); whether this site is
    // active is asked right after, and the watch is dropped silently if it isn't
    if (!snap || !snap.bets.length) {
      bg({ type: "site-config", host: location.hostname, path: location.pathname }).then(function (c) { if (c && c.active) trace("press", label + " \u00b7 " + cfg.kind + " \u00b7 slip " + (slip ? "found, no bet read" : "not found")); });
      return;
    }
    start(snap, slip);
    var mine = pending;
    bg({ type: "site-config", host: location.hostname, path: location.pathname }).then(function (c) {
      if (pending !== mine) return;
      if (!c || !c.active) { finish("inactive"); return; }
      applyConfig(c);
      snap.bets.forEach(function (b) { if (b.kind === "exchange" && c.commission != null) b.commission = c.commission; });
      trace("press", label + " \u00b7 " + (snap.kind || "sportsbook") + " \u00b7 " + snap.mode + " \u00b7 " + snap.bets.length + " bet(s) \u00b7 " + snap.bets.map(function (b) { return (b.dir ? b.dir + " " : "") + (b.selection || "?") + " @ " + b.odds + " \u00d7 " + (b.stake == null ? "?" : b.stake); }).join(" | "));
    });
  }
  window.addEventListener("pointerdown", onPress, true);
  window.addEventListener("click", onPress, true);
  window.addEventListener("keydown", onKey, true);
  // an orphaned copy steps aside on the next press
  function retireIfOrphaned() {
    if (alive()) return false;
    window.removeEventListener("pointerdown", onPress, true); window.removeEventListener("click", onPress, true); window.removeEventListener("keydown", onKey, true);
    return true;
  }

  /* ---------- 2. watch for the outcome ---------- */
  function start(snap, slip) {
    if (pending) finish("superseded");
    var buf = [];
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        var m = muts[i];
        if (m.type === "characterData") { if (m.target.nodeValue) buf.push({ node: m.target, text: m.target.nodeValue }); continue; }
        m.addedNodes.forEach(function (n) {
          var t = n.nodeType === 3 ? n.nodeValue : n.nodeType === 1 ? (n.innerText || n.textContent || "") : "";
          if (t && t.length < 600) buf.push({ node: n, text: t });
        });
      }
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true });
    pending = { snap: snap, slip: slip, t0: Date.now(), clearedAt: 0, obs: obs, buf: buf, timer: setInterval(tick, TICK_MS) };
  }

  var NUMERIC = /^[\s\d.,:+\-−\/%()]*$/; // live odds/score/clock updates: ignore
  function tick() {
    var p = pending;
    if (!p) return;
    var items = p.buf.splice(0, p.buf.length).filter(function (x) { return !NUMERIC.test(x.text); });
    // a receipt anywhere in this batch wins over an error in the same batch
    for (var i = 0; i < items.length; i++) if (P.V.receipt.test(P.norm(items[i].text))) return finish("receipt", items[i].node, items[i].text);
    for (var j = 0; j < items.length; j++) if (P.V.error.test(P.norm(items[j].text))) return finish("error", null, items[j].text);
    var gone = !document.documentElement.contains(p.slip) || X.priceCount(p.slip, cfg.fmt, cfg.kind) === 0;
    if (gone) {
      if (!p.clearedAt) p.clearedAt = Date.now();
      else if (Date.now() - p.clearedAt >= CLEARED_STABLE_MS) return finish("cleared");
    } else p.clearedAt = 0;
    if (Date.now() - p.t0 > WINDOW_MS) finish("timeout");
  }

  /* ---------- 3. report ---------- */
  function finish(kind, receiptNode, text) {
    var p = pending;
    if (!p) return;
    pending = null;
    clearInterval(p.timer);
    p.obs.disconnect();
    if (kind === "inactive") return;
    trace("outcome", kind + (text ? " · “" + P.clean(text).slice(0, 70) + "”" : ""));
    if (kind === "error" || kind === "superseded") return;
    var snap = p.snap;
    // a receipt usually repeats the accepted prices (after any odds change): prefer them
    if (kind === "receipt" && receiptNode) {
      try {
        var region = X.receiptRegion(receiptNode, cfg.fmt);
        var rec = region && cfg.kind === "sportsbook" ? X.extractSlip(region, xopts()) : null;
        // accept the receipt's prices only if it reads as the same kind of slip and each price is
        // close to the one pressed (an odds change on placement is small; the page's odds grid isn't)
        if (rec && rec.bets.length === snap.bets.length && rec.mode === snap.mode &&
            rec.bets.every(function (rb, i) { return rb.odds && Math.abs(rb.odds - snap.bets[i].odds) / snap.bets[i].odds < 0.25; })) {
          rec.bets.forEach(function (rb, i) {
            var sb = snap.bets[i];
            if (rb.odds && Math.abs(rb.odds - sb.odds) > 0.001) { sb.notes = "Odds changed on placement: " + sb.odds + " -> " + rb.odds; sb.odds = rb.odds; }
            if (!sb.stake && rb.stake) sb.stake = rb.stake;
          });
        }
      } catch (_) {}
    }
    // exchanges: an unmatched bet was placed but may never be matched
    if (kind === "receipt" && /(^|[^\p{L}])(unmatched|nao correspondida|no emparejada|non abbinata)/u.test(P.norm(text || ""))) snap.bets.forEach(function (b) { b.notes = (b.notes ? b.notes + " | " : "") + "Unmatched at placement: check the matched amount"; });
    var status = kind === "timeout" ? "unconfirmed" : "placed";
    var conf = snap.confidence + (kind === "receipt" ? 0.15 : kind === "cleared" ? 0.05 : -0.2);
    var now = new Date();
    bg({ type: "suggest", status: status, signal: kind, bets: snap.bets, mode: snap.mode, checks: snap.checks,
      confidence: Math.max(0.05, Math.min(1, conf)), date: P.localISO(now), time: P.localTime(now), host: location.hostname });
  }

  /* ---------- API for the popup (scripting.executeScript, isolated world) ---------- */
  window.__dblApi = {
    ping: function () { return { host: location.hostname, hasSlip: !!X.slipAuto(cfg.fmt) }; },
    captureNow: function () {
      var slip = X.slipAuto(cfg.fmt, cfg.kind);
      var snap = slip ? X.extractSlip(slip, xopts()) : null;
      trace("capture", cfg.kind + " \u00b7 " + (snap ? snap.bets.length + " bet(s)" + (snap.skipped ? " (" + snap.skipped + " order: not logged)" : "") : "no slip found"));
      if (!snap || !snap.bets.length) return null;
      var now = new Date();
      return { status: "manual", signal: "manual", bets: snap.bets, mode: snap.mode, checks: snap.checks, confidence: snap.confidence, date: P.localISO(now), time: P.localTime(now), host: location.hostname };
    },
    scanHistory: function () {
      var rows = X.scanHistory(xopts());
      trace("history", rows.length + " card(s)");
      return rows.length ? { host: location.hostname, rows: rows } : null;
    },
    snapshot: function () {
      var slip = X.slipAuto(cfg.fmt, cfg.kind);
      var target = slip || document.body;
      return {
        host: location.hostname, path: location.pathname, when: new Date().toISOString(), lang: document.documentElement.getAttribute("lang") || "", kind: cfg.kind,
        slipFound: !!slip, extraction: slip ? X.extractSlip(slip, xopts()) : null,
        tree: X.skeleton(target, 0, { n: slip ? 800 : 1500 })
      };
    },
    setConfig: function (c) { applyConfig(c); return true; }
  };
})();
