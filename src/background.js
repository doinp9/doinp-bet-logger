/* =====================================================
   Doinp Bet Logger — background (service worker / event page)
   Owns the data, all on this device (storage.local):
     sites    sportsbooks seen or configured: name, odds format, on / paused
     queue    detected bets waiting for your decision ("Revisar")
     outbox   saved bets waiting for the tracker to import them
     history  everything decided: imported / exported / discarded
     trace    detection log (what the watcher saw), newest first
     settings
   Every change goes through tx(), one at a time, so parallel
   events can't overwrite each other. Asks about new bets with a
   system notification (Save / Discard) — nothing is drawn on
   the sportsbook page. Makes no network requests.
   ===================================================== */
"use strict";
if (typeof importScripts === "function" && !globalThis.DBL_PARSE) importScripts("lib/parse.js", "i18n/en.js", "i18n/pt.js", "i18n/es.js", "i18n/ko.js", "i18n/de.js", "i18n/it.js", "i18n/zh.js", "i18n/ja.js", "i18n/fr.js", "i18n/tr.js", "i18n/pl.js", "i18n/ru.js", "i18n/nl.js");
var api = globalThis.browser || globalThis.chrome;
var IS_FIREFOX = typeof globalThis.browser !== "undefined" && !!(browser.runtime && browser.runtime.getBrowserInfo);

// detection words (src/vocab) load before the parser that compiles them
var VOCAB_LANGS = ["en", "pt", "es", "fr", "de", "it", "nl", "pl", "tr", "ru", "ko", "zh", "ja"];
var WATCH_FILES = VOCAB_LANGS.map(function (l) { return "src/vocab/" + l + ".js"; }).concat(["src/lib/parse.js", "src/lib/extract.js", "src/content/watch.js"]);
// mode "auto": watch every site (a site can be paused) · "list": only sites switched on
// exportTo: where saved bets go — "csv" (a file you import yourself, default) or "tracker" (sent automatically)
var DEFAULT_SETTINGS = { trackerUrl: "https://doinp.com.br/tools/betting-tracker", mode: "auto", exportTo: "csv", notify: true, keepUnconfirmed: true, lang: "auto" };
// never run the watcher on the tracker itself
var EXCLUDE = ["*://*.doinp.com.br/*", "*://localhost/tools/*", "*://127.0.0.1/tools/*"];
var DEDUPE_MS = 10 * 60 * 1000, HISTORY_MAX = 1000, TRACE_MAX = 100;
var KEYS = ["sites", "queue", "outbox", "history", "trace", "settings"];

