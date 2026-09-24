// Node unit tests for the pure modules:  node --test test/
"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
// the detection words for every language load before the parser, as in the extension
["en", "pt", "es", "fr", "de", "it", "nl", "pl", "tr", "ru", "ko", "zh", "ja"].forEach((l) => require("../src/vocab/" + l + ".js"));
require("../src/lib/parse.js");
require("../src/lib/csv.js");
const P = globalThis.DBL_PARSE, C = globalThis.DBL_CSV;

test("numbers: pt-BR and en amounts", () => {
  assert.equal(P.parseNumber("R$ 1.234,56", "amount"), 1234.56);
  assert.equal(P.parseNumber("1,234.56", "amount"), 1234.56);
  assert.equal(P.parseNumber("1.250", "amount", "pt"), 1250);
  assert.equal(P.parseNumber("1,250", "amount", "en"), 1250);
  assert.equal(P.parseNumber("10,00", "amount"), 10);
  assert.equal(P.parseNumber("2,10", "odds"), 2.1);
  assert.equal(P.parseNumber("1.833", "odds"), 1.833);
  assert.equal(P.parseNumber("abc", "amount"), null);
});

test("money: currency-marked amounts", () => {
  const a = P.findAmounts("Retorno potencial R$ 21,00 · stake $5.50 · 3,00 €");
  assert.deepEqual(a.map((x) => [x.value, x.currency]), [[21, "BRL"], [5.5, "USD"], [3, "EUR"]]);
});

test("odds: exact tokens", () => {
  assert.equal(P.exactOdds("2,10"), 2.1);
  assert.equal(P.exactOdds("@ 1.95"), 1.95);
  assert.equal(P.exactOdds("+150"), 2.5);
  assert.equal(P.exactOdds("-200"), 1.5);
  assert.equal(P.exactOdds("5/2"), null, "fractional only when the site is set to fractional");
  assert.equal(P.exactOdds("5/2", "fractional"), 3.5);
  assert.equal(P.exactOdds("2.5"), null, "one decimal = a line, not a price");
  assert.equal(P.exactOdds("R$ 2,10"), null);
  assert.equal(P.exactOdds("21:30"), null);
});

test("odds in text skip money, lines, dates and times", () => {
  const o = P.oddsInText("Mais de 2.5 @ 1,90 · R$ 10,00 · 12.09.2026 · 21:30 · 55,20%");
  assert.deepEqual(o.map((x) => x.value), [1.9]);
});

test("place-button vocabulary", () => {
  ["Apostar", "Apostar R$ 10,00", "Fazer aposta", "Fazer apostas", "Confirmar aposta", "Aceitar alterações e apostar", "Place Bet", "Place bet £10.00", "Bet Now", "Confirm bets"].forEach((s) => assert.ok(P.isPlaceButton(s), s));
  ["Minhas apostas", "Apostas abertas", "My bets", "Placar", "Place order", "Place your order", "Place your first deposit and get a free bet with it today"].forEach((s) => assert.ok(!P.isPlaceButton(s), s));
});

test("receipt and error vocabulary", () => {
  ["Aposta realizada!", "Apostas feitas com sucesso", "Sua aposta foi aceita", "Nº da aposta 123", "Bet placed", "Your bets have been accepted", "Bet receipt"].forEach((s) => assert.ok(P.V.receipt.test(P.norm(s)), s));
  ["Saldo insuficiente", "As odds mudaram", "Market suspended", "Insufficient funds"].forEach((s) => assert.ok(P.V.error.test(P.norm(s)), s));
  ["Your bet slip is empty", "Processando…"].forEach((s) => assert.ok(!P.V.receipt.test(P.norm(s)) && !P.V.error.test(P.norm(s)), s));
});

test("events, lines, status", () => {
  assert.deepEqual(P.splitEvent("Flamengo x Palmeiras"), { teamA: "Flamengo", teamB: "Palmeiras" });
  assert.deepEqual(P.splitEvent("Arsenal v Chelsea"), { teamA: "Arsenal", teamB: "Chelsea" });
  assert.equal(P.splitEvent("Paris Saint-Germain"), null);
  assert.equal(P.lineOf("Mais de 2.5"), "2.5");
  assert.equal(P.lineOf("Over 224.5"), "224.5");
  assert.equal(P.lineOf("Celtics -4.5"), "-4.5");
  assert.equal(P.statusOf("Ganhou"), "won");
  assert.equal(P.statusOf("Cash Out"), "cashout");
  assert.equal(P.statusOf("Ganhos potenciais"), null);
});

