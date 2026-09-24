/* =====================================================
   Doinp Bet Logger — CSV export
   The first 20 columns and their names match the tracker's
   own CSV example (tools/tracker/extras.jsx EXAMPLE_CSV), so
   its importer auto-maps every one. Numbers use "." decimals
   with no thousands separator; dates are ISO.
   Exchange and prediction-market bets: stake / odds / side
   hold the equivalent back bet, so a tracker that only knows
   back bets computes the exact profit (see trackerView in
   parse.js). The raw figures follow in extra columns whose
   names match none of the tracker's column guesses, so they
   are never mapped onto another field by mistake.
   Exposes globalThis.DBL_CSV.
   ===================================================== */
(function (root) {
  "use strict";
  var HEADER = ["date", "time", "sport", "league", "home", "away", "map", "book", "tipster", "market", "line", "side", "live", "stake", "odds", "result", "closing", "model_prob", "player", "notes",
    "venue", "direction", "exch_odds", "backer_stake", "liability", "commission_pct", "shares", "share_price", "fee"];

  function cell(v) {
    if (v == null) return "";
    var s = typeof v === "number" ? String(Math.round(v * 1e6) / 1e6) : String(v);
    return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }
  function notesFor(b, extra) {
    var parts = [];
    if (extra) parts.push(extra);
    if (b.isParlay && b.legs && b.legs.length) parts.push("Legs: " + b.legs.map(function (l) { return [l.event, l.market, l.sel].filter(Boolean).join(" / ") + " @ " + l.odds; }).join("; "));
    if (b.result === "cashout" && b.returned != null) parts.push("Cash-out returned " + b.returned);
    if (b.notes) parts.push(b.notes);
    return parts.join(" | ");
  }
  function view(b) {
    var P = root.DBL_PARSE;
    return P && P.trackerView ? P.trackerView(b) : { stake: b.stake, odds: b.odds, side: b.side, extra: "" };
  }
  function toCSV(items) {
    var rows = [HEADER.join(",")];
    items.forEach(function (it) {
      var b = it.bet || it, v = view(b), k = b.kind || "sportsbook";
      rows.push([
        b.date, b.time, "", "", b.isParlay ? "Parlay (" + (b.legs || []).length + ")" : b.teamA, b.isParlay ? "" : b.teamB, "",
        b.book, "", b.isParlay ? (b.market || "Parlay") : b.market, b.line, v.side, b.live ? "yes" : "no",
        v.stake, v.odds, b.result || "pending", "", "", "", notesFor(b, v.extra),
        k, b.dir || "",
        k === "exchange" ? b.odds : "", k === "exchange" ? b.stake : "", k === "exchange" && b.dir === "lay" ? b.liability : "", k === "exchange" ? b.commission : "",
        k === "prediction" ? b.shares : "", k === "prediction" ? b.price : "", k === "prediction" ? b.fee : ""
      ].map(cell).join(","));
    });
    return rows.join("\n");
  }
  root.DBL_CSV = { HEADER: HEADER, toCSV: toCSV };
})(typeof globalThis !== "undefined" ? globalThis : this);
