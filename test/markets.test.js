// Node tests: languages, exchanges, prediction markets, privacy.   node --test test/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs"), path = require("path");
const LANGS = ["en", "pt", "es", "fr", "de", "it", "nl", "pl", "tr", "ru", "ko", "zh", "ja"];
LANGS.forEach((l) => require("../src/vocab/" + l + ".js"));
require("../src/lib/parse.js");
require("../src/lib/csv.js");
const P = globalThis.DBL_PARSE, C = globalThis.DBL_CSV, VOC = globalThis.DBL_VOCAB;
const now = new Date(2026, 8, 24);

test("place-bet buttons in 13 languages; history links and labels never count", () => {
  ["Place bet", "Fazer aposta", "Realizar apuesta", "Placer le pari", "Wette platzieren 10,00 €", "Scommetti", "Plaats weddenschap", "Postaw zakład",
    "Bahis Yap", "Сделать ставку", "베팅하기", "投注", "ベットする"].forEach((b) => assert.ok(P.isPlaceButton(b), b));
  ["Meine Wetten", "Mes paris", "Moje zakłady", "Мои ставки", "我的投注", "投注额", "マイベット", "Place order", "Einsatz"].forEach((b) => assert.ok(!P.isPlaceButton(b), b));
  // prediction-market order buttons only count on prediction-market sites
  assert.ok(!P.isPlaceButton("Trade") && P.isPlaceButton("Trade", "prediction"));
  assert.ok(!P.isPlaceButton("Buy Yes") && P.isPlaceButton("Buy Yes", "prediction"));
});

test("receipts, errors, labels and results in other languages", () => {
  const n = P.norm;
  ["Wette platziert", "Pari placé", "Scommessa accettata", "Zakład przyjęty", "Bahis alındı", "Ставка принята", "베팅 완료", "投注成功", "ベット完了"].forEach((t) => assert.ok(P.V.receipt.test(n(t)), t));
  ["Unzureichendes Guthaben", "Solde insuffisant", "Недостаточно средств", "余额不足", "La cuota ha cambiado"].forEach((t) => assert.ok(P.V.error.test(n(t)), t));
  ["Einsatz", "Mise", "Stawka", "Сумма ставки", "投注额"].forEach((t) => assert.ok(P.V.stakeLabel.test(n(t)), t));
  ["Möglicher Gewinn", "Gain potentiel", "Vincita potenziale", "Возможный выигрыш", "予想払戻"].forEach((t) => assert.ok(P.V.returnLabel.test(n(t)), t));
  const st = { Gewonnen: "won", Perdu: "lost", Annullata: "void", "Выигрыш": "won", "적중": "won", "赢半": "half-won", "無効": "void", Ganhou: "won", Lost: "lost" };
  Object.keys(st).forEach((k) => assert.equal(P.statusOf(k), st[k], k));
  assert.equal(P.halfResult("Halb gewonnen"), "half-won");
  // team names in any script are text, not noise; market words don't swallow names
  assert.ok(!P.isNoiseLine("Спартак Москва") && !P.isNoiseLine("阪神タイガース") && P.isNoiseLine("₽"));
  assert.ok(P.V.market.test(n("Doppelte Chance")) && !P.V.market.test(n("Hannover 96")));
});

test("dates: month names, today / yesterday, Chinese / Japanese / Korean", () => {
  const d = (s) => (P.findDate(s, now) || {}).date;
  assert.equal(d("24 de septiembre de 2026"), "2026-09-24");
  assert.equal(d("3. März 2026"), "2026-03-03");
  assert.equal(d("12 марта 2026"), "2026-03-12");
  assert.equal(d("5 lutego 2026"), "2026-02-05");
  assert.equal(d("2026年9月20日"), "2026-09-20");
  assert.equal(d("9월 20일"), "2026-09-20");
  assert.equal(d("heute 15:30"), "2026-09-24");
  assert.equal(d("вчера"), "2026-09-23");
  assert.equal(d("昨日"), "2026-09-23");
  assert.equal(d("Sep 20, 2026"), "2026-09-20"); // English still works
  assert.ok(P.isDateLine("heute 15:30") && P.isDateLine("9月24日") && !P.isDateLine("Arsenal x Chelsea"));
});

