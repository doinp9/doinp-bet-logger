/* =====================================================
   Doinp Bet Logger — popup and full view
   Tabs: Revisar (decide on detected bets) · Capturar (read the
   open slip / import My Bets) · Histórico (waiting for the
   tracker, imported, exported, discarded) · Ajustes (alerts,
   sites, detection log, delete data).
   Opened from the toolbar (480×600) or as a tab (?view=full).
   ===================================================== */
(function () {
  "use strict";
  var api = globalThis.browser || globalThis.chrome;
  var P = globalThis.DBL_PARSE;
  var WATCH_FILES = ["en", "pt", "es", "fr", "de", "it", "nl", "pl", "tr", "ru", "ko", "zh", "ja"].map(function (l) { return "src/vocab/" + l + ".js"; })
    .concat(["src/lib/parse.js", "src/lib/extract.js", "src/content/watch.js"]);
  var FULL = /[?&]view=full\b/.test(location.search);

  /* =====================================================
     strings — PT-BR default, EN
     ===================================================== */
  // texts live in src/i18n/<lang>.js (one file per language); English fills any gap
  var I18N = globalThis.DBL_I18N || {};
  var LOCALES = { pt: "pt-BR", en: "en-US", es: "es-ES", ko: "ko-KR", de: "de-DE", it: "it-IT", zh: "zh-CN", ja: "ja-JP", fr: "fr-FR", tr: "tr-TR", pl: "pl-PL", ru: "ru-RU", nl: "nl-NL" };
  var lang = "pt";
  function loc() { return LOCALES[lang] || lang; }
  function t(k, vars) {
    var s = (I18N[lang] && I18N[lang][k]) || (I18N.en && I18N.en[k]) || k;
    if (vars) Object.keys(vars).forEach(function (v) { s = s.split("{" + v + "}").join(vars[v]); });
    return s;
  }
  var RESULTS = ["pending", "won", "lost", "void", "push", "cashout", "half-won", "half-lost"];

  /* =====================================================
     state
     ===================================================== */
  var S = {
    tab: "review", st: null, sel: new Set(), editing: new Set(), histFilter: "ready", enabling: false,
    page: { tab: null, host: "", domain: "", supported: false, frames: [] }, site: null, armed: null
  };
  var $ = function (id) { return document.getElementById(id); };
  function bg(m) { return api.runtime.sendMessage(m); }
  var msgTimer = null;
  function msg(text, tone) {
    var m = $("msg"); m.textContent = text || ""; m.className = "msg" + (tone ? " is-" + tone : ""); m.hidden = !text;
    clearTimeout(msgTimer); if (text) msgTimer = setTimeout(function () { m.hidden = true; }, 7000);
  }

  /* ---------- DOM helper: h("div.cls", {attrs|on*}, children…) ---------- */
  function h(sel, attrs) {
    var parts = sel.split("."), el = document.createElement(parts[0] || "div");
    if (parts.length > 1) el.className = parts.slice(1).join(" ");
    var kids = Array.prototype.slice.call(arguments, 2);
    if (attrs && (typeof attrs !== "object" || attrs.nodeType || Array.isArray(attrs))) { kids.unshift(attrs); attrs = null; }
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k.indexOf("on") === 0) el.addEventListener(k.slice(2), v);
      else if (k === "html") el.innerHTML = v; // only ever our own static strings
      else if (k in el && k !== "list") el[k] = v;
      else el.setAttribute(k, v === true ? "" : v);
    });
    (function add(list) { list.forEach(function (c) { if (c == null || c === false) return; if (Array.isArray(c)) add(c); else el.appendChild(c.nodeType ? c : document.createTextNode(String(c))); }); })(kids);
    return el;
  }
  function svg(markup, w, hgt) { var d = h("span"); d.innerHTML = '<svg viewBox="0 0 24 24" width="' + (w || 18) + '" height="' + (hgt || w || 18) + '" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + markup + "</svg>"; return d.firstChild; }
  var IC = {
    x: '<path d="M6 6l12 12M6 18L18 6"/>', check: '<path d="M5 12l5 5L20 6"/>', ticket: '<path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2 2 2 0 0 0 0 4 2 2 0 0 1-2 2H5a2 2 0 0 1-2-2 2 2 0 0 0 0-4z"/><path d="M14 7v10"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>', bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>', undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5M5 20h14"/>', send: '<path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/>', copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a1 1 0 0 1 1-1h10"/>'
  };

  /* ---------- formatting ---------- */
  function money(v, cur) {
    if (v == null || v === "") return "—";
    var sym = cur === "BRL" ? "R$ " : cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur === "USD" ? "$" : "";
    if (!sym && cur) try { return Number(v).toLocaleString(loc(), { style: "currency", currency: cur }); } catch (_) {}
    return sym + Number(v).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function odds(v) { return v == null ? "—" : Number(v).toLocaleString(loc(), { minimumFractionDigits: 2, maximumFractionDigits: 3 }); }
  function cents(p) { return p == null ? "—" : Number(p * 100).toLocaleString(loc(), { maximumFractionDigits: 1 }) + "¢"; }
  function num(v, d) { return v == null ? "—" : Number(v).toLocaleString(loc(), { maximumFractionDigits: d == null ? 2 : d }); }
  function kindOf(b) { return b.kind || "sportsbook"; }
  function dateLabel(iso, time) {
    if (!iso) return "";
    var d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString(loc(), { day: "2-digit", month: "short" }) + (time ? " " + time : "");
  }
  function eventText(b) { return b.teamB ? b.teamA + " x " + b.teamB : (b.teamA || ""); }
  function resultTone(r) { return r === "won" || r === "half-won" ? "is-pos" : r === "lost" || r === "half-lost" ? "is-neg" : r === "pending" ? "" : "is-warn"; }

  // plain-language reason the numbers add up (or don't)
  function why(it) {
    var c = it.checks || {}, b = it.bet;
    if (c.returnMatch == null || c.ret == null) return null;
    var vars = { ret: money(c.ret, b.currency), stake: money(b.stake, b.currency), odds: odds(b.odds), exp: money(c.expected, b.currency), half: money(b.stake / 2, b.currency) };
    if (c.basis === "liability") return { ok: c.returnMatch, text: t(c.returnMatch ? "why.liability.ok" : "why.liability.bad", vars) };
    if (c.basis === "shares") { vars.ret = num(c.ret); vars.exp = num(c.expected); vars.price = cents(b.price); return { ok: c.returnMatch, text: t(c.returnMatch ? "why.shares.ok" : "why.shares.bad", vars) }; }
    if (c.basis && c.basis.indexOf("pl") === 0) return { ok: !!c.returnMatch, text: t(c.returnMatch ? "why." + c.basis : "why.pl", vars) };
    if (c.basis === "potential") return { ok: c.returnMatch, text: t(c.returnMatch ? "why.potential.ok" : "why.potential.bad", vars) };
    if (!c.returnMatch) return { ok: false, text: t("why.bad", vars) };
    return { ok: true, text: t("why." + c.basis, vars) };
  }
  // re-check after an edit to odds / stake / result
  function recheck(it) {
    var c = it.checks || {}, b = it.bet;
    if (kindOf(b) === "exchange") {
      if (b.dir === "lay" && b.stake > 0 && b.odds > 1) b.liability = Math.round(b.stake * (b.odds - 1) * 100) / 100; else if (b.dir !== "lay") b.liability = null;
      if (c.basis === "liability") it.checks = { returnMatch: P.near(c.ret, b.liability), basis: "liability", ret: c.ret, expected: b.liability };
      else if (c.basis && c.basis.indexOf("pl") === 0 && c.ret != null) {
        var ie = P.inferExchange(b.dir, b.odds, b.stake, (b.commission || 0) / 100, c.ret);
        it.checks = ie ? { returnMatch: ie.result === b.result, basis: "pl-" + ie.result, ret: c.ret, expected: ie.expected } : { returnMatch: false, basis: "pl", ret: c.ret, expected: null };
      }
      return;
    }
    if (kindOf(b) === "prediction") {
      if (b.price > 0 && b.price < 1) b.odds = P.r3(1 / b.price);
      if (c.basis === "shares" && b.stake > 0 && b.price > 0) it.checks = { returnMatch: P.near(c.ret, b.stake / b.price, 0.03), basis: "shares", ret: c.ret, expected: P.r2(b.stake / b.price) };
      return;
    }
    if (c.ret == null || !(b.stake > 0 && b.odds > 1)) return;
    if (c.basis === "potential" || b.result === "pending") {
      var exp = b.isParlay || it.mode !== "singles" ? b.stake * b.odds : c.expected;
      it.checks = { returnMatch: P.near(c.ret, exp), basis: "potential", ret: c.ret, expected: Math.round(exp * 100) / 100 };
      return;
    }
    var inf = P.inferResult(b.stake, b.odds, c.ret, b.result);
    it.checks = inf ? { returnMatch: inf.result === b.result || (inf.result === "void" && b.result === "push"), basis: inf.result, ret: c.ret, expected: inf.expected }
      : { returnMatch: false, basis: b.result, ret: c.ret, expected: Math.round(b.stake * b.odds * 100) / 100 };
    if (inf && inf.result !== b.result && !(inf.result === "void" && b.result === "push")) it.checks.returnMatch = false;
  }

  /* =====================================================
     data
     ===================================================== */
  function refresh() {
    return bg({ type: "get-state" }).then(function (st) {
      S.st = st;
      lang = st.uiLang || "pt";
      S.site = null;
      Object.keys(st.sites).forEach(function (k) { var s = st.sites[k]; if (S.page.host && (S.page.host === s.domain || S.page.host.endsWith("." + s.domain))) S.site = s; });
      var ids = new Set(st.queue.map(function (x) { return x.id; }));
      S.sel.forEach(function (id) { if (!ids.has(id)) S.sel.delete(id); });
      render();
    });
  }

  /* =====================================================
     render
     ===================================================== */
  function render() {
    document.documentElement.lang = loc();
    document.querySelectorAll("[data-i18n]").forEach(function (el) { el.textContent = t(el.getAttribute("data-i18n")); });
    $("brandSub").textContent = t(FULL ? "sub.full" : "sub.popup");
    $("btnExpand").title = t("expand"); $("btnExpand").setAttribute("aria-label", t("expand"));
    $("btnExpand").hidden = FULL;
    $("nReview").textContent = S.st.queue.length || "";
    $("nReady").textContent = S.st.outbox.filter(function (x) { return x.dest !== "hold"; }).length || "";
    document.querySelectorAll("#tabs button").forEach(function (b) { b.setAttribute("aria-selected", String(b.dataset.tab === S.tab)); });
    renderSite();
    var view = $("view"), keep = view.scrollTop;
    view.textContent = "";
    ({ review: renderReview, capture: renderCapture, history: renderHistory, settings: renderSettings })[S.tab](view);
    view.scrollTop = keep;
    renderBulk();
  }

  /* ---------- site strip ---------- */
  function siteState() {
    var auto = (S.st.settings.mode || "auto") !== "list";
    var active = auto ? !(S.site && S.site.state === "paused") : !!(S.site && S.site.state === "on");
    return { auto: auto, active: active };
  }
  function renderSite() {
    var box = $("site");
    box.textContent = "";
    if (FULL) { box.appendChild(h("p.site__note", t("site.full"))); return; }
    if (!S.page.supported) { box.appendChild(h("div.site__row", h("span.dot"), h("span.dim.small", t("site.na")))); return; }
    var ss = siteState();
    var name = S.site ? S.site.book : P.bookFromHost(S.page.host);
    var label = ss.active ? t(ss.auto ? "site.auto" : "site.on") : t(ss.auto ? "site.paused" : "site.off");
    var btnLabel = ss.auto ? (ss.active ? t("site.pause") : t("site.resume")) : (ss.active ? t("site.disable") : t("site.enable"));
    box.appendChild(h("div.site__row",
      h("span.dot" + (ss.active ? ".is-on" : "")),
      h("div.site__host", h("b", name), h("small", label)),
      h(ss.active ? "button.ghost.ghost--sm" : "button.raised", { type: "button", onclick: toggleSite }, btnLabel)));
  }
  // instant: host access is granted at install, so there is no browser prompt here
  function toggleSite() {
    var ss = siteState();
    var domain = S.site ? S.site.domain : S.page.domain;
    var patch = { state: ss.active ? "paused" : "on" };
    if (!S.site) patch.book = P.bookFromHost(S.page.host);
    if (!ss.active && !ss.auto) patch.extraDomains = S.page.frames.filter(function (f) { return f.big; }).map(function (f) { return f.domain; });
    bg({ type: "set-site", domain: domain, patch: patch }).then(function () {
      if (!ss.active) inject(true).catch(function () {});
      return refresh();
    });
  }

  /* ---------- Review ---------- */
  function renderReview(view) {
    var q = S.st.queue;
    if (!q.length) {
      view.appendChild(h("div.empty", svg(IC.ticket, 30), h("b", t("rev.emptyT")), h("span", t("rev.emptyS")),
        h("button.ghost", { type: "button", onclick: function () { go("capture"); } }, t("rev.howto"))));
      return;
    }
    var all = q.length && q.every(function (x) { return S.sel.has(x.id); });
    view.appendChild(h("div.row.row--between",
      h("span.eyebrow", q.length + " · " + t("tab.review")),
      h("label.row.small.dim", h("input.check", { type: "checkbox", checked: all, onchange: function (e) { S.sel = new Set(e.target.checked ? q.map(function (x) { return x.id; }) : []); render(); } }), t("rev.all"))));
    view.appendChild(h("div.list.list--grid", q.map(betCard)));
  }

  function betCard(it) {
    var b = it.bet, editing = S.editing.has(it.id), sel = S.sel.has(it.id);
    var w = why(it);
    var settled = b.result && b.result !== "pending";
    var tone = it.status === "placed" ? ".is-pos" : it.status === "unconfirmed" ? ".is-warn" : "";
    var sig = it.signal && t("sg." + it.signal) !== "sg." + it.signal ? " · " + t("sg." + it.signal) : "";
    var main = b.isParlay ? t("b.parlay") + " · " + b.legs.length + " " + t("b.legs") : (b.side || b.market || "—");
    var sub = b.isParlay ? "" : [b.market, eventText(b)].filter(Boolean).join(" · ");
    var k = kindOf(b);
    if (k === "prediction") sub = eventText(b);
    return h("article.card.bet" + (sel ? ".is-selected" : ""),
      h("div.bet__top",
        h("input.check", { type: "checkbox", checked: sel, "aria-label": main, onchange: function (e) { if (e.target.checked) S.sel.add(it.id); else S.sel.delete(it.id); render(); } }),
        h("div.bet__meta", h("span.pill" + tone, t("st." + it.status) + sig), h("b", b.book || it.host), h("span", dateLabel(b.date, b.time))),
        h("button.xbtn", { type: "button", title: t("b.discard"), "aria-label": t("b.discard"), onclick: function () { act("discard", [it.id]); } }, svg(IC.x, 15))),
      h("div.bet__main",
        h("div.bet__what", h("span.bet__sel", k !== "sportsbook" && b.dir ? h("span.dir.dir--" + b.dir, dirLabel(b)) : null, main), sub ? h("span.bet__sub", sub) : null, b.line ? h("span.bet__sub", t("f.line") + " " + b.line) : null),
        k === "prediction" ? h("span.bet__odds", cents(b.price)) : h("span.bet__odds", h("small", "@"), odds(b.odds))),
      b.isParlay ? h("div.legs", b.legs.map(function (l) { return h("div", h("span", [l.sel, l.market, l.event].filter(Boolean).join(" · ") || "—"), h("b", odds(l.odds))); })) : null,
      h("div.bet__stats", statCells(it, settled)),
      w ? h("div.why" + (w.ok ? ".is-ok" : ".is-bad"), h("i", w.ok ? "✓" : "!"), h("span", w.text)) : null,
      k === "exchange" && (b.commission == null || b.commission === "") ? h("div.why.is-bad", h("i", "!"), h("span", t("x.commMissing"))) : null,
      convLine(b),
      !b.date ? h("div.why.is-bad", h("i", "!"), h("span", t("noDate"))) : null,
      editing ? editForm(it) : null,
      h("div.bet__actions",
        h("span.grow", h("button.ghost.ghost--sm", { type: "button", onclick: function () { toggleEdit(it.id); } }, editing ? t("b.done") : t("b.edit"))),
        h("button.ghost.ghost--sm.ghost--danger", { type: "button", onclick: function () { act("discard", [it.id]); } }, t("b.discard"))),
      h("div.acts", isPending(it) ? pendingButtons(it) : exportButtons([it.id], false, !b.date))
    );
  }
  function dirLabel(b) { return kindOf(b) === "prediction" ? t("pm." + b.dir) : t("x." + b.dir); }
  function resultCell(b) { return h("div", h("span", t("b.result")), h("b", h("span.pill." + (resultTone(b.result) || "x"), t("r." + (b.result || "pending"))))); }
  // stake / what comes back / result — per kind of bet
  function statCells(it, settled) {
    var b = it.bet, k = kindOf(b);
    if (k === "exchange") {
      var profit = b.stake > 0 && b.odds > 1 ? P.exchangeProfit(b.dir, b.odds, b.stake, (b.commission || 0) / 100, "won") : null;
      return [h("div", h("span", t(b.dir === "lay" ? "x.backerStake" : "b.stake")), h("b", money(b.stake, b.currency))),
        b.dir === "lay" ? h("div", h("span", t("x.liab")), h("b", money(b.liability, b.currency))) : h("div", h("span", t("x.profit")), h("b", money(profit, b.currency))),
        resultCell(b)];
    }
    if (k === "prediction") {
      return [h("div", h("span", t("pm.cost")), h("b", money(b.stake != null ? b.stake + (b.fee || 0) : null, b.currency))),
        h("div", h("span", t("pm.pays")), h("b", money(b.shares, b.currency))),
        resultCell(b)];
    }
    return [h("div", h("span", t("b.stake")), h("b", money(b.stake, b.currency))),
      h("div", h("span", settled ? t("b.return") : t("b.potential")), h("b", money(it.checks && it.checks.ret != null ? it.checks.ret : (b.stake && b.odds ? b.stake * b.odds : null), b.currency))),
      resultCell(b)];
  }
  // lay bets and prediction positions enter the tracker as an equivalent back bet: show it
  function convLine(b) {
    var k = kindOf(b);
    if (k === "sportsbook" || !(b.stake > 0) || (k === "exchange" && b.dir !== "lay" && !b.commission)) return null;
    var v = P.trackerView(b);
    if (!(v.odds > 1)) return null;
    return h("div.why.is-info", h("i", "→"), h("span", t("conv", { side: v.side || "—", stake: money(v.stake, b.currency), odds: Number(v.odds).toLocaleString(loc(), { maximumFractionDigits: 4 }) })));
  }
  function csvFirst() { return S.st.settings.exportTo !== "tracker"; }
  // bets without a date can't be exported (the tracker would stamp them with today's date)
  function withDate(ids) { var ok = itemsFor(ids).filter(function (x) { return x.bet.date; }).map(function (x) { return x.id; }); return { ok: ok, missing: ids.length - ok.length }; }
  function isPending(it) { return !it.bet.result || it.bet.result === "pending"; }
  function splitPending(ids) {
    var items = itemsFor(ids);
    return { settled: items.filter(function (x) { return !isPending(x); }).map(function (x) { return x.id; }), pending: items.filter(isPending).map(function (x) { return x.id; }) };
  }
  // settled → CSV now; still pending → kept in History → Pending until the result is read
  function exportCsv(ids, force) {
    var sp = force ? { settled: ids, pending: [] } : splitPending(ids);
    var d = withDate(sp.settled), parts = [];
    var hold = sp.pending.length ? bg({ type: "save", ids: sp.pending }) : Promise.resolve(null);
    hold.then(function (r) {
      if (d.ok.length) { downloadCsv(d.ok, "exported"); parts.push(t("exp.csvDone", { n: d.ok.length })); }
      if (r && r.held) parts.push(t("held", { n: r.held }));
      if (d.missing || (r && r.needDate)) parts.push(t("needDate", { n: d.missing + ((r && r.needDate) || 0) }));
      sp.pending.forEach(function (id) { S.sel.delete(id); });
      msg(parts.join(" ") || t("noDate"), d.missing || (r && r.needDate) || !parts.length ? "warn" : "ok");
      return refresh();
    });
  }
  function sendTracker(ids, force) {
    bg({ type: "save", ids: ids, dest: "tracker", force: !!force }).then(function (r) {
      ids.forEach(function (id) { S.sel.delete(id); S.editing.delete(id); });
      var parts = [];
      if (r.saved) parts.push(t("exp.sent", { n: r.saved }));
      if (r.held) parts.push(t("held", { n: r.held }));
      if (r.needDate) parts.push(t("needDate", { n: r.needDate }));
      msg(parts.join(" "), r.needDate ? "warn" : "ok");
      return (r.saved ? bg({ type: "open-tracker" }) : null);
    }).then(refresh);
  }
  function holdIds(ids) {
    bg({ type: "save", ids: ids }).then(function (r) {
      ids.forEach(function (id) { S.sel.delete(id); S.editing.delete(id); });
      msg(t("held", { n: r.held }) + (r.needDate ? " " + t("needDate", { n: r.needDate }) : ""), r.needDate ? "warn" : "ok");
      return refresh();
    });
  }
  // a single still-pending bet: [Export now] [Keep until settled]
  function pendingButtons(it) {
    var now = h("button.ghost.act", { type: "button", disabled: !it.bet.date, onclick: function () { if (csvFirst()) exportCsv([it.id], true); else sendTracker([it.id], true); } }, svg(csvFirst() ? IC.download : IC.send, 15), t("b.now"));
    var keep = h("button.raised.act", { type: "button", disabled: !it.bet.date, onclick: function () { holdIds([it.id]); } }, svg(IC.check, 15), t("b.hold"));
    return [now, keep];
  }
  // [secondary] [primary] — full-size buttons; count shown on bulk actions
  function exportButtons(ids, count, disabled) {
    var n = count ? " (" + ids.length + ")" : "";
    var csv = function (primary) { return h(primary ? "button.raised.act" : "button.ghost.act", { type: "button", disabled: disabled, onclick: function () { exportCsv(ids); } }, svg(IC.download, 15), t("act.csv") + (primary ? n : "")); };
    var trk = function (primary) { return h(primary ? "button.raised.act" : "button.ghost.act", { type: "button", disabled: disabled, onclick: function () { sendTracker(ids); } }, svg(IC.send, 15), t("act.tracker") + (primary ? n : "")); };
    return csvFirst() ? [trk(false), csv(true)] : [csv(false), trk(true)];
  }
  function toggleEdit(id) { if (S.editing.has(id)) S.editing.delete(id); else S.editing.add(id); render(); }
  function editForm(it) {
    var b = it.bet;
    function field(label, key, value, kind, cls) {
      var inp = h("input.input" + (kind === "date" && !value ? ".is-missing" : ""), { type: kind === "date" ? "date" : "text", value: value == null ? "" : String(value), inputMode: kind === "num" ? "decimal" : null });
      inp.addEventListener("change", function () { commit(it, key, inp.value.trim(), kind); });
      return h("label.field" + (cls || ""), h("span", label), inp);
    }
    var res = h("select.input", RESULTS.map(function (r) { return h("option", { value: r }, t("r." + r)); }));
    res.value = b.result || "pending";
    res.addEventListener("change", function () { commit(it, "result", res.value); });
    var k = kindOf(b);
    function dirSelect(opts) {
      var d = h("select.input", opts.map(function (o) { return h("option", { value: o }, k === "prediction" ? t("pm." + o) : t("x." + o)); }));
      d.value = b.dir || opts[0];
      d.addEventListener("change", function () { commit(it, "dir", d.value); });
      return h("label.field", h("span", t("f.dir")), d);
    }
    var money3 = k === "exchange"
      ? h("div.grid3", dirSelect(["back", "lay"]), field(t("f.odds"), "odds", b.odds, "num"), field(t(b.dir === "lay" ? "x.backerStake" : "f.stake"), "stake", b.stake, "num"))
      : k === "prediction"
      ? h("div.grid3", dirSelect(["yes", "no"]), field(t("pm.price"), "price", b.price != null ? Math.round(b.price * 1000) / 10 : "", "cents"), field(t("pm.cost"), "stake", b.stake, "num"))
      : h("div.grid3", field(t("f.odds"), "odds", b.odds, "num"), field(t("f.stake"), "stake", b.stake, "num"), field(t("f.date"), "date", b.date, "date"));
    var extra = k === "exchange" ? h("div.grid3", field(t("x.comm"), "commission", b.commission, "num"), field(t("f.date"), "date", b.date, "date"))
      : k === "prediction" ? h("div.grid3", field(t("pm.shares"), "shares", b.shares, "num"), field(t("pm.fee"), "fee", b.fee, "num"), field(t("f.date"), "date", b.date, "date"))
      : null;
    return h("div.edit",
      b.isParlay ? null : field(t("f.event"), "event", eventText(b), null, ".span2"),
      h("div.grid2",
        b.isParlay ? null : field(t("f.market"), "market", b.market),
        b.isParlay ? null : field(t("f.sel"), "side", b.side),
        k === "sportsbook" ? field(t("f.line"), "line", b.line) : null,
        h("label.field", h("span", t("f.result")), res)),
      money3, extra);
  }
  function commit(it, key, v, kind) {
    var patch = {};
    if (key === "event") { var sp = P.splitEvent(v); patch = sp ? { teamA: sp.teamA, teamB: sp.teamB } : { teamA: v, teamB: "" }; }
    else if (kind === "num") patch[key] = P.parseNumber(v, key === "odds" ? "odds" : "amount", lang);
    else if (kind === "cents") { var cv = P.parseNumber(v, "odds"); patch.price = cv > 0 && cv < 100 ? Math.round(cv * 10) / 1000 : null; }
    else patch[key] = v;
    it.bet = Object.assign({}, it.bet, patch);
    recheck(it);
    // derived fields (liability, prediction odds) travel with the edit
    ["liability", "odds"].forEach(function (f) { if (!(f in patch) && kindOf(it.bet) !== "sportsbook") patch[f] = it.bet[f]; });
    bg({ type: "update-item", id: it.id, bet: patch, checks: it.checks }).then(refresh);
  }

  /* ---------- bulk footer (Review) ---------- */
  function renderBulk() {
    var f = $("bulk");
    f.textContent = "";
    var ids = Array.from(S.sel);
    if (S.tab !== "review" || !ids.length) { f.hidden = true; return; }
    f.hidden = false;
    f.appendChild(h("div.bulk__row",
      h("span.bulk__n", t("bulk.sel", { n: ids.length })),
      h("button.ghost.ghost--sm", { type: "button", onclick: function () { var d = withDate(ids); if (d.ok.length) copyCsv(d.ok, "exported"); else msg(t("noDate"), "warn"); } }, svg(IC.copy, 14), t("act.copy")),
      h("button.ghost.ghost--sm.ghost--danger", { type: "button", onclick: function () { act("discard", ids); } }, t("bulk.discard"))));
    f.appendChild(h("div.acts", exportButtons(ids, true, false)));
  }

  function act(type, ids) {
    return bg({ type: type, ids: ids }).then(function (r) {
      ids.forEach(function (id) { S.sel.delete(id); S.editing.delete(id); });
      if (type === "save") {
        var text = t(r.dest === "tracker" ? (r.trackerOpen ? "savedOpen" : "saved") : "savedCsv", { n: r.saved });
        if (r.needDate) text += " " + t("needDate", { n: r.needDate });
        msg(text, r.needDate ? "warn" : "ok");
      } else if (type === "discard") msg(t("discarded", { n: r.discarded }), "ok");
      return refresh();
    });
  }
  function itemsFor(ids, from) { var s = new Set(ids); return (from || S.st.queue).filter(function (x) { return s.has(x.id); }); }
  function copyCsv(ids, after, from) {
    var csv = DBL_CSV.toCSV(itemsFor(ids, from));
    navigator.clipboard.writeText(csv).then(function () {
      msg(t("copied"), "ok");
      return bg({ type: after, ids: ids }).then(function () { ids.forEach(function (id) { S.sel.delete(id); }); return refresh(); });
    }, function () { msg(t("copyFail"), "err"); });
  }
  function downloadCsv(ids, after, from) {
    saveFile("apostas-" + P.localISO(new Date()) + ".csv", DBL_CSV.toCSV(itemsFor(ids, from)), "text/csv");
    if (after !== "outbox-exported") msg(t("downloaded"), "ok");
    bg({ type: after, ids: ids }).then(function () { ids.forEach(function (id) { S.sel.delete(id); }); return refresh(); });
  }
  function saveFile(name, text, type) {
    var url = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
    var a = h("a", { href: url, download: name });
    document.body.appendChild(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 2000);
  }

  /* ---------- Capture ---------- */
  var ART_SLIP = '<svg viewBox="0 0 92 92"><rect x="14" y="8" width="64" height="76" rx="9" fill="#141416" stroke="rgba(255,255,255,.18)"/><rect x="22" y="18" width="30" height="5" rx="2.5" fill="rgba(245,246,248,.75)"/><rect x="22" y="27" width="22" height="4" rx="2" fill="rgba(245,246,248,.35)"/><rect x="56" y="17" width="14" height="9" rx="3" fill="#232327" stroke="rgba(255,255,255,.2)"/><rect x="22" y="40" width="48" height="10" rx="3" fill="#08080a" stroke="rgba(255,255,255,.16)"/><rect x="22" y="56" width="48" height="12" rx="6" fill="#e9ebef"/><circle cx="72" cy="72" r="13" fill="#3ad07f"/><path d="M66 72l4 4 8-8" fill="none" stroke="#0d0d0f" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ART_HIST = '<svg viewBox="0 0 92 92"><rect x="10" y="10" width="72" height="72" rx="9" fill="#141416" stroke="rgba(255,255,255,.18)"/><g><rect x="18" y="20" width="36" height="5" rx="2.5" fill="rgba(245,246,248,.75)"/><rect x="18" y="28" width="24" height="4" rx="2" fill="rgba(245,246,248,.3)"/><rect x="58" y="20" width="16" height="10" rx="5" fill="rgba(58,208,127,.18)" stroke="#3ad07f"/></g><g><rect x="18" y="42" width="30" height="5" rx="2.5" fill="rgba(245,246,248,.75)"/><rect x="18" y="50" width="20" height="4" rx="2" fill="rgba(245,246,248,.3)"/><rect x="58" y="42" width="16" height="10" rx="5" fill="rgba(224,112,106,.18)" stroke="#e0706a"/></g><g><rect x="18" y="64" width="34" height="5" rx="2.5" fill="rgba(245,246,248,.75)"/><rect x="18" y="72" width="22" height="4" rx="2" fill="rgba(245,246,248,.3)"/><rect x="58" y="64" width="16" height="10" rx="5" fill="rgba(224,184,74,.18)" stroke="#e0b84a"/></g></svg>';
  function renderCapture(view) {
    var ready = !FULL && S.page.supported;
    view.appendChild(h("section.card",
      h("span.eyebrow", t("cap.flowT")),
      h("div.flow",
        h("div.flow__step", h("span.flow__ic", svg(IC.ticket, 18)), t("cap.f1")),
        h("span.flow__arrow", svg(IC.arrow, 16)),
        h("div.flow__step", h("span.flow__ic", svg(IC.eye, 18)), t("cap.f2")),
        h("span.flow__arrow", svg(IC.arrow, 16)),
        h("div.flow__step", h("span.flow__ic.is-pos", svg(IC.bell, 18)), t("cap.f3")))));
    view.appendChild(actionCard(ART_SLIP, t("cap.slipT"), t("cap.slipP"), [t("cap.slip1"), t("cap.slip2")], t("cap.slipGo"), capture, ready));
    view.appendChild(actionCard(ART_HIST, t("cap.histT"), t("cap.histP"), [t("cap.hist1"), t("cap.hist2"), t("cap.hist3")], t("cap.histGo"), importHistory, ready));
  }
  function actionCard(art, title, text, steps, goLabel, fn, enabled) {
    var artBox = h("div.action__art"); artBox.innerHTML = art;
    return h("section.card.action", artBox,
      h("div.action__body", h("h3", title), h("p", text),
        h("ol", steps.map(function (s) { return h("li", { html: s }); })),
        h("div.action__go",
          h("button.raised", { type: "button", disabled: !enabled, onclick: fn }, goLabel),
)));
  }
  function inject(allFrames) { return api.scripting.executeScript({ target: { tabId: S.page.tab.id, allFrames: allFrames }, files: WATCH_FILES }); }
  function callPage(fnName) {
    var all = true; // host access covers every frame
    var run = function () {
      return api.scripting.executeScript({ target: { tabId: S.page.tab.id, allFrames: all }, func: function (name) { return window.__dblApi ? window.__dblApi[name]() : "__missing__"; }, args: [fnName] });
    };
    return run().then(function (res) {
      return res.some(function (r) { return r.result === "__missing__"; }) ? inject(all).then(run) : res;
    }).then(function (res) { return res.map(function (r) { return r.result; }).filter(function (x) { return x && x !== "__missing__"; }); });
  }
  function capture() {
    callPage("captureNow").then(function (list) {
      if (!list.length) return msg(t("cap.noSlip"), "err");
      return bg({ type: "add-items", host: S.page.host, payload: list[0] }).then(function (r) {
        msg(r.added ? t("cap.added", { n: r.added }) : t("cap.dupes"), r.added ? "ok" : "warn");
        if (r.added) S.tab = "review";
        return refresh();
      });
    }).catch(function () { msg(t("cap.cant"), "err"); });
  }
  function importHistory() {
    callPage("scanHistory").then(function (list) {
      var rows = [];
      list.forEach(function (x) { rows = rows.concat(x.rows); });
      if (!rows.length) return msg(t("cap.noHist"), "err");
      return bg({ type: "add-items", host: S.page.host, payload: { rows: rows } }).then(function (r) {
        msg(t("cap.histDone", { found: r.found, added: r.added, updated: r.updated, released: r.released || 0 }), "ok");
        if (r.added || r.updated) S.tab = "review";
        return refresh();
      });
    }).catch(function () { msg(t("cap.cant"), "err"); });
  }

  /* ---------- History ---------- */
  function renderHistory(view) {
    var out = S.st.outbox;
    var hold = out.filter(function (x) { return x.dest === "hold"; });
    var ready = out.filter(function (x) { return x.dest !== "hold"; });
    var log = S.st.history;
    var count = { hold: hold.length, ready: ready.length, imported: 0, exported: 0, discarded: 0, all: log.length };
    log.forEach(function (e) { count[e.outcome] = (count[e.outcome] || 0) + 1; });
    var f = S.histFilter;
    view.appendChild(h("div.chips.chips--tabs", ["hold", "ready", "imported", "exported", "discarded", "all"].map(function (k) {
      return h("button.chip", { type: "button", "aria-pressed": String(f === k), onclick: function () { S.histFilter = k; render(); } },
        t("his.f." + k), count[k] ? h("span.chip__n", String(count[k])) : null);
    })));

    if (f === "ready") {
      var ids = ready.map(function (x) { return x.id; }), toTracker = S.st.settings.exportTo === "tracker";
      var csvBtn = function (primary) {
        return h(primary ? "button.raised.act" : "button.ghost.act", { type: "button", disabled: !ready.length, onclick: function () {
          var n = ids.length; downloadCsv(ids, "outbox-exported", ready); msg(t("exp.csvDone", { n: n }), "ok");
        } }, svg(IC.download, 15), t("exp.csv") + (primary && ready.length ? " (" + ready.length + ")" : ""));
      };
      var trkBtn = function (primary) {
        return h(primary ? "button.raised.act" : "button.ghost.act", { type: "button", disabled: !ready.length, onclick: function () {
          bg({ type: "send-to-tracker" }).then(function (r) { msg(t("exp.sent", { n: r.sent }), "ok"); return refresh(); });
        } }, svg(IC.send, 15), t("exp.tracker") + (primary && ready.length ? " (" + ready.length + ")" : ""));
      };
      view.appendChild(h("section.card",
        h("span.small.dim", toTracker ? t("exp.subTracker") : t("exp.subCsv")),
        h("div.acts", toTracker ? [csvBtn(false), trkBtn(true)] : [trkBtn(false), csvBtn(true)])));
      view.appendChild(ready.length ? h("div.clist", ready.map(function (x) {
        return crow(x, x.dest === "tracker" ? h("span.pill.is-pos", t("exp.waiting")) : null,
          [iconBtn(IC.undo, t("his.back"), function () { bg({ type: "unsave", ids: [x.id] }).then(refresh); })]);
      })) : h("div.empty", h("span", t("ready.none"))));
      return;
    }

    if (f === "hold") {
      var hids = hold.map(function (x) { return x.id; });
      view.appendChild(h("section.card",
        h("span.small.dim", t("hold.sub")),
        h("div.acts",
          h("button.ghost.act", { type: "button", disabled: !hold.length, onclick: function () {
            if (csvFirst()) { downloadCsv(hids, "outbox-exported", hold); msg(t("exp.csvDone", { n: hids.length }), "ok"); }
            else bg({ type: "send-to-tracker", ids: hids }).then(function (r) { msg(t("exp.sent", { n: r.sent }), "ok"); return refresh(); });
          } }, svg(csvFirst() ? IC.download : IC.send, 15), t("hold.anyway")),
          h("button.raised.act", { type: "button", onclick: function () { go("capture"); } }, svg(IC.eye, 15), t("hold.read")))));
      view.appendChild(hold.length ? h("div.clist", hold.map(function (x) {
        return crow(x, null, [iconBtn(IC.undo, t("his.back"), function () { bg({ type: "unsave", ids: [x.id] }).then(refresh); })]);
      })) : h("div.empty", h("span", t("hold.none"))));
      return;
    }

    var list = log.filter(function (e) { return f === "all" || e.outcome === f; });
    if (log.length) view.appendChild(h("div.row.row--between", h("span.small.dim", list.length + " / " + log.length),
      armedButton("clear-history", t("his.clear"), function () { bg({ type: "clear-history" }).then(refresh); })));
    view.appendChild(list.length ? h("div.clist", list.slice(0, 300).map(function (e) {
      return crow(e.item, h("span.pill" + (e.outcome === "imported" ? ".is-pos" : ""), t("his.o." + e.outcome)), [
        iconBtn(IC.undo, t("his.restore"), function () { bg({ type: "restore", ids: [e.id] }).then(refresh); }),
        iconBtn(IC.x, t("his.delete"), function () { bg({ type: "delete-history", ids: [e.id] }).then(refresh); }, true)
      ], e);
    })) : h("div.empty", h("span", t("his.empty"))));
  }
  // compact row: what · where · stake · date | result (+ tag) | small actions
  function crow(it, tag, actions, entry) {
    var b = it.bet;
    var k = kindOf(b);
    var main = (k !== "sportsbook" && b.dir ? dirLabel(b) + " \u00b7 " : "") + (b.isParlay ? t("b.parlay") + " \u00b7 " + b.legs.length + " " + t("b.legs") : (b.side || b.market || "\u2014")) + (k === "prediction" ? " @ " + cents(b.price) : " @ " + odds(b.odds));
    var sub = [b.book, eventText(b), money(b.stake, b.currency), dateLabel(b.date, b.time)].filter(Boolean).join(" \u00b7 ");
    return h("div.crow" + (entry && entry.late ? ".is-late" : ""),
      h("div.crow__main", h("span.crow__sel", { title: main }, main), h("span.crow__sub", { title: sub }, sub),
        entry && entry.late ? h("span.crow__late", t("his.late")) : null),
      h("div.crow__side", h("span.pill." + (resultTone(b.result) || "x"), t("r." + (b.result || "pending"))), tag),
      h("div.crow__acts", actions));
  }
  function iconBtn(icon, label, fn, danger) {
    return h("button.xbtn" + (danger ? "" : ".xbtn--plain"), { type: "button", title: label, "aria-label": label, onclick: fn }, svg(icon, 15));
  }
  // two-step confirm inside the page (no confirm() dialogs)
  function armedButton(key, label, fn, cls) {
    var armed = S.armed && S.armed.key === key && Date.now() < S.armed.until;
    return h("button.ghost.ghost--sm.ghost--danger" + (armed ? ".is-armed" : "") + (cls || ""), { type: "button", onclick: function () {
      if (armed) { S.armed = null; fn(); return; }
      S.armed = { key: key, until: Date.now() + 4000 }; render();
      setTimeout(function () { if (S.armed && S.armed.key === key) { S.armed = null; render(); } }, 4100);
    } }, armed ? t("his.sure") : label);
  }

  /* ---------- Settings ---------- */
  function renderSettings(view) {
    var st = S.st.settings;
    function toggle(key, title, sub) {
      var inp = h("input", { type: "checkbox", checked: !!st[key], onchange: function (e) { var o = {}; o[key] = e.target.checked; bg({ type: "save-settings", settings: o }).then(refresh); } });
      return h("label.setrow", h("div.setrow__txt", h("b", title), h("small", sub)), h("span.switch", inp, h("span")));
    }
    view.appendChild(h("section.card",
      h("span.eyebrow", t("set.alerts")),
      toggle("notify", t("set.notify"), t("set.notifyS") + (S.st.isFirefox ? " " + t("set.notifyFx") : "")),
      toggle("keepUnconfirmed", t("set.unconf"), t("set.unconfS"))));

    var exp = st.exportTo === "tracker" ? "tracker" : "csv";
    function expRow(value, title, sub) {
      return h("label.setrow", h("input.check", { type: "radio", name: "exportTo", checked: exp === value, onchange: function () { bg({ type: "save-settings", settings: { exportTo: value } }).then(refresh); } }),
        h("div.setrow__txt", h("b", title), h("small", sub)));
    }
    view.appendChild(h("section.card", h("span.eyebrow", t("set.export")),
      expRow("csv", t("set.exp.csv"), t("set.exp.csvS")),
      expRow("tracker", t("set.exp.tracker"), t("set.exp.trackerS"))));

    var url = h("input.input", { type: "url", value: st.trackerUrl || "", spellcheck: false });
    url.addEventListener("change", function () { bg({ type: "save-settings", settings: { trackerUrl: url.value.trim() || "https://doinp.com.br/tools/betting-tracker" } }).then(refresh); });
    var lg = h("select.input", h("option", { value: "auto" }, t("set.lang.auto")),
      Object.keys(I18N).map(function (code) { return h("option", { value: code }, I18N[code]["lang.name"] || code); }));
    lg.value = st.lang || "auto";
    lg.addEventListener("change", function () { bg({ type: "save-settings", settings: { lang: lg.value } }).then(refresh); });
    view.appendChild(h("section.card", h("span.eyebrow", t("set.tracker")),
      h("div.grid2", h("label.field.span2", h("span", t("set.trackerUrl")), url), h("label.field", h("span", t("set.lang")), lg))));

    var mode = st.mode || "auto";
    function modeRow(value, title, sub) {
      return h("label.setrow", h("input.check", { type: "radio", name: "mode", checked: mode === value, onchange: function () { bg({ type: "save-settings", settings: { mode: value } }).then(refresh); } }),
        h("div.setrow__txt", h("b", title), h("small", sub)));
    }
    view.appendChild(h("section.card", h("span.eyebrow", t("set.mode")),
      modeRow("auto", t("set.mode.auto"), t("set.mode.autoS")),
      modeRow("list", t("set.mode.list"), t("set.mode.listS"))));

    var sites = Object.keys(S.st.sites).map(function (k) { return S.st.sites[k]; });
    view.appendChild(h("section.card", h("span.eyebrow", t("set.sites")),
      sites.length ? sites.map(function (s) {
        var nm = h("input.input", { type: "text", value: s.book });
        nm.addEventListener("change", function () { bg({ type: "update-site", domain: s.domain, patch: { book: nm.value.trim() || s.book } }).then(refresh); });
        var fm = h("select.input", ["auto", "decimal", "american", "fractional"].map(function (f) { return h("option", { value: f }, t("fmt." + f)); }));
        fm.value = s.fmt || "auto";
        fm.addEventListener("change", function () { bg({ type: "update-site", domain: s.domain, patch: { fmt: fm.value } }).then(refresh); });
        var on = h("input", { type: "checkbox", checked: s.state !== "paused", onchange: function (e) { bg({ type: "set-site", domain: s.domain, patch: { state: e.target.checked ? "on" : "paused" } }).then(refresh); } });
        var kd = h("select.input", ["auto", "sportsbook", "exchange", "prediction"].map(function (f) { return h("option", { value: f }, t("kind." + f)); }));
        kd.value = s.kind || "auto";
        kd.addEventListener("change", function () { bg({ type: "update-site", domain: s.domain, patch: { kind: kd.value } }).then(refresh); });
        var cm = h("input.input", { type: "text", inputMode: "decimal", value: s.commission == null ? "" : String(s.commission), placeholder: "%" });
        cm.addEventListener("change", function () { var v = P.parseNumber(cm.value, "odds"); bg({ type: "update-site", domain: s.domain, patch: { commission: v != null && v >= 0 && v < 100 ? v : null } }).then(refresh); });
        var isEx = s.kind === "exchange" || (!s.kind || s.kind === "auto") && P.kindFor(s.domain, "/exchange") === "exchange";
        return h("div.sec", h("div.row.row--between", h("b.grow", s.domain + (s.extraDomains && s.extraDomains.length ? " + " + s.extraDomains.join(", ") : "")),
          h("span.small.dim", t("set.siteOn")), h("span.switch", on, h("span")),
          h("button.ghost.ghost--sm.ghost--danger", { type: "button", onclick: function () { bg({ type: "disable-site", domain: s.domain }).then(refresh); } }, t("set.remove"))),
          h("div.grid2", h("label.field", h("span", t("site.book")), nm), h("label.field", h("span", t("site.fmt")), fm),
            h("label.field", h("span", t("set.kind")), kd), isEx ? h("label.field", h("span", t("x.comm")), cm) : null));
      }) : h("span.small.dim", t("set.noSites"))));

    var tr = S.st.trace;
    view.appendChild(h("section.card", h("span.eyebrow", t("set.diag")), h("span.small.dim", t("set.diagS")),
      tr.length ? h("div.log", tr.map(function (e) {
        var cls = e.step === "outcome" ? (/^(receipt|cleared)/.test(e.detail) ? "is-ok" : "is-bad") : "";
        return h("div", h("b", new Date(e.t).toLocaleTimeString(loc()) + " " + (e.page || e.host || "") + " · " + e.step), " ", h("span." + (cls || "x"), e.detail));
      })) : h("span.small.dim", t("set.noLog")),
      h("div.row.row--wrap",
        h("button.ghost.ghost--sm", { type: "button", disabled: !tr.length, onclick: copyLog }, t("set.copyLog")),
        h("button.ghost.ghost--sm", { type: "button", disabled: !tr.length, onclick: function () { bg({ type: "clear-trace" }).then(refresh); } }, t("set.clearLog")),
        !FULL && S.page.supported ? h("button.ghost.ghost--sm", { type: "button", onclick: snapshot }, t("set.snap")) : null)));

    view.appendChild(h("section.card", h("span.eyebrow", t("set.data")),
      h("div.setrow", h("div.setrow__txt", h("b", t("set.clearAll")), h("small", t("set.clearAllS"))),
        armedButton("clear-all", t("his.delete"), function () { bg({ type: "clear-all" }).then(function () { S.sel.clear(); msg(t("set.cleared"), "ok"); return refresh(); }); })),
      h("div.setrow", h("div.setrow__txt", h("b", t("set.reset")), h("small", t("set.resetS"))),
        armedButton("reset-all", t("set.reset"), function () { bg({ type: "reset-all" }).then(function () { S.sel.clear(); msg(t("set.cleared"), "ok"); return refresh(); }); }))));
  }
  function copyLog() {
    var text = S.st.trace.map(function (e) { return new Date(e.t).toISOString() + "\t" + (e.page || "") + "\t" + (e.host || "") + "\t" + (e.frame || "") + "\t" + e.step + "\t" + e.detail; }).join("\n");
    navigator.clipboard.writeText(text).then(function () { msg(t("set.logCopied"), "ok"); }, function () { msg(t("copyFail"), "err"); });
  }
  function snapshot() {
    callPage("snapshot").then(function (list) {
      var data = { tool: "doinp-bet-logger", version: api.runtime.getManifest().version, frames: list };
      saveFile("snapshot-" + (S.page.host || "page").replace(/[^a-z0-9.-]/gi, "_") + "-" + Date.now() + ".json", JSON.stringify(data, null, 2), "application/json");
      msg(t("set.snapSaved"), "ok");
    }).catch(function () { msg(t("cap.cant"), "err"); });
  }

  /* =====================================================
     boot
     ===================================================== */
  function go(tab) { S.tab = tab; if (FULL) history.replaceState(null, "", "#" + tab); render(); }
  function boot() {
    if (FULL) { document.body.classList.add("full"); document.documentElement.classList.add("full"); }
    var hash = (location.hash || "").slice(1);
    if (["review", "capture", "history", "settings"].indexOf(hash) >= 0) S.tab = hash;
    document.querySelectorAll("#tabs button").forEach(function (b) { b.addEventListener("click", function () { go(b.dataset.tab); }); });
    $("btnExpand").addEventListener("click", function () { bg({ type: "open-full", tab: S.tab }).then(function () { window.close(); }); });
    // live updates (a bet detected while the popup is open) — but never re-render under the cursor
    var pendingRefresh = false;
    var typing = function () { var a = document.activeElement; return a && /^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName) && a.type !== "checkbox"; };
    api.storage.onChanged.addListener(function (ch, area) {
      if (area !== "local" || !(ch.queue || ch.outbox || ch.history || ch.trace || ch.sites || ch.settings)) return;
      if (typing()) pendingRefresh = true; else refresh();
    });
    document.addEventListener("focusout", function () { setTimeout(function () { if (pendingRefresh && !typing()) { pendingRefresh = false; refresh(); } }, 0); });
    if (FULL) return refresh();
    // ?tab=<id> targets a given tab (used by the end-to-end test to screenshot the popup)
    var forced = parseInt(new URLSearchParams(location.search).get("tab"), 10);
    (forced ? api.tabs.get(forced).then(function (x) { return [x]; }) : api.tabs.query({ active: true, currentWindow: true })).then(function (tabs) {
      var tab = tabs[0] || null;
      S.page.tab = tab;
      try { var u = new URL(tab.url); S.page.supported = /^https?:$/.test(u.protocol); S.page.host = u.hostname; S.page.domain = P.baseDomain(u.hostname); } catch (_) { S.page.supported = false; }
      if (!S.page.supported) return refresh();
      // list the page's iframes so a book embedded from a provider domain can be enabled too
      return api.scripting.executeScript({
        target: { tabId: tab.id },
        func: function () {
          return Array.prototype.map.call(document.querySelectorAll("iframe"), function (f) {
            var r = f.getBoundingClientRect();
            try { return { host: new URL(f.src, location.href).hostname, area: r.width * r.height }; } catch (e) { return null; }
          }).filter(function (x) { return x && x.host; });
        }
      }).then(function (res) {
        var seen = {};
        ((res && res[0] && res[0].result) || []).forEach(function (f) {
          var d = P.baseDomain(f.host);
          if (!d || d === S.page.domain) return;
          seen[d] = seen[d] || { domain: d, big: false };
          if (f.area >= 200 * 200) seen[d].big = true;
        });
        S.page.frames = Object.keys(seen).map(function (k) { return seen[k]; }).sort(function (a, b) { return (b.big - a.big) || a.domain.localeCompare(b.domain); });
      }).catch(function () { S.page.supported = false; }).then(refresh);
    });
  }
  boot();
})();
