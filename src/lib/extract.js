/* =====================================================
   Doinp Bet Logger — DOM extraction (read-only)
   Finds the bet slip, splits it into selection cards,
   reads odds / stake / potential return, recognises
   receipts, and scans bet-history pages. Site-agnostic:
   it relies on how every book renders a slip (a price in
   its own element, a stake input, a place button), not on
   any one site's markup. Never clicks, types or requests.
   Exposes globalThis.DBL_EXTRACT.
   ===================================================== */
(function (root) {
  "use strict";
  var P = root.DBL_PARSE;

  var SKIP_TAGS = { SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, TEMPLATE: 1, SVG: 1, INPUT: 1, TEXTAREA: 1, SELECT: 1, OPTION: 1 };

  function visible(el) {
    if (!el || el.nodeType !== 1 || !el.getClientRects) return false;
    if (!el.getClientRects().length) return false;
    var cs = root.getComputedStyle ? root.getComputedStyle(el) : null;
    return !cs || (cs.visibility !== "hidden" && cs.display !== "none");
  }
  function textOf(el) { return el ? (el.innerText != null ? el.innerText : el.textContent || "") : ""; }
  // "pt": decimal comma (also es, fr, de, it, nl, pl, tr, ru) · "en": decimal point (also zh, ja, ko)
  function pageLang() { return (document.documentElement.getAttribute("lang") || navigator.language || "").toLowerCase(); }
  function pageLocale() {
    var l = pageLang().split(/[-_]/)[0];
    return /^(pt|es|fr|de|it|nl|pl|tr|ru)$/.test(l) ? "pt" : /^(en|zh|ja|ko)$/.test(l) ? "en" : null;
  }
  // "¥" is yen on Japanese pages and yuan on Chinese ones
  function fixCur(cur) { return cur === "JPY" && pageLang().indexOf("zh") === 0 ? "CNY" : cur; }
  function monthFirst() {
    var l = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    return l === "en-us";
  }

  /* ---------- price elements: an element whose own text is exactly one odds token ---------- */
  function oddsNodes(scope, fmt) {
    var out = [], seen = new Set();
    if (!scope) return out;
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentElement;
        if (!p || SKIP_TAGS[p.tagName.toUpperCase()]) return NodeFilter.FILTER_REJECT;
        return n.nodeValue && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
      }
    });
    var n;
    while ((n = walker.nextNode())) {
      var el = n.parentElement;
      if (seen.has(el)) continue;
      // the price may be split over sibling text nodes of one element ("2" "," "10")
      var own = Array.prototype.filter.call(el.childNodes, function (c) { return c.nodeType === 3; }).map(function (c) { return c.nodeValue; }).join("");
      var v = P.exactOdds(own, fmt);
      if (v == null) v = P.exactOdds(n.nodeValue, fmt);
      if (v == null) continue;
      if (!visible(el)) continue;
      if (isMoney(el)) continue;
      seen.add(el);
      out.push({ el: el, value: v });
    }
    return out;
  }
  // "R$" and "1.66" drawn as separate elements, or a number under a Stake / Return label,
  // is an amount. Without this, "To Return R$1.66" becomes a phantom second selection.
  var CUR_END = new RegExp("(" + P.CUR_SRC + ")\\s*$", "i");
  var CUR_START = new RegExp("^\\s*(" + P.CUR_SRC + ")", "i");
  function sibText(node, dir) {
    var x = dir < 0 ? node.previousSibling : node.nextSibling;
    while (x && x.nodeType === 3 && !x.nodeValue.trim()) x = dir < 0 ? x.previousSibling : x.nextSibling;
    return x ? (x.nodeType === 3 ? x.nodeValue : textOf(x)) : null;
  }
  function isMoney(el) {
    var node = el;
    for (var d = 0; d < 3 && node; d++) {
      var before = sibText(node, -1);
      if (before != null) { if (CUR_END.test(before)) return true; break; }
      node = node.parentElement; // first child: the sign may sit before its parent
    }
    var after = sibText(el, 1);
    if (after != null && CUR_START.test(after) && /^\s*\S{1,3}\s*$/.test(after)) return true;
    var p = el.parentElement;
    for (var k = 0; k < 2 && p; k++, p = p.parentElement) {
      var t = textOf(p);
      if (t.length > 60) break;
      var n = P.norm(t), m = n.match(P.V.returnLabel);
      if (P.V.stakeLabel.test(n) || (m && m.index <= 2)) return true;
    }
    return false;
  }
  function countIn(el, nodes) { var c = 0; for (var i = 0; i < nodes.length; i++) if (el.contains(nodes[i].el)) c++; return c; }

  /* ---------- stake inputs ---------- */
  function amountInputs(scope, locale) {
    var out = [];
    if (!scope) return out;
    scope.querySelectorAll("input").forEach(function (inp) {
      var ty = (inp.getAttribute("type") || "text").toLowerCase();
      if (["text", "number", "tel", "decimal", "search", ""].indexOf(ty) < 0) return;
      if (!visible(inp)) return;
      var v = P.parseAmount(inp.value, locale);
      out.push({ el: inp, value: v != null && v > 0 ? v : null });
    });
    return out;
  }

  /* ---------- the slip ---------- */
  function buttonLike(el) {
    return el && el.closest ? el.closest('button,[role="button"],input[type="submit"],input[type="button"],a') : null;
  }
  function buttonText(btn) {
    return (btn.innerText || btn.value || btn.getAttribute("aria-label") || btn.getAttribute("title") || "").trim();
  }
  function isPlaceButton(btn, kind) { return !!btn && P.isPlaceButton(buttonText(btn), kind); }
  // Climb from whatever was clicked to the element whose own short label says "place bet".
  // Works for <button>, role=button and plain <div>/<span> controls.
  // learned: this site's own place-bet labels, learned from a press followed by a confirmation
  function placeTarget(el, kind, learned) {
    for (var i = 0; el && el.nodeType === 1 && i < 7; i++, el = el.parentElement) {
      var label = el.getAttribute("aria-label") || el.getAttribute("title") || el.value || textOf(el);
      label = String(label || "").trim();
      if (label.length > 90) return null; // reached a container: stop
      if (label && (P.isPlaceButton(label, kind) || (learned && learned.indexOf(P.norm(label)) >= 0))) return el;
    }
    return null;
  }
  // prices in a region: printed prices, plus exchange price inputs / prediction ¢ prices
  function priceCount(el, fmt, kind) {
    return kind === "exchange" ? oddsNodes(el, fmt).length + exchangeRows(el).length
      : kind === "prediction" ? centsNodes(el).length
      : oddsNodes(el, fmt).length;
  }

  // From the place button, climb to the largest ancestor that still contains the SAME
  // number of prices as the first ancestor that contained any. That region is the slip:
  // one level further up would pull in the page's odds grid.
  function slipFromElement(start, fmt, kind) {
    var el = start, first = null, best = null;
    for (var i = 0; el && el !== document.documentElement && i < 30; i++, el = el.parentElement) {
      var n = priceCount(el, fmt, kind);
      if (!first) { if (n > 0) { first = n; best = el; } }
      else if (n > first) break;
      else best = el;
      if (el === document.body) break;
    }
    return best;
  }

  // Passive detection (popup "capture now", snapshots): containers whose class / id /
  // data-* / aria-label say "slip" and that hold at least one price and one input.
  function slipAuto(fmt, kind) {
    if (kind === "exchange" || kind === "prediction") {
      // exchange / prediction tickets: start from the visible order button
      var btn = findText(function (t) { return P.isPlaceButton(t, kind); });
      var tg = btn && placeTarget(btn, kind);
      var reg = tg && slipFromElement(tg, fmt, kind);
      if (reg) return reg;
      if (kind === "prediction") return null;
    }
    var cands = [];
    var all = document.querySelectorAll("[class],[id],[data-testid],[data-test],[aria-label]");
    for (var i = 0; i < all.length; i++) {
      var el = all[i];
      var sig = [el.id, typeof el.className === "string" ? el.className : "", el.getAttribute("data-testid"), el.getAttribute("data-test"), el.getAttribute("aria-label")].join(" ");
      if (!P.V.slipAttr.test(sig) || !visible(el)) continue;
      var n = oddsNodes(el, fmt).length;
      if (!n) continue;
      if (!el.querySelector("input")) continue;
      cands.push({ el: el, n: n, len: textOf(el).length });
    }
    if (!cands.length) {
      // no named container: fall back to the region around a visible place button
      var hit = findText(function (t) { return P.isPlaceButton(t); });
      var pt = hit && placeTarget(hit);
      if (pt) { var s = slipFromElement(pt, fmt); if (s) return s; }
      // after placement: the receipt ("Bet Placed", "Aposta realizada") holds the bet
      var rc = findText(function (t) { return P.V.receipt.test(P.norm(t)); });
      var reg = rc && receiptRegion(rc, fmt);
      return reg && oddsNodes(reg, fmt).length ? reg : null;
    }
    cands.sort(function (a, b) { return b.n - a.n || a.len - b.len; });
    return cands[0].el;
  }

  // first visible text node whose (short) text passes the test → its element
  function findText(test) {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      var t = n.nodeValue.trim();
      if (!t || t.length > 60 || !n.parentElement || SKIP_TAGS[n.parentElement.tagName.toUpperCase()]) continue;
      if (test(t) && visible(n.parentElement)) return n.parentElement;
    }
    return null;
  }

  /* ---------- label → value ("Retorno potencial R$ 21,00", "Odds totais 5.40") ---------- */
  function labelValue(scope, re, kind, locale, fmt) {
    var els = scope.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (SKIP_TAGS[el.tagName.toUpperCase()]) continue;
      var t = textOf(el);
      if (!t || t.length > 80) continue;
      var nt = P.norm(t);
      var m = nt.match(re);
      if (!m || m.index > 2) continue;
      var pools = [t.slice(Math.min(t.length, m[0].length)), el.nextElementSibling ? textOf(el.nextElementSibling) : "", el.parentElement && textOf(el.parentElement).length < 100 ? textOf(el.parentElement) : ""];
      for (var k = 0; k < pools.length; k++) {
        if (!pools[k]) continue;
        if (kind === "odds") { var o = P.oddsInText(pools[k], fmt); if (o.length) return o[0].value; }
        else { var a = P.findAmounts(pools[k], locale); if (a.length) return a[0].value; var bare = pools[k].match(/^\s*:?\s*(\d[\d.,]*)/); if (bare) { var v = P.parseNumber(bare[1], "amount", locale); if (v != null) return v; } }
      }
    }
    return null;
  }

  /* ---------- selection cards ---------- */
  function cardsFor(scope, nodes) {
    var cards = [], used = new Set();
    nodes.forEach(function (o) {
      var card = o.el;
      while (card.parentElement && card.parentElement !== scope && countIn(card.parentElement, nodes) === 1) card = card.parentElement;
      if (used.has(card)) return;
      used.add(card);
      cards.push({ el: card, odds: o.value, oddsEl: o.el });
    });
    return cards;
  }

  var TYPE_LABEL = /^(simples|multipla|single|singles|parlay|acumulada|combinada|dupla|tripla|treble|double|accumulator|acca|sistema|system)$/;
  var DATE_LINE = /^(\d{1,2}[\/.]\d{1,2}([\/.]\d{2,4})?|\d{4}-\d{2}-\d{2}|hoje|ontem|today|yesterday)(,?\s+(as\s+)?\d{1,2}[:h]\d{2})?$/;
  // drop a price that shares a line with the selection ("Flamengo 2,10", "Arsenal @ 1.95")
  // ("Profit: £15.00" is an amount, not a price: a number right after a currency sign stays)
  function stripPrice(l) {
    var s = l.replace(/\s*@?\s*[+\-\u2212]?\d{1,3}[.,]\d{2,3}$/, "").replace(/\s*@\s*$/, "").trim();
    return s !== l && CUR_END.test(s) ? l : s;
  }
  // lines.priced: the lines that ended in a price (the selection's own row)
  function linesOf(el, dropText) {
    var drops = (dropText || []).map(P.clean).filter(Boolean), priced = [];
    var out = textOf(el).split(/\n+/).map(P.clean).map(function (l) {
      // inline labels can run into other text ("SimplesGanhou"): cut them out of the line
      drops.forEach(function (d) { if (l !== d && l.indexOf(d) >= 0) l = P.clean(l.split(d).join(" ")); });
      if (P.exactOdds(l) != null) return { l: l };
      var t = P.stripTags(l), s = stripPrice(t);
      return { l: s, priced: s !== t };
    }).filter(function (o) {
      var l = o.l;
      if (!l) return false;
      if (drops.indexOf(l) >= 0) return false;
      if (P.isNoiseLine(l)) return false;
      var n = P.norm(l);
      if (P.V.noise.test(n) || TYPE_LABEL.test(n) || P.V.types.test(n) || DATE_LINE.test(n) || P.isDateLine(l) || P.statusOf(l)) return false;
      if (P.exchangeSide(l) || P.liabilityLabel(l)) return false; // exchange side / liability labels are not selections
      if (P.exactOdds(l) != null) return false;
      if (P.findAmounts(l).length && l.length < 24) return false;
      if (P.V.stakeLabel.test(n) || P.V.returnLabel.test(n) && l.length < 30) return false;
      return true;
    });
    var lines = out.map(function (o, i) { if (o.priced) priced.push(i); return o.l; });
    lines.priced = priced;
    return lines;
  }

  // turn one card's text lines into event / market / selection
  // text drawn on the same visual row as the price, to its left ("Grorud 0.0,+0.5  1.925")
  function sameRowText(priceEl, cardEl) {
    if (!priceEl || !cardEl || !document.createRange) return "";
    var pr = priceEl.getBoundingClientRect();
    if (!pr.height) return "";
    var parts = [], w = document.createTreeWalker(cardEl, NodeFilter.SHOW_TEXT, null), n, rg = document.createRange();
    while ((n = w.nextNode())) {
      if (!n.nodeValue.trim() || priceEl.contains(n)) continue;
      var pe = n.parentElement;
      if (!pe || SKIP_TAGS[pe.tagName.toUpperCase()]) continue;
      rg.selectNodeContents(n);
      var r = rg.getBoundingClientRect();
      if (!r.height || r.bottom <= pr.top + 2 || r.top >= pr.bottom - 2 || r.left >= pr.left - 1) continue;
      parts.push({ x: r.left, t: n.nodeValue.trim() });
    }
    parts.sort(function (a, b) { return a.x - b.x; });
    var t = P.stripTags(stripPrice(parts.map(function (p) { return p.t; }).join(" ")));
    return t && !P.isNoiseLine(t) && !P.findAmounts(t).length && t.length <= 80 ? t : "";
  }
  function describe(lines, priceEl, cardEl) {
    var out = { event: "", teamA: "", teamB: "", market: "", selection: "", line: "", live: false };
    var rest = [];
    var rowSel = sameRowText(priceEl, cardEl);
    if (rowSel && !P.splitEvent(rowSel)) {
      out.selection = rowSel;
      // the selection may also be a team line: drop the copy that carried the price, else the first
      var hits = lines.map(function (l, i) { return l === rowSel ? i : -1; }).filter(function (i) { return i >= 0; });
      var at = hits.filter(function (i) { return (lines.priced || []).indexOf(i) >= 0; })[0];
      if (at == null) at = hits.length ? hits[0] : -1;
      if (at >= 0) lines = lines.slice(0, at).concat(lines.slice(at + 1));
    }
    lines.forEach(function (l) {
      var n = P.norm(l);
      if (P.V.live.test(n) && l.length < 16) { out.live = true; return; }
      var le = l.replace(/\s*[\u00b7\u2022|\-]?\s*(ao vivo|live|in-play|em jogo)\s*$/i, "");
      if (le !== l) out.live = true;
      if (!out.event && P.splitEvent(le)) { out.event = le; var sp = P.splitEvent(le); out.teamA = sp.teamA; out.teamB = sp.teamB; return; }
      rest.push(l);
    });
    if (lines.some(function (l) { return P.V.live.test(P.norm(l)); })) out.live = true;
    // market line: matches the market vocabulary; when several do, the one without a
    // number wins ("Total Goals" is the market, "Over 2.5 Goals" the selection)
    var mi = -1, cand = [];
    for (var i = 0; i < rest.length; i++) if (P.V.market.test(P.norm(rest[i])) && rest[i].length < 60) cand.push(i);
    if (cand.length) { var noDigit = cand.filter(function (k) { return !/\d/.test(rest[k]); }); mi = (noDigit.length ? noDigit : cand)[0]; }
    if (mi >= 0) {
      out.market = rest[mi];
      rest.splice(mi, 1);
      // "Mais de 2.5" can itself look like a market line; keep it as the selection if nothing else is left
      if (!rest.length && !out.selection) { out.selection = out.market; out.market = ""; }
    }
    if (!out.selection) out.selection = rest.shift() || "";
    if (!out.market && rest.length) {
      var mk = rest.filter(function (l) { return !/\d/.test(l); })[0];
      // two plain name lines left and no market vocabulary: those are the teams, not a market
      if (mk && rest.filter(function (l) { return !/\d/.test(l); }).length < 2) { out.market = mk; rest.splice(rest.indexOf(mk), 1); }
    }
    if (!out.event) {
      var names = rest.filter(function (l, i, a) { return !/\d/.test(l) && l.length <= 40 && !P.V.market.test(P.norm(l)) && a.indexOf(l) === i; });
      if (names.length >= 2) { out.teamA = names[0]; out.teamB = names[1]; out.event = names[0] + " x " + names[1]; }
      else if (rest.length) out.event = rest.shift();
    }
    out.line = P.lineOf(out.selection);
    return out;
  }

  /* ---------- read a slip ---------- */
  // returns { mode, bets:[...], stake, potentialReturn, totalOdds, checks, confidence }
  function extractSlip(slip, opts) {
    opts = opts || {};
    var fmt = opts.fmt || "auto";
    var locale = opts.locale || pageLocale();
    if (!slip) return null;
    if (opts.kind === "prediction") return extractPrediction(slip, opts);
    if (opts.kind === "exchange") { var ex = extractExchange(slip, opts); if (ex) return ex; }
    var nodes = oddsNodes(slip, fmt);
    if (!nodes.length) return null;
    var cards = cardsFor(slip, nodes);
    var inputs = amountInputs(slip, locale);
    var inCard = function (inp) { for (var i = 0; i < cards.length; i++) if (cards[i].el.contains(inp.el)) return cards[i]; return null; };
    cards.forEach(function (c) { c.input = null; });
    var slipInputs = [];
    inputs.forEach(function (inp) { var c = inCard(inp); if (c) { if (!c.input) c.input = inp; } else slipInputs.push(inp); });

    var stakeLabel = labelValue(slip, P.V.stakeLabel, "amount", locale, fmt);
    var ret = labelValue(slip, P.V.returnLabel, "amount", locale, fmt);
    var totalOdds = labelValue(slip, P.V.totalOddsLabel, "odds", locale, fmt);
    var slipStake = (slipInputs.filter(function (x) { return x.value; })[0] || {}).value || stakeLabel || null;

    // the "total odds" price is not a selection
    if (totalOdds != null && cards.length > 1) {
      cards = cards.filter(function (c) {
        var lab = P.norm(textOf(c.el));
        return !(P.V.totalOddsLabel.test(lab) && Math.abs(c.odds - totalOdds) < 0.001);
      });
    }

    var sels = cards.map(function (c) {
      var d = describe(linesOf(c.el), c.oddsEl, c.el);
      d.odds = c.odds;
      d.stake = c.input && c.input.value ? c.input.value : null;
      return d;
    });

    var mode, bets = [], checks = { returnMatch: null };
    var oddsList = sels.map(function (s) { return s.odds; });
    var prod = P.r3(P.product(oddsList));
    if (sels.length === 1) {
      mode = "single";
      var s0 = sels[0];
      var st = s0.stake || slipStake;
      bets.push(betFrom(s0, st));
      if (ret != null && st) {
        // some books show the winnings ("Win", "Ganho": stake × (odds − 1)) instead of the return
        var profitOnly = !P.near(ret, st * s0.odds) && P.near(ret, st * (s0.odds - 1));
        var retTotal = profitOnly ? P.r2(ret + st) : ret;
        checks.returnMatch = P.near(retTotal, st * s0.odds); checks.basis = "potential"; checks.ret = retTotal; checks.expected = P.r3(st * s0.odds);
      }
    } else {
      var perCard = sels.filter(function (s) { return s.stake; }).length;
      var sumSingles = sels.reduce(function (a, s) { return a + (s.stake || slipStake || 0) * s.odds; }, 0);
      var parlayOdds = totalOdds || prod;
      var parlayByReturn = ret != null && slipStake && P.near(ret, slipStake * parlayOdds, 0.03);
      var singlesByReturn = ret != null && P.near(ret, sumSingles, 0.03);
      if (perCard === sels.length || (singlesByReturn && !parlayByReturn)) {
        mode = "singles";
        sels.forEach(function (s) { bets.push(betFrom(s, s.stake || slipStake)); });
        if (ret != null) { checks.returnMatch = singlesByReturn; checks.basis = "potential"; checks.ret = ret; checks.expected = P.r3(sumSingles); }
      } else {
        mode = "parlay";
        bets.push({
          teamA: "", teamB: "", event: "", market: "", selection: sels.map(function (s) { return s.selection; }).join(" + "),
          line: "", live: sels.some(function (s) { return s.live; }), odds: P.r3(parlayOdds), stake: slipStake, isParlay: true,
          legs: sels.map(function (s) { return { event: s.event, market: s.market, sel: s.selection, odds: s.odds }; })
        });
        if (ret != null && slipStake) { checks.returnMatch = !!parlayByReturn; checks.basis = "potential"; checks.ret = ret; checks.expected = P.r3(slipStake * parlayOdds); }
        if (totalOdds != null) checks.totalOddsMatch = P.near(totalOdds, prod, 0.02);
      }
    }
    var conf = 0.35;
    if (bets.every(function (b) { return b.stake; })) conf += 0.2;
    if (bets.every(function (b) { return b.selection; })) conf += 0.1;
    if (sels.every(function (s) { return s.event; })) conf += 0.1;
    if (checks.returnMatch === true) conf += 0.25;
    if (checks.returnMatch === false) conf -= 0.1;
    var cur = fixCur((P.findAmounts(textOf(slip), locale)[0] || {}).currency || null);
    bets.forEach(function (b) { b.currency = cur; });
    return { mode: mode, bets: bets, stake: slipStake, potentialReturn: ret, totalOdds: totalOdds, checks: checks, currency: cur, confidence: Math.max(0.05, Math.min(1, conf)) };
  }
  function betFrom(s, stake) {
    return { teamA: s.teamA, teamB: s.teamB, event: s.event, market: s.market, selection: s.selection, line: s.line, live: s.live, odds: s.odds, stake: stake || null, isParlay: false, legs: [] };
  }

  /* ---------- exchanges (Betfair-style): prices are editable inputs, each bet is Back or Lay ---------- */
  var ODDS_HINT = /odd|price|pre[cç]o|cota|quota|kurs|cote|coef|oran|赔率|オッズ|배당/i;
  var STAKE_HINT = /stake|amount|valor|import|mise|einsatz|puntata|inzet|stawka|tutar|сумм|金额|投注额|賭け金|ベット額|금액/i;
  var LIAB_HINT = /liabil|responsab|risk|haftung|aansprak|zobowi|sorumlu|ответств|负债|責任|책임/i;
  var SIDE_ATTR = /(^|[\s_\-])(back|lay)([\s_\-]|$)/i;
  function hintOf(inp) {
    var parts = [inp.getAttribute("aria-label"), inp.getAttribute("placeholder"), inp.getAttribute("name"), inp.id, inp.getAttribute("data-testid"), typeof inp.className === "string" ? inp.className : ""];
    if (inp.id && root.CSS && CSS.escape) { var lab = document.querySelector('label[for="' + CSS.escape(inp.id) + '"]'); if (lab) parts.push(textOf(lab)); }
    var wrap = inp.closest("label"); if (wrap) parts.push(textOf(wrap));
    [inp.previousElementSibling, inp.parentElement && inp.parentElement.previousElementSibling].forEach(function (x) { if (x && textOf(x).length < 30) parts.push(textOf(x)); });
    return parts.filter(Boolean).join(" ");
  }
  function numericInputs(scope) {
    return Array.prototype.filter.call(scope.querySelectorAll("input"), function (i) {
      var ty = (i.getAttribute("type") || "text").toLowerCase();
      return ["text", "number", "tel", "decimal", ""].indexOf(ty) >= 0 && visible(i);
    });
  }
  // one row per price input: { el (row), odds, oddsEl, stakeEl, liabEl }
  function exchangeRows(scope) {
    if (!scope || !scope.querySelectorAll) return [];
    var inps = numericInputs(scope), rows = [], used = new Set();
    inps.forEach(function (inp) {
      if (used.has(inp)) return;
      // the smallest container holding this input and at least one more
      var row = inp.parentElement;
      while (row && row !== scope && numericInputs(row).length < 2) row = row.parentElement;
      if (!row) return;
      var group = numericInputs(row);
      if (group.length < 2 || group.length > 3) return;
      var roles = group.map(function (g) { var h = hintOf(g); return LIAB_HINT.test(h) ? "liab" : ODDS_HINT.test(h) ? "odds" : STAKE_HINT.test(h) ? "stake" : ""; });
      var oi = roles.indexOf("odds");
      if (oi < 0) oi = roles[0] === "" ? 0 : -1;               // unlabelled: the price comes first (Odds | Stake)
      if (oi < 0 || P.exchangeOdds(group[oi].value) == null) return;
      var si = roles.indexOf("stake");
      if (si < 0) si = group.findIndex(function (g, k) { return k !== oi && roles[k] !== "liab"; });
      var li = roles.indexOf("liab");
      group.forEach(function (g) { used.add(g); });
      rows.push({ el: row, odds: P.exchangeOdds(group[oi].value), oddsEl: group[oi], stakeEl: si >= 0 ? group[si] : null, liabEl: li >= 0 ? group[li] : null });
    });
    return rows;
  }
  // Back or Lay: the row's classes / data attributes, else the nearest section heading above it
  function sideOfRow(row, scope) {
    for (var el = row; el && el !== scope.parentElement; el = el.parentElement) {
      var sig = [typeof el.className === "string" ? el.className : "", el.getAttribute("data-side"), el.getAttribute("data-bet-type"), el.getAttribute("data-testid"), el.getAttribute("aria-label")].join(" ");
      var m = sig.match(SIDE_ATTR); if (m) return m[2].toLowerCase();
      var ds = P.exchangeSide(el.getAttribute("data-side") || ""); if (ds) return ds;
    }
    var w = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null), n, last = null;
    while ((n = w.nextNode())) {
      if (row.contains(n)) break;
      var t = n.nodeValue.trim();
      if (t && t.length < 40) { var s = P.exchangeSide(t); if (s) last = s; }
    }
    if (last) return last;
    var inner = textOf(row).split(/\n+/).map(function (l) { return P.exchangeSide(l); }).filter(Boolean)[0];
    return inner || null;
  }
  // "Odds Stake" / "Odds Backer's stake": the row's input labels run together on one line
  function isInputLabels(l) {
    var rest = l.split(/\s+/).filter(function (w) { return !(ODDS_HINT.test(w) || STAKE_HINT.test(w) || LIAB_HINT.test(w) || /^(backer'?s|profit|payout|:)$/i.test(w)); });
    return !rest.length;
  }
  function extractExchange(slip, opts) {
    var rows = exchangeRows(slip);
    if (!rows.length) return null;
    var locale = opts.locale || pageLocale(), c = opts.commission != null && opts.commission !== "" ? +opts.commission : null;
    var bets = rows.map(function (r) {
      var dir = sideOfRow(r.el, slip) || "back";
      var stake = r.stakeEl ? P.parseAmount(r.stakeEl.value, locale) : null;
      var liab = r.liabEl ? P.parseAmount(r.liabEl.value, locale) : labelValue(r.el, P.X.liability, "amount", locale);
      if (dir === "lay" && !(stake > 0) && liab > 0) stake = P.r2(liab / (r.odds - 1));
      var d = describe(linesOf(r.el).filter(function (l) { return !P.exchangeSide(l) && !P.liabilityLabel(l) && !isInputLabels(l); }), null, r.el);
      return { kind: "exchange", dir: dir, teamA: d.teamA, teamB: d.teamB, event: d.event, market: d.market, selection: d.selection, line: d.line, live: d.live,
        odds: r.odds, stake: stake > 0 ? stake : null, liability: dir === "lay" && stake > 0 ? P.r2(stake * (r.odds - 1)) : null, commission: c, isParlay: false, legs: [], _liabShown: liab };
    });
    var checks = { returnMatch: null };
    // a lay slip shows the liability: it must equal stake × (odds − 1)
    var lay = bets.filter(function (b) { return b.dir === "lay" && b._liabShown != null && b.stake; })[0];
    if (lay) checks = { returnMatch: P.near(lay._liabShown, lay.liability), basis: "liability", ret: lay._liabShown, expected: lay.liability };
    bets.forEach(function (b) { delete b._liabShown; b.currency = fixCur((P.findAmounts(textOf(slip), locale)[0] || {}).currency || null); });
    var conf = 0.45 + (bets.every(function (b) { return b.stake; }) ? 0.2 : 0) + (bets.every(function (b) { return b.selection; }) ? 0.1 : 0) + (checks.returnMatch ? 0.2 : 0);
    return { mode: bets.length > 1 ? "singles" : "single", bets: bets, stake: bets[0].stake, potentialReturn: null, totalOdds: null, checks: checks, currency: bets[0].currency, confidence: Math.min(1, conf), kind: "exchange" };
  }

  /* ---------- prediction markets (Polymarket, Kalshi): Yes / No at a price in cents ---------- */
  // elements whose own short text is a ¢ price ("Yes 35¢", "No 66¢")
  function centsNodes(scope) {
    var out = [];
    if (!scope || !scope.querySelectorAll) return out;
    scope.querySelectorAll("button,[role=radio],[role=button],[role=tab],label,div,span").forEach(function (el) {
      var t = textOf(el).replace(/\s+/g, " ").trim();
      if (!t || t.length > 24 || !visible(el)) return;
      var cp = P.centsPrice(t);
      if (!cp || out.some(function (o) { return o.el.contains(el) || el.contains(o.el); })) return;
      out.push({ el: el, side: cp.side, price: cp.price, text: t });
    });
    return out;
  }
  // the control the site marks as chosen (ARIA state or a Radix / headless-UI data-state)
  function isChecked(el) {
    for (var i = 0; el && i < 3; i++, el = el.parentElement) {
      if (["aria-checked", "aria-pressed", "aria-selected"].some(function (a) { return el.getAttribute(a) === "true"; })) return true;
      if (/^(checked|on|active|selected)$/.test(el.getAttribute("data-state") || "") || el.getAttribute("data-selected") === "true") return true;
    }
    return false;
  }
  function centsAfterLabel(scope, re) {
    var els = scope.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var t = textOf(els[i]);
      if (!t || t.length > 40) continue;
      var m = P.norm(t).match(re);
      if (!m || m.index > 2) continue;
      var c = t.match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*¢/) || (els[i].nextElementSibling ? textOf(els[i].nextElementSibling).match(/(\d{1,2}(?:[.,]\d{1,2})?)\s*¢/) : null);
      if (c) return parseFloat(c[1].replace(",", ".")) / 100;
    }
    return null;
  }
  function extractPrediction(slip, opts) {
    var locale = opts.locale || pageLocale() || "en";
    var controls = Array.prototype.filter.call(slip.querySelectorAll("button,[role=radio],[role=tab]"), visible);
    // a Sell order closes a position you already hold: not a new bet
    if (controls.some(function (b) { return isChecked(b) && P.pmLabel(textOf(b).trim(), "sell"); })) return { mode: "single", bets: [], checks: {}, confidence: 0, kind: "prediction", skipped: "sell" };
    var prices = centsNodes(slip);
    var pick = prices.filter(function (p) { return isChecked(p.el); })[0] || prices.filter(function (p) { return p.side; })[0];
    if (!pick) return null;
    var avg = centsAfterLabel(slip, P.X.avgPrice);
    var price = avg > 0 && avg < 1 ? avg : pick.price;
    var sideWord = pick.text.replace(/^\s*\S+\s+(?=\S+\s+[\d.,]+\s*¢)/, "").replace(/\s*[\d.,]+\s*¢\s*$/, "").trim(); // "Buy Yes 35¢" → "Yes"
    // amount: the order's number input; in contracts / shares when that's what it's labelled
    var inp = numericInputs(slip).filter(function (i) { return P.parseAmount(i.value, locale) > 0; })[0];
    var val = inp ? P.parseAmount(inp.value, locale) : null, shares = null, cost = null;
    if (inp && P.X.shares.test(P.norm(hintOf(inp)))) { shares = val; cost = val != null ? P.r2(val * price) : null; } else cost = val;
    var toWin = labelValue(slip, P.X.toWin, "amount", locale);
    var fee = labelValue(slip, P.X.fee, "amount", locale);
    if (!shares && cost) {
      var est = cost / price;
      // "To win" is either the whole payout (shares × 1) or the profit on top of the cost
      shares = toWin > 0 && P.near(toWin, est, 0.03) ? toWin : toWin > 0 && P.near(toWin + cost, est, 0.03) ? P.r2(toWin + cost) : P.r2(est);
    }
    // header: title, then the outcome (multi-outcome markets), before the Buy / Sell / price controls
    var head = [];
    textOf(slip).split(/\n+/).map(P.clean).some(function (l) {
      if (!l) return false;
      if (P.pmLabel(l, "buy") || P.pmLabel(l, "sell") || P.centsPrice(l) || P.X.toWin.test(P.norm(l))) return true;
      if (l !== "·" && !P.isYesNo(l) && !P.isNoiseLine(l)) head.push(l);
      return head.length >= 2;
    });
    var title = head[0] || "", outcome = (head[1] || "").replace(/\s*·\s*(\S+)$/, function (m, w) { return P.isYesNo(w) ? "" : m; });
    var bet = { kind: "prediction", dir: pick.side || "yes", price: price, shares: shares, fee: fee > 0 ? fee : null,
      teamA: title, teamB: "", event: title, market: outcome, selection: (outcome ? outcome + " · " : "") + (sideWord || (pick.side || "").toUpperCase()),
      line: "", live: false, odds: P.r3(1 / price), stake: cost, isParlay: false, legs: [], currency: "USD" };
    var checks = { returnMatch: null };
    if (toWin > 0 && cost) checks = { returnMatch: P.near(shares, cost / price, 0.03), basis: "shares", ret: shares, expected: P.r2(cost / price) };
    var conf = 0.45 + (cost ? 0.2 : 0) + (title ? 0.1 : 0) + (checks.returnMatch ? 0.2 : 0);
    return { mode: "single", bets: [bet], stake: cost, potentialReturn: shares, totalOdds: null, checks: checks, currency: "USD", confidence: Math.min(1, conf), kind: "prediction" };
  }

  /* ---------- bet-history pages ("Minhas apostas") ---------- */
  // exchanges show profit / loss per bet, signed
  var PL_LABEL = /^(profit\s*\/\s*loss|profit|p\s*\/\s*l|p&l|lucro\s*\/\s*prejuizo|lucro|ganancia\s*\/\s*perdida|gewinn\s*\/\s*verlust|profitto\s*\/\s*perdita|winst\s*\/\s*verlies|zysk\s*\/\s*strata|kar\s*\/\s*zarar|прибыль\s*\/\s*убыток)/;
  function plValue(card, locale) {
    var els = card.querySelectorAll("*");
    for (var i = 0; i < els.length; i++) {
      var t = textOf(els[i]);
      if (!t || t.length > 60 || !PL_LABEL.test(P.norm(t))) continue;
      var pool = [t.replace(/^[^:\d+\-\u2212]*:?/, ""), els[i].nextElementSibling ? textOf(els[i].nextElementSibling) : ""].join(" ");
      var m = pool.replace(/\u2212/g, "-").match(new RegExp("([+\\-])?\\s*(?:" + P.CUR_SRC + ")?\\s*([+\\-])?\\s*(\\d[\\d.,]*)"));
      if (m) { var v = P.parseNumber(m[3], "amount", locale); if (v != null) return (m[1] === "-" || m[2] === "-") ? -v : v; }
    }
    return null;
  }
  function statusNodes(scope) {
    var out = [];
    var walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, null);
    var n;
    while ((n = walker.nextNode())) {
      var p = n.parentElement;
      if (!p || SKIP_TAGS[p.tagName.toUpperCase()]) continue;
      var st = P.statusOf(n.nodeValue);
      if (st && visible(p)) out.push({ el: p, status: st });
    }
    return out;
  }
  // nearest date shown ABOVE a card (group headers like "Saturday 20 September 2026"),
  // skipping text that belongs to other cards
  function dateAbove(card, cards, mf) {
    var w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null);
    w.currentNode = card;
    var n, steps = 0;
    while ((n = w.previousNode()) && steps++ < 400) {
      var t = n.nodeValue.trim();
      if (!t || t.length > 60) continue;
      if (cards.some(function (c) { return c !== card && c.contains(n); })) continue;
      var d = P.findDate(t, new Date(), mf);
      if (d) return d;
    }
    return null;
  }
  function scanHistory(opts) {
    opts = opts || {};
    var fmt = opts.kind === "exchange" && (!opts.fmt || opts.fmt === "auto") ? "exchange" : opts.fmt || "auto", locale = opts.locale || pageLocale(), mf = monthFirst();
    var scope = document.body;
    var stats = statusNodes(scope);
    var odds = oddsNodes(scope, fmt);
    // pass 1: one card per status label (climb while the region holds just that label)
    var cards = [];
    stats.forEach(function (s) {
      var card = s.el;
      while (card.parentElement && card.parentElement !== scope && countIn(card.parentElement, stats) === 1) card = card.parentElement;
      if (countIn(card, odds) === 0 || cards.some(function (c) { return c.el === card; })) return;
      cards.push({ el: card, status: s });
    });
    var cardEls = cards.map(function (c) { return c.el; });
    // pass 2: read each card
    var results = [];
    cards.forEach(function (cd) {
      var card = cd.el, s = cd.status;
      var cardOdds = odds.filter(function (o) { return card.contains(o.el); });
      var text = textOf(card);
      var stake = labelValue(card, P.V.stakeLabel, "amount", locale, fmt);
      var ret = labelValue(card, P.V.returnLabel, "amount", locale, fmt);
      var tot = labelValue(card, P.V.totalOddsLabel, "odds", locale, fmt);
      if (stake == null) { var am = P.findAmounts(text, locale); if (am.length) stake = am[0].value; }
      var when = P.findDate(text, new Date(), mf) || dateAbove(card, cardEls, mf) || {};
      var legsCards = cardOdds.length === 1 ? [{ el: card, odds: cardOdds[0].value, oddsEl: cardOdds[0].el }] : cardsFor(card, cardOdds).filter(function (c) {
        return !(P.V.totalOddsLabel.test(P.norm(textOf(c.el))));
      });
      var legs = legsCards.map(function (c) { var d = describe(linesOf(c.el, [s.el.innerText]), c.oddsEl, c.el); return { event: d.event, market: d.market, sel: d.selection, odds: c.odds, teamA: d.teamA, teamB: d.teamB, live: d.live, line: d.line }; });
      if (!legs.length) return;
      var bet;
      if (legs.length > 1) {
        var po = tot || P.r3(P.product(legs.map(function (l) { return l.odds; })));
        bet = { teamA: "", teamB: "", event: "", market: "", selection: legs.map(function (l) { return l.sel; }).join(" + "), line: "", live: false, odds: po, stake: stake, isParlay: true, legs: legs.map(function (l) { return { event: l.event, market: l.market, sel: l.sel, odds: l.odds }; }) };
      } else {
        var l0 = legs[0];
        bet = { teamA: l0.teamA, teamB: l0.teamB, event: l0.event, market: l0.market, selection: l0.sel, line: l0.line, live: l0.live, odds: l0.odds, stake: stake, isParlay: false, legs: [] };
      }
      // result: the site's label, refined by "½ Won / ½ Void" tags and by what the return proves
      var label = s.status, result = P.halfResult(text) || label;
      var checks = { returnMatch: null };
      if (label === "pending") {
        if (ret != null && stake) { checks = { returnMatch: P.near(ret, stake * bet.odds), basis: "potential", ret: ret, expected: P.r3(stake * bet.odds) }; }
      } else if (label !== "cashout" && ret != null && stake) {
        var inf = P.inferResult(stake, bet.odds, ret, result);
        if (inf) { result = inf.result; checks = { returnMatch: true, basis: inf.result, ret: ret, expected: inf.expected }; }
        else checks = { returnMatch: false, basis: result, ret: ret, expected: P.r3(stake * bet.odds) };
      }
      if (opts.kind === "exchange" && !bet.isParlay) {
        var dir = text.split(/\n+/).map(function (l) { return P.exchangeSide(l); }).filter(Boolean)[0] || "back";
        var c = opts.commission != null && opts.commission !== "" ? +opts.commission : null;
        Object.assign(bet, { kind: "exchange", dir: dir, commission: c, liability: dir === "lay" && stake ? P.r2(stake * (bet.odds - 1)) : null });
        var pl = plValue(card, locale);
        if (pl != null && label !== "pending") {
          var ie = P.inferExchange(dir, bet.odds, stake, (c || 0) / 100, pl);
          checks = ie ? { returnMatch: true, basis: "pl-" + ie.result, ret: pl, expected: ie.expected } : { returnMatch: false, basis: "pl", ret: pl, expected: null };
          if (ie) result = ie.result;
        }
      }
      bet.result = result;
      bet.returned = label === "cashout" ? ret : null;
      bet.currency = fixCur((P.findAmounts(text, locale)[0] || {}).currency || null);
      bet.date = when.date || "";
      bet.time = when.time || "";
      results.push({ bet: bet, checks: checks, confidence: (stake ? 0.5 : 0.3) + (bet.date ? 0.15 : 0) + (checks.returnMatch ? 0.25 : 0) });
    });
    return results;
  }

  /* ---------- does a region look like a bet slip? (not a shop cart) ----------
     A stake label in it ("Stake", "Risco", "Einsatz") or slip markup on it or its parents
     ("betslip", "cupom", "boletim"). Used before trusting a confirmation with no recognised press. */
  var SLIP_MARK = /bet.?slip|betslip|cupom|cupon|coupon|bilhete|boletim|wettschein|schedina|kupon|bet-?builder|slip/i;
  function looksLikeSlip(region) {
    for (var el = region, d = 0; el && el.nodeType === 1 && d < 7; el = el.parentElement, d++) {
      var sig = [el.id, typeof el.className === "string" ? el.className : "", el.getAttribute("data-testid"), el.getAttribute("data-test-id"), el.getAttribute("data-test")].join(" ");
      if (SLIP_MARK.test(sig)) return true;
    }
    return textOf(region).split(/\n+/).some(function (l) { var n = P.norm(P.clean(l)); return n.length < 40 && P.V.stakeLabel.test(n); });
  }

  /* ---------- receipt region after a placement ---------- */
  function receiptRegion(node, fmt) {
    var start = node.nodeType === 3 ? node.parentElement : node;
    return start ? slipFromElement(start, fmt) : null;
  }

  /* ---------- test snapshot: structure + text of the slip only ---------- */
  function skeleton(el, depth, budget) {
    if (!el || budget.n <= 0 || depth > 14) return null;
    budget.n--;
    var own = Array.prototype.filter.call(el.childNodes, function (c) { return c.nodeType === 3; }).map(function (c) { return c.nodeValue.trim(); }).join(" ").trim();
    var node = { tag: el.tagName.toLowerCase() };
    var cls = typeof el.className === "string" ? el.className.trim().split(/\s+/).slice(0, 4).join(" ") : "";
    if (cls) node.cls = cls;
    ["id", "role", "data-testid", "aria-label", "type"].forEach(function (a) { var v = el.getAttribute(a); if (v) node[a] = v.slice(0, 60); });
    // only number-like values (stakes, prices): never passwords, e-mails or typed text
    if (el.tagName === "INPUT") {
      var ity = (el.getAttribute("type") || "text").toLowerCase();
      if (["password", "email", "hidden"].indexOf(ity) < 0 && /^[\s\d.,+\-]*$/.test(el.value || "")) node.value = el.value;
      else if (el.value) node.value = "(not recorded)";
    }
    if (own) node.text = own.slice(0, 120);
    var kids = [];
    for (var i = 0; i < el.children.length; i++) {
      var k = el.children[i];
      if (SKIP_TAGS[k.tagName.toUpperCase()] && k.tagName !== "INPUT") continue;
      if (!visible(k)) continue;
      var s = skeleton(k, depth + 1, budget);
      if (s) kids.push(s);
    }
    if (kids.length) node.kids = kids;
    return node;
  }

  root.DBL_EXTRACT = {
    visible: visible, oddsNodes: oddsNodes, amountInputs: amountInputs, buttonLike: buttonLike, isPlaceButton: isPlaceButton, placeTarget: placeTarget, isMoney: isMoney,
    slipFromElement: slipFromElement, slipAuto: slipAuto, extractSlip: extractSlip, scanHistory: scanHistory, priceCount: priceCount,
    exchangeRows: exchangeRows, centsNodes: centsNodes, extractExchange: extractExchange, extractPrediction: extractPrediction,
    receiptRegion: receiptRegion, skeleton: skeleton, looksLikeSlip: looksLikeSlip, pageLocale: pageLocale, textOf: textOf
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