test("money: space thousands and more currencies", () => {
  const a = (s, l) => { const x = P.findAmounts(s, l)[0]; return x && [x.value, x.currency]; };
  assert.deepEqual(a("1 234,56 €", "pt"), [1234.56, "EUR"]);
  assert.deepEqual(a("10 000 ₽", "pt"), [10000, "RUB"]);
  assert.deepEqual(a("25,50 zł", "pt"), [25.5, "PLN"]);
  assert.deepEqual(a("100 TL", "pt"), [100, "TRY"]);
  assert.deepEqual(a("10,000원", "en"), [10000, "KRW"]);
  assert.deepEqual(a("¥1,500", "en"), [1500, "JPY"]);
  assert.deepEqual(a("R$ 30,00"), [30, "BRL"]);
});

test("exchange math: back and lay with commission (derivations in the comments)", () => {
  // lay 10 @ 3.40, 5 %: selection loses → +10 × 0.95 = 9.50; selection wins → −10 × 2.40 = −24.00
  assert.equal(P.exchangeProfit("lay", 3.4, 10, 0.05, "won"), 9.5);
  assert.equal(P.r2(P.exchangeProfit("lay", 3.4, 10, 0.05, "lost")), -24);
  // back 10 @ 2.50, 5 %: wins 10 × 1.50 × 0.95 = 14.25; loses −10
  assert.equal(P.r2(P.exchangeProfit("back", 2.5, 10, 0.05, "won")), 14.25);
  assert.equal(P.exchangeProfit("back", 2.5, 10, 0.05, "lost"), -10);
  assert.deepEqual(P.inferExchange("lay", 3.4, 10, 0.05, -24), { result: "lost", expected: -24 });
  assert.deepEqual(P.inferExchange("back", 2.5, 10, 0.05, 15), { result: "won", expected: 15 });   // P/L before commission
  assert.deepEqual(P.inferExchange("back", 2.5, 10, 0.05, 14.25), { result: "won", expected: 14.25 }); // after commission
  assert.equal(P.exchangeSide("Lay (Bet Against)"), "lay");
  assert.equal(P.exchangeSide("A favor"), "back");
  assert.equal(P.exchangeOdds("2.5"), 2.5);
  assert.equal(P.exchangeOdds("0.9"), null);
});

test("tracker view: the equivalent back bet gives the exact exchange / prediction profit", () => {
  // every odds 1.1–20, stake 1–100, commission 0–10 %: |tracker profit − exchange profit| ≤ 0.01
  for (const dir of ["back", "lay"]) for (let o = 1.1; o <= 20; o += 0.37) for (const s of [1, 7.5, 100]) for (const c of [0, 2, 5, 6.5, 10]) {
    const b = { kind: "exchange", dir, odds: +o.toFixed(2), stake: s, commission: c, side: "X" };
    const v = P.trackerView(b);
    const want = { won: P.exchangeProfit(dir, b.odds, s, c / 100, "won"), lost: P.exchangeProfit(dir, b.odds, s, c / 100, "lost") };
    assert.ok(Math.abs(v.stake * (v.odds - 1) - want.won) <= 0.01, JSON.stringify([b, v]));
    assert.ok(Math.abs(-v.stake - want.lost) <= 0.01, JSON.stringify([b, v]));
  }
  const lay = P.trackerView({ kind: "exchange", dir: "lay", odds: 3.4, stake: 10, commission: 5, side: "Arsenal" });
  assert.equal(lay.side, "Lay: Arsenal");
  assert.equal(lay.stake, 24);
  // prediction: $10 at 35¢ = 28.57 shares, fee 0.16 → profit if right 28.57 − 10.16 = 18.41
  const pm = P.trackerView({ kind: "prediction", dir: "yes", price: 0.35, stake: 10, shares: 28.57, fee: 0.16, side: "Yes" });
  assert.ok(Math.abs(pm.stake * (pm.odds - 1) - 18.41) <= 0.01);
  assert.equal(pm.stake, 10.16);
});