/* ---------- storage, serialized ---------- */
function load() {
  return api.storage.local.get(KEYS).then(function (s) {
    var sites = s.sites || {};
    // 0.1 / 0.2 stored enabled:true|false
    Object.keys(sites).forEach(function (k) { var x = sites[k]; if (!x.state) x.state = x.enabled === false ? "paused" : "on"; delete x.enabled; });
    return { sites: sites, queue: s.queue || [], outbox: s.outbox || [], history: s.history || [], trace: s.trace || [], settings: Object.assign({}, DEFAULT_SETTINGS, s.settings || {}) };
  });
}
var chain = Promise.resolve();
// run fn(state) exclusively; fn mutates state and returns a result; state is then saved
function tx(fn) {
  var run = chain.then(function () {
    return load().then(function (st) {
      return Promise.resolve(fn(st)).then(function (res) {
        if (st.history.length > HISTORY_MAX) st.history = st.history.slice(0, HISTORY_MAX);
        if (st.trace.length > TRACE_MAX) st.trace = st.trace.slice(0, TRACE_MAX);
        var out = {}; KEYS.forEach(function (k) { out[k] = st[k]; });
        return api.storage.local.set(out).then(badge).then(function () { return res; });
      });
    });
  });
  chain = run.catch(function () {});
  return run;
}
function badge() {
  return api.storage.local.get(["queue"]).then(function (s) {
    var n = (s.queue || []).length;
    api.action.setBadgeText({ text: n ? String(n) : "" });
    api.action.setBadgeBackgroundColor({ color: "#3ad07f" });
    if (api.action.setBadgeTextColor) api.action.setBadgeTextColor({ color: "#0d0d0f" });
  });
}
function uiLang(settings) {
  var have = globalThis.DBL_I18N || {};
  if (settings.lang && settings.lang !== "auto" && have[settings.lang]) return settings.lang;
  var l = (api.i18n && api.i18n.getUILanguage ? api.i18n.getUILanguage() : "en").toLowerCase().split(/[-_]/)[0];
  return have[l] ? l : "en";
}
function uid() { return (globalThis.crypto && crypto.randomUUID) ? crypto.randomUUID() : "x" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
function byIds(list, ids) { var s = new Set(ids); return { hit: list.filter(function (x) { return s.has(x.id); }), rest: list.filter(function (x) { return !s.has(x.id); }) }; }
function archive(st, items, outcome) {
  var now = Date.now();
  items.forEach(function (it) { st.history.unshift({ id: uid(), at: now, outcome: outcome, item: it }); });
}

/* ---------- sites ---------- */
// the book for a TOP-LEVEL page host (iframes are always judged by their top page;
// extraDomains only widen where the watcher is registered in list mode)
function siteFor(sites, host) {
  if (!host) return null;
  var h = String(host).toLowerCase();
  var list = Object.keys(sites).map(function (k) { return sites[k]; });
  return list.filter(function (s) { return h === s.domain || h.endsWith("." + s.domain); })[0] || null;
}
function originsFor(site) { return DBL_PARSE.originsFor([site.domain].concat(site.extraDomains || [])); }
// is the watcher allowed to act on this (top-level page) host?
function siteActive(st, host) {
  var s = siteFor(st.sites, host);
  return st.settings.mode === "list" ? !!(s && s.state === "on") : !(s && s.state === "paused");
}
// sportsbook | exchange | prediction: what you set for the site, else known exchanges / prediction markets
function siteKind(site, host, path) { return site && site.kind && site.kind !== "auto" ? site.kind : DBL_PARSE.kindFor(host, path); }
function topHost(sender, fallback) {
  try { if (sender && sender.tab && sender.tab.url) return new URL(sender.tab.url).hostname; } catch (_) {}
  return fallback || "";
}

var syncing = Promise.resolve();
function syncRegistrations() { syncing = syncing.then(doSync, doSync); return syncing; }
function doSync() {
  return load().then(function (st) {
    return api.scripting.getRegisteredContentScripts().then(function (regs) {
      var ours = (regs || []).filter(function (r) { return r.id.indexOf("dbl-") === 0; }).map(function (r) { return r.id; });
      return (ours.length ? api.scripting.unregisterContentScripts({ ids: ours }) : Promise.resolve()).then(function () {
        var list;
        if (st.settings.mode !== "list") {
          // automatic: every http(s) page and frame; the watcher asks site-config before acting
          list = [{ id: "dbl-all", matches: ["http://*/*", "https://*/*"], excludeMatches: EXCLUDE, js: WATCH_FILES, runAt: "document_idle", allFrames: true }];
        } else {
          list = Object.keys(st.sites).map(function (k) { return st.sites[k]; }).filter(function (s) { return s.state === "on"; }).map(function (s) {
            return { id: "dbl-" + s.domain.replace(/[^a-z0-9]/gi, "_"), matches: originsFor(s), js: WATCH_FILES, runAt: "document_idle", allFrames: true };
          });
        }
        return list.length ? api.scripting.registerContentScripts(list) : null;
      });
    });
  }).catch(function (e) { console.warn("[bet-logger] sync failed", e); });
}

/* ---------- suggestions → queue items ---------- */
function toItem(b, meta, site, now) {
  var ev = b.teamA ? null : (b.event ? DBL_PARSE.splitEvent(b.event) : null);
  return {
    id: uid(), createdAt: now, status: meta.status, signal: meta.signal || meta.status,
    confidence: Math.round((b.confidence != null ? b.confidence : meta.confidence || 0.3) * 100) / 100,
    host: meta.host || "", mode: meta.mode || (b.isParlay ? "parlay" : "single"), checks: b.checks || meta.checks || {},
    bet: {
      date: b.date || meta.date || "", time: b.time || meta.time || "",
      book: site ? site.book : DBL_PARSE.bookFromHost(meta.host),
      teamA: b.teamA || (ev ? ev.teamA : b.event || ""), teamB: b.teamB || (ev ? ev.teamB : ""),
      market: b.market || (b.isParlay ? "Parlay" : ""), line: b.line || "", side: b.selection || "",
      odds: b.odds || null, stake: b.stake || null, currency: b.currency || null, result: b.result || "pending",
      returned: b.returned != null ? b.returned : null, live: !!b.live,
      isParlay: !!b.isParlay, legs: b.legs || [], notes: b.notes || "",
      // exchanges: dir back|lay, liability, commission (%) · prediction markets: dir yes|no, price (0–1), shares, fee
      kind: b.kind || "sportsbook", dir: b.dir || "", liability: b.liability != null ? b.liability : null,
      commission: b.commission != null ? b.commission : (site && site.commission != null && site.commission !== "" && b.kind === "exchange" ? +site.commission : null),
      price: b.price != null ? b.price : null, shares: b.shares != null ? b.shares : null, fee: b.fee != null ? b.fee : null
    }
  };
}
function norm(s) { return String(s || "").toLowerCase().replace(/\s+/g, " ").trim(); }
function baseHost(h) { return DBL_PARSE.baseDomain(h || ""); }
function keyOf(it, withDate) {
  var b = it.bet;
  return [baseHost(it.host), withDate ? b.date : "", b.dir || "", norm(b.side), b.odds, b.stake, b.isParlay ? b.legs.length : 0].join("|");
}
// returns the items that were added
// My Bets may show the event date instead of the day the bet was placed: match without the
// date, and among several candidates prefer the closest date
function closest(list, date) {
  if (list.length < 2 || !date) return list[0];
  var d0 = Date.parse(date);
  return list.slice().sort(function (a, b) { return Math.abs(Date.parse(a.bet.date) - d0 || 0) - Math.abs(Date.parse(b.bet.date) - d0 || 0); })[0];
}
function settle(target, it) {
  target.bet.result = it.bet.result; target.bet.returned = it.bet.returned; target.checks = it.checks;
  if (it.bet.kind === "exchange" && target.bet.commission == null && it.bet.commission != null) target.bet.commission = it.bet.commission;
}
function addItems(st, meta, bets) {
  if (meta.status === "unconfirmed" && !st.settings.keepUnconfirmed) return { added: [], updated: 0, released: 0, late: 0 };
  var site = siteFor(st.sites, meta.host), now = Date.now(), added = [], updated = 0, released = 0, late = 0;
  bets.forEach(function (b) {
    var it = toItem(b, meta, site, now);
    var hasDate = !!it.bet.date, k = keyOf(it, hasDate);
    var same = function (x) { return keyOf(x, hasDate) === k; };
    if (meta.status === "history") {
      var k0 = keyOf(it, false), loose = function (x) { return keyOf(x, false) === k0; };
      var settled = it.bet.result && it.bet.result !== "pending";
      // a bet already waiting here (Review, Pending, To export): bring its result in, never a duplicate
      var live = closest(st.queue.concat(st.outbox).filter(loose), it.bet.date);
      if (live) {
        if (settled && live.bet.result !== it.bet.result) {
          settle(live, it); updated++;
          // held until settled → now ready (CSV) or on its way to the tracker
          if (live.dest === "hold") { live.dest = st.settings.exportTo === "tracker" ? "tracker" : "pending"; live.releasedAt = now; released++; }
        }
        return;
      }
      // already exported: record the result in the log so it's visible (the tracker must be updated by hand)
      var hits = st.history.filter(function (h) { return loose(h.item); });
      if (hits.length) {
        var pick = closest(hits.map(function (h) { return h.item; }), it.bet.date);
        var h = hits.filter(function (x) { return x.item === pick; })[0];
        if (settled && h.item.bet.result !== it.bet.result) { settle(h.item, it); if (h.outcome !== "discarded") { h.late = true; late++; } }
        return;
      }
    } else {
      var recent = st.queue.concat(st.outbox).concat(st.history.map(function (h) { return h.item; }))
        .some(function (x) { return same(x) && now - x.createdAt < DEDUPE_MS; });
      if (recent) return;
    }
    st.queue.unshift(it); added.push(it);
  });
  return { added: added, updated: updated, released: released, late: late };
}

/* ---------- tracker hand-off ---------- */
function trackerPattern(url) { try { var u = new URL(url); return u.protocol + "//" + u.hostname + u.pathname.replace(/\.html$/, "") + "*"; } catch (_) { return null; } }
function trackerTabs(settings) {
  var pat = trackerPattern(settings.trackerUrl);
  return pat ? api.tabs.query({ url: pat }).catch(function () { return []; }) : Promise.resolve([]);
}
function pokeTracker(settings) {
  return trackerTabs(settings).then(function (tabs) {
    tabs.forEach(function (t) { api.tabs.sendMessage(t.id, { type: "outbox-updated" }).catch(function () {}); });
    return tabs.length;
  });
}
function openTracker() {
  return load().then(function (st) {
    return trackerTabs(st.settings).then(function (tabs) {
      if (tabs.length) {
        var t = tabs[0];
        api.tabs.update(t.id, { active: true });
        if (api.windows && t.windowId != null) api.windows.update(t.windowId, { focused: true });
        api.tabs.sendMessage(t.id, { type: "outbox-updated" }).catch(function () {});
        return { opened: false };
      }
      return api.tabs.create({ url: st.settings.trackerUrl }).then(function () { return { opened: true }; });
    });
  });
}
// lay bets and prediction-market positions go in as equivalent back bets (exact profit);
// the raw figures ride along in "raw" and in the notes
function outboxForTracker(outbox) {
  return outbox.map(function (x) {
    var b = x.bet, v = DBL_PARSE.trackerView(b);
    return {
      extId: x.id, date: b.date, time: b.time, book: b.book, sport: "", league: "",
      teamA: b.teamA, teamB: b.teamB, map: "", market: b.market, line: b.line, side: v.side,
      player: "", live: !!b.live, stake: v.stake, odds: v.odds, result: b.result || "pending",
      returned: b.returned, isParlay: !!b.isParlay, legs: b.legs || [], notes: [v.extra, b.notes].filter(Boolean).join(" | "),
      source: x.status, confidence: x.confidence,
      raw: { kind: b.kind || "sportsbook", dir: b.dir || "", odds: b.odds, stake: b.stake, liability: b.liability, commission: b.commission, price: b.price, shares: b.shares, fee: b.fee }
    };
  });
}
// force: skip the hold (an explicit "export anyway")
function saveIds(ids, dest, force) {
  return tx(function (st) {
    dest = dest || (st.settings.exportTo === "tracker" ? "tracker" : "pending");
    var r = byIds(st.queue, ids);
    // bets without a date go too: the tracker gives them the import day, and you correct it there
    var ok = r.hit, undated = ok.filter(function (x) { return !x.bet.date; }).length;
    st.queue = r.rest;
    var held = 0;
    ok.forEach(function (x) {
      x.savedAt = Date.now();
      if (!force && (!x.bet.result || x.bet.result === "pending")) { x.dest = "hold"; held++; } else x.dest = dest;
    });
    st.outbox = ok.concat(st.outbox);
    return { saved: ok.length - held, held: held, undated: undated, dest: dest, settings: st.settings };
  }).then(function (r) {
    if (r.dest !== "tracker") { delete r.settings; r.trackerOpen = false; return r; }
    return pokeTracker(r.settings).then(function (n) { r.trackerOpen = n > 0; delete r.settings; return r; });
  });
}
// saved bets (all, or the given ids) → marked for the tracker, then the tracker tab is opened / focused
function sendToTracker(ids) {
  return tx(function (st) {
    var n = 0;
    // held (pending) bets only go when named explicitly ("export anyway")
    st.outbox.forEach(function (x) { if (ids ? ids.indexOf(x.id) >= 0 : x.dest !== "hold") { x.dest = "tracker"; n++; } });
    return { sent: n };
  }).then(function (r) { return openTracker().then(function (o) { r.opened = o.opened; return r; }); });
}

/* ---------- notifications: ask at placement time ---------- */
var NOTE = "dbl:";
function fmtMoney(v, cur, lang) {
  if (v == null) return "?";
  var sym = cur === "BRL" ? "R$ " : cur === "EUR" ? "€" : cur === "GBP" ? "£" : cur === "USD" ? "$" : "";
  if (!sym && cur) try { return Number(v).toLocaleString(LOCALES[lang] || lang, { style: "currency", currency: cur }); } catch (_) {}
  return sym + Number(v).toLocaleString(LOCALES[lang] || lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function nt(lang, key, vars) {
  var L = globalThis.DBL_I18N || {}, v = (L[lang] && L[lang][key]) || (L.en && L.en[key]) || key;
  Object.keys(vars || {}).forEach(function (k) { v = v.split("{" + k + "}").join(vars[k]); });
  return v;
}
var LOCALES = { pt: "pt-BR", en: "en-US", es: "es-ES", ko: "ko-KR", de: "de-DE", it: "it-IT", zh: "zh-CN", ja: "ja-JP", fr: "fr-FR", tr: "tr-TR", pl: "pl-PL", ru: "ru-RU", nl: "nl-NL" };
function notifyNew(items, settings) {
  if (!settings.notify || !api.notifications || !items.length) return Promise.resolve();
  var lang = uiLang(settings);
  var b = items[0].bet;
  var title = (items.length === 1 ? nt(lang, "n.one") : nt(lang, "n.many", { n: items.length })) + " \u00b7 " + b.book;
  var lines = items.slice(0, 3).map(function (x) {
    var y = x.bet, what = y.isParlay ? nt(lang, "b.parlay") + " " + y.legs.length + " " + nt(lang, "b.legs") : (y.side || y.market || "?");
    if (y.kind === "prediction") return what + " @ " + (y.price != null ? Math.round(y.price * 1000) / 10 + "\u00a2" : "?") + " \u00b7 " + fmtMoney(y.stake, y.currency, lang);
    if (y.kind === "exchange") return nt(lang, "x." + (y.dir || "back")) + " \u00b7 " + what + " @ " + (y.odds || "?") + " \u00b7 " + fmtMoney(y.stake, y.currency, lang) + (y.dir === "lay" && y.liability != null ? " (" + nt(lang, "x.liab") + " " + fmtMoney(y.liability, y.currency, lang) + ")" : "");
    return what + " @ " + (y.odds || "?") + " \u00b7 " + fmtMoney(y.stake, y.currency, lang);
  });
  var opts = {
    type: "basic", iconUrl: api.runtime.getURL("icons/logo.png"), title: title,
    message: lines.join("\n"),
    contextMessage: nt(lang, settings.exportTo === "tracker" ? "n.q.tracker" : "n.q.csv"),
    priority: 2
  };
  if (!IS_FIREFOX) {
    opts.buttons = [{ title: nt(lang, "n.save") }, { title: nt(lang, "n.discard") }];
    opts.requireInteraction = true;
  } else {
    opts.message += "\n" + nt(lang, "n.click");
  }
  var id = NOTE + items.map(function (x) { return x.id; }).join("~");
  return Promise.resolve(api.notifications.create(id, opts)).catch(function (e) { console.warn("[bet-logger] notification failed", e); });
}
function idsFromNote(nid) { return nid.indexOf(NOTE) === 0 ? nid.slice(NOTE.length).split("~") : null; }
function onNoteButton(nid, idx) {
  var ids = idsFromNote(nid);
  if (!ids) return Promise.resolve();
  api.notifications.clear(nid);
  return idx === 0 ? saveIds(ids) : HANDLERS.discard({ ids: ids });
}
function onNoteClick(nid) {
  if (!idsFromNote(nid)) return Promise.resolve();
  api.notifications.clear(nid);
  return openFull("review");
}
if (api.notifications) {
  if (api.notifications.onButtonClicked) api.notifications.onButtonClicked.addListener(onNoteButton);
  api.notifications.onClicked.addListener(onNoteClick);
}

function openFull(tab) {
  var base = api.runtime.getURL("src/popup/popup.html");
  return api.tabs.query({ url: base + "*" }).catch(function () { return []; }).then(function (tabs) {
    var url = base + "?view=full#" + (tab || "review");
    if (tabs.length) {
      api.tabs.update(tabs[0].id, { active: true, url: url });
      if (api.windows && tabs[0].windowId != null) api.windows.update(tabs[0].windowId, { focused: true });
      return { ok: true };
    }
    return api.tabs.create({ url: url }).then(function () { return { ok: true }; });
  });
}

/* ---------- messages ---------- */
api.runtime.onMessage.addListener(function (m, sender, reply) {
  var h = HANDLERS[m && m.type];
  if (!h) return false;
  Promise.resolve().then(function () { return h(m, sender); }).then(reply, function (e) { reply({ error: String(e && e.message || e) }); });
  return true;
});

var HANDLERS = {
  "site-config": function (m, sender) {
    // iframes follow the top page: a book embedded from a provider domain is judged by the book's own address
    var host = topHost(sender, m.host);
    var path = m.path || "";
    try { if (sender && sender.tab && sender.tab.url) path = new URL(sender.tab.url).pathname; } catch (_) {}
    return load().then(function (st) {
      var s = siteFor(st.sites, host);
      return { fmt: s ? s.fmt || "auto" : "auto", active: siteActive(st, host), kind: siteKind(s, host, path), commission: s && s.commission != null && s.commission !== "" ? +s.commission : null, learned: (s && s.placeLabels) || [] };
    });
  },
  // a button pressed in a slip and followed by a confirmation becomes this site's place-bet label
  "learn-place": function (m, sender) {
    var host = topHost(sender, m.host), label = DBL_PARSE.norm(m.label || "");
    if (!label || label.length > 48) return { ok: false };
    return tx(function (st) {
      var s = siteFor(st.sites, host);
      if (!s) { var d = DBL_PARSE.baseDomain(host); s = st.sites[d] = { domain: d, book: DBL_PARSE.bookFromHost(host), extraDomains: [], fmt: "auto", state: "on", since: Date.now(), auto: true }; }
      s.placeLabels = (s.placeLabels || []).filter(function (x) { return x !== label; }).concat([label]).slice(-10);
      return { ok: true, learned: s.placeLabels };
    });
  },
  "trace": function (m, sender) {
    var ev = m.ev || {};
    try { if (sender && sender.tab && sender.tab.url) ev.page = new URL(sender.tab.url).hostname; } catch (_) {}
    return tx(function (st) { st.trace.unshift(ev); return { ok: true }; });
  },
  "suggest": function (m, sender) {
    // the top-level page decides the book (the slip may live in a provider's iframe)
    var host = topHost(sender, m.host);
    var meta = Object.assign({}, m, { host: host });
    return tx(function (st) {
      if (!siteActive(st, host)) return { added: [], settings: st.settings };
      // automatic mode: remember a book the first time a bet is seen on it
      if (!siteFor(st.sites, host)) {
        var d = DBL_PARSE.baseDomain(host);
        st.sites[d] = { domain: d, book: DBL_PARSE.bookFromHost(host), extraDomains: [], fmt: "auto", state: "on", since: Date.now(), auto: true };
      }
      var r = addItems(st, meta, m.bets || []);
      st.trace.unshift({ t: Date.now(), host: host, step: "queued", detail: r.added.length + " new" + (r.added.length < (m.bets || []).length ? ", " + ((m.bets || []).length - r.added.length) + " duplicate(s) ignored" : "") });
      return { added: r.added, settings: st.settings };
    }).then(function (r) {
      var ask = r.added.filter(function (x) { return x.status === "placed"; });
      return notifyNew(ask, r.settings).then(function () { return { added: r.added.length }; });
    });
  },
  "add-items": function (m) {
    var p = m.payload || {};
    return tx(function (st) {
      if (p.rows) {
        var added = 0, updated = 0, released = 0, late = 0;
        p.rows.forEach(function (r) {
          var x = addItems(st, { status: "history", signal: "history", host: m.host || p.host, confidence: r.confidence, checks: r.checks }, [Object.assign({ confidence: r.confidence, checks: r.checks }, r.bet)]);
          added += x.added.length; updated += x.updated; released += x.released; late += x.late;
        });
        return { added: added, updated: updated, released: released, late: late, found: p.rows.length, settings: st.settings };
      }
      var y = addItems(st, Object.assign({}, p, { host: m.host || p.host }), p.bets || []);
      return { added: y.added.length, found: (p.bets || []).length };
    }).then(function (r) {
      // settled bets released to the tracker: hand them over if the tracker is open
      var s = r.settings; delete r.settings;
      return r.released && s && s.exportTo === "tracker" ? pokeTracker(s).then(function () { return r; }) : r;
    });
  },
  "get-state": function () { return load().then(function (st) { st.uiLang = uiLang(st.settings); st.isFirefox = IS_FIREFOX; return st; }); },
  "update-item": function (m) {
    return tx(function (st) {
      st.queue.forEach(function (x) { if (x.id === m.id) { x.bet = Object.assign({}, x.bet, m.bet || {}); if (m.checks) x.checks = m.checks; } });
      return { ok: true };
    });
  },
  "save": function (m) { return saveIds(m.ids || [], m.dest === "tracker" || m.dest === "pending" ? m.dest : null, !!m.force); },
  "discard": function (m) {
    return tx(function (st) { var r = byIds(st.queue, m.ids || []); st.queue = r.rest; archive(st, r.hit, "discarded"); return { discarded: r.hit.length }; });
  },
  "exported": function (m) {
    return tx(function (st) { var r = byIds(st.queue, m.ids || []); st.queue = r.rest; archive(st, r.hit, "exported"); return { ok: true }; });
  },
  "outbox-exported": function (m) {
    return tx(function (st) { var r = byIds(st.outbox, m.ids || []); st.outbox = r.rest; archive(st, r.hit, "exported"); return { ok: true }; });
  },
  "unsave": function (m) {
    return tx(function (st) { var r = byIds(st.outbox, m.ids || []); st.outbox = r.rest; st.queue = r.hit.concat(st.queue); return { ok: true }; });
  },
  "restore": function (m) {
    return tx(function (st) {
      var r = byIds(st.history, m.ids || []);
      st.history = r.rest;
      st.queue = r.hit.map(function (h) { return h.item; }).concat(st.queue);
      return { restored: r.hit.length };
    });
  },
  "delete-history": function (m) { return tx(function (st) { st.history = byIds(st.history, m.ids || []).rest; return { ok: true }; }); },
  "clear-history": function () { return tx(function (st) { st.history = []; return { ok: true }; }); },
  "clear-trace": function () { return tx(function (st) { st.trace = []; return { ok: true }; }); },
  "clear-all": function () { return tx(function (st) { st.queue = []; st.outbox = []; st.history = []; st.trace = []; return { ok: true }; }); },
  "reset-all": function () {
    var origins = [];
    return tx(function (st) {
      st.sites = {}; st.queue = []; st.outbox = []; st.history = []; st.trace = []; st.settings = Object.assign({}, DEFAULT_SETTINGS);
      return { ok: true };
    }).then(syncRegistrations).then(function () { return { ok: true }; });
  },
  "open-tracker": function () { return openTracker(); },
  "send-to-tracker": function (m) { return sendToTracker(m.ids || null); },
  "open-full": function (m) { return openFull(m.tab); },
  // only bets meant for the tracker; bets waiting for a CSV export stay out of it
  "bridge-get-outbox": function () { return load().then(function (st) { return { bets: outboxForTracker(st.outbox.filter(function (x) { return x.dest === "tracker"; })) }; }); },
  "bridge-done": function (m) {
    return tx(function (st) {
      var r = byIds(st.outbox, m.ids || []);
      st.outbox = r.rest;
      archive(st, r.hit, m.how === "imported" ? "imported" : "discarded");
      return { ok: true };
    });
  },
  "enable-site": function (m) {
    return tx(function (st) {
      st.sites[m.domain] = { domain: m.domain, book: m.book || m.domain, extraDomains: m.extraDomains || [], fmt: m.fmt || "auto", state: "on", since: Date.now() };
      return { ok: true };
    }).then(syncRegistrations).then(function () { return { ok: true }; });
  },
  "update-site": function (m) {
    return tx(function (st) {
      if (st.sites[m.domain]) st.sites[m.domain] = Object.assign({}, st.sites[m.domain], m.patch || {});
      return { ok: true };
    });
  },
  // create-or-update, used by the popup's Pausar / Retomar / Ativar and the Sites list
  "set-site": function (m) {
    return tx(function (st) {
      var cur = st.sites[m.domain] || { domain: m.domain, book: DBL_PARSE.bookFromHost(m.domain), extraDomains: [], fmt: "auto", state: "on", since: Date.now() };
      st.sites[m.domain] = Object.assign({}, cur, m.patch || {});
      return { ok: true };
    }).then(syncRegistrations).then(function () { return { ok: true }; });
  },
  "disable-site": function (m) {
    return tx(function (st) { delete st.sites[m.domain]; return { ok: true }; })
      .then(syncRegistrations).then(function () { return { ok: true }; });
  },
  "save-settings": function (m) {
    return tx(function (st) { st.settings = Object.assign({}, st.settings, m.settings || {}); return { ok: true }; })
      .then(function (r) { return m.settings && "mode" in m.settings ? syncRegistrations().then(function () { return r; }) : r; });
  }
};
// exposed for the end-to-end test (the notification buttons can't be clicked from a test)
globalThis.__dblTest = { onNoteButton: onNoteButton, onNoteClick: onNoteClick, injectOpenTabs: injectOpenTabs };

/* ---------- lifecycle ---------- */
// Chrome doesn't put content scripts into tabs that were already open when the extension was
// installed or updated: without this, a sportsbook tab left open during an update detects
// nothing until it is reloaded.
function injectOpenTabs() {
  return load().then(function (st) {
    return api.tabs.query({ url: ["http://*/*", "https://*/*"] }).then(function (tabs) {
      return Promise.all(tabs.map(function (t) {
        var host = ""; try { host = new URL(t.url).hostname; } catch (_) {}
        if (!host || /(^|\.)doinp\.com\.br$/.test(host) || !siteActive(st, host)) return null;
        return api.scripting.executeScript({ target: { tabId: t.id, allFrames: true }, files: WATCH_FILES }).catch(function () {});
      }));
    });
  }).catch(function (e) { console.warn("[bet-logger] inject into open tabs failed", e); });
}
api.runtime.onInstalled.addListener(function () { syncRegistrations().then(injectOpenTabs); badge(); });
api.runtime.onStartup.addListener(function () { syncRegistrations(); badge(); });
if (api.permissions && api.permissions.onRemoved) api.permissions.onRemoved.addListener(function () { syncRegistrations(); });
if (api.permissions && api.permissions.onAdded) api.permissions.onAdded.addListener(function () { syncRegistrations(); });