test("dates are local and locale-aware", () => {
  const now = new Date(2026, 8, 24, 22, 30); // 24 Sep 2026 22:30 local
  assert.deepEqual(P.findDate("12/09/2026 21:30", now), { date: "2026-09-12", time: "21:30" });
  assert.deepEqual(P.findDate("09/12/2026", now, true), { date: "2026-09-12", time: "" });
  assert.deepEqual(P.findDate("12 set 2026", now), { date: "2026-09-12", time: "" });
  assert.deepEqual(P.findDate("Sep 12, 2026 8:05", now), { date: "2026-09-12", time: "08:05" });
  assert.equal(P.findDate("Hoje 18h30", now).date, "2026-09-24");
  assert.equal(P.localISO(now), "2026-09-24");
});

test("book name from hostname", () => {
  assert.equal(P.baseDomain("sports.betano.bet.br"), "betano.bet.br");
  assert.equal(P.bookFromHost("www.bet365.bet.br"), "Bet365");
  assert.equal(P.bookFromHost("www.pinnacle.com"), "Pinnacle");
});

test("CSV matches the tracker's importer columns", () => {
  const csv = C.toCSV([{ bet: { date: "2026-09-24", time: "21:40", book: "Betano", teamA: "Flamengo", teamB: "Palmeiras", market: "Resultado Final", line: "", side: "Flamengo", live: false, stake: 10, odds: 2.1, result: "pending" } },
    { bet: { date: "2026-09-24", time: "", book: "Bet365", teamA: "", teamB: "", market: "", side: "A + B", isParlay: true, legs: [{ event: "A v B", market: "1X2", sel: "A", odds: 1.8 }, { event: "C v D", market: "1X2", sel: "C", odds: 2 }], stake: 5, odds: 3.6, result: "pending", notes: 'He said "go"' } }]);
  const lines = csv.split("\n");
  // the tracker's 20 columns first, unchanged; exchange / prediction-market columns after them
  assert.equal(lines[0], "date,time,sport,league,home,away,map,book,tipster,market,line,side,live,stake,odds,result,closing,model_prob,player,notes,venue,direction,exch_odds,backer_stake,liability,commission_pct,shares,share_price,fee");
  assert.equal(lines[1], "2026-09-24,21:40,,,Flamengo,Palmeiras,,Betano,,Resultado Final,,Flamengo,no,10,2.1,pending,,,,,sportsbook,,,,,,,,");
  assert.match(lines[2], /^2026-09-24,,,,Parlay \(2\),,,Bet365,,Parlay,,A \+ B,no,5,3.6,pending,,,,"Legs: A v B \/ 1X2 \/ A @ 1.8; C v D \/ 1X2 \/ C @ 2 \| He said ""go""",sportsbook,,,,,,,,$/);
});

test("Bet365 reading fixes: count headers, repeated lines, split money, markets", () => {
  assert.equal(P.stripTags("1 GB Packers Selections"), "GB Packers");
  assert.equal(P.stripTags("Under 11.5 11.5"), "Under 11.5");
  assert.equal(P.stripTags("1X2"), "1X2");
  assert.deepEqual(P.findAmounts("Stake\nR$\n1.00\nTo Return\nR$\n1.38").map((a) => a.value), [1, 1.38]);
  assert.ok(P.V.market.test(P.norm("To Win Match")));
  assert.ok(!P.V.market.test(P.norm("Michika Ozeki")));
  assert.ok(!P.V.market.test(P.norm("TSV Hannover Burgdorf")));
});

test("every language has every text, and every text the popup uses exists", () => {
  ["en", "pt", "es", "ko", "de", "it", "zh", "ja", "fr", "tr", "pl", "ru", "nl"].forEach((l) => require("../src/i18n/" + l + ".js"));
  const L = globalThis.DBL_I18N, en = Object.keys(L.en);
  const ph = (s) => (s.match(/\{\w+\}|<\/?b>/g) || []).sort().join(" ");
  Object.keys(L).filter((l) => l !== "en").forEach((l) => {
    assert.deepEqual(en.filter((k) => !(k in L[l])), [], l + " is missing texts");
    assert.deepEqual(en.filter((k) => ph(L.en[k]) !== ph(L[l][k])), [], l + " has placeholders that differ from English");
  });
  const src = require("fs").readFileSync(__dirname + "/../src/popup/popup.js", "utf8") + require("fs").readFileSync(__dirname + "/../src/background.js", "utf8");
  const used = [...src.matchAll(/\bn?t\((?:lang, )?"([a-z][\w.-]+)"/g)].map((m) => m[1]);
  // keys built at runtime ("r." + result) end with "." and are covered by the language check above
  assert.deepEqual([...new Set(used)].filter((k) => !k.endsWith(".") && !(k in L.en)), []);
});