test("prediction-market prices and results", () => {
  assert.deepEqual(P.centsPrice("Yes 35¢"), { side: "yes", price: 0.35 });
  assert.deepEqual(P.centsPrice("Buy No 66¢"), { side: "no", price: 0.66 });
  assert.deepEqual(P.centsPrice("Yes 0.3¢"), { side: "yes", price: 0.003 });
  assert.deepEqual(P.centsPrice("Sim 42¢"), { side: "yes", price: 0.42 });
  assert.equal(P.centsPrice("Arsenal 35¢"), null);
  assert.equal(P.centsPrice("$0.35"), null); // a fee amount, not a price
  assert.deepEqual(P.inferPrediction(28.57, 28.57), { result: "won", expected: 28.57 });
  assert.deepEqual(P.inferPrediction(28.57, 0), { result: "lost", expected: 0 });
});

test("CSV: a lay bet exports the equivalent back bet plus the raw exchange figures", () => {
  const csv = C.toCSV([{ bet: { date: "2026-09-24", book: "Betfair", teamA: "Arsenal", teamB: "Chelsea", market: "Match Odds", side: "Arsenal", kind: "exchange", dir: "lay", odds: 3.4, stake: 10, liability: 24, commission: 5, result: "won" } }]);
  const [h, r] = csv.split("\n").map((l) => l.split(","));
  const row = Object.fromEntries(h.map((k, i) => [k, r[i]]));
  assert.equal(row.side, "Lay: Arsenal");
  assert.equal(row.stake, "24");
  assert.equal(row.odds, "1.395833");
  assert.equal(row.venue, "exchange");
  assert.equal(row.direction, "lay");
  assert.equal(row.exch_odds, "3.4");
  assert.equal(row.backer_stake, "10");
  assert.equal(row.liability, "24");
  assert.equal(row.commission_pct, "5");
});

test("site kinds", () => {
  assert.equal(P.kindFor("polymarket.com", "/event/x"), "prediction");
  assert.equal(P.kindFor("kalshi.com", "/markets/x"), "prediction");
  assert.equal(P.kindFor("www.betfair.com", "/exchange/plus/"), "exchange");
  assert.equal(P.kindFor("www.betfair.com", "/sport/football"), "sportsbook");
  assert.equal(P.kindFor("www.smarkets.com", "/"), "exchange");
  assert.equal(P.kindFor("www.bet365.bet.br", "/"), "sportsbook");
});

test("vocab files: every language loads; no one-character Chinese / Japanese / Korean word in place / market lists", () => {
  LANGS.forEach((l) => assert.ok(VOC[l], l));
  const CJK = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-鿿가-힯]/;
  LANGS.forEach((l) => ["place", "market", "receipt"].forEach((k) => (VOC[l][k] || []).forEach((w) => assert.ok(!(CJK.test(w) && w.length < 2), l + " " + k + " " + w))));
});

test("privacy: no network code anywhere in the extension, and pages can't connect", () => {
  const files = [];
  (function walk(d) { fs.readdirSync(d, { withFileTypes: true }).forEach((e) => { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(js|html)$/.test(e.name)) files.push(p); }); })(path.join(__dirname, "../src"));
  const bad = /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.connection|<script[^>]+src=["']https?:|importScripts\(\s*["']https?:/;
  files.forEach((f) => assert.ok(!bad.test(fs.readFileSync(f, "utf8")), path.relative(path.join(__dirname, ".."), f) + " contains network code"));
  ["manifest.json", "manifest.firefox.json"].forEach((m) => {
    const j = JSON.parse(fs.readFileSync(path.join(__dirname, "..", m), "utf8"));
    assert.match(j.content_security_policy.extension_pages, /connect-src 'none'/, m);
  });
  // the test snapshot never records what was typed into non-number fields
  assert.match(fs.readFileSync(path.join(__dirname, "../src/lib/extract.js"), "utf8"), /\["password", "email", "hidden"\]\.indexOf\(ity\) < 0/);
  const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "../manifest.firefox.json"), "utf8"));
  assert.deepEqual(fx.browser_specific_settings.gecko.data_collection_permissions, { required: ["none"] });
});
