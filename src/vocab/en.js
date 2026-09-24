/* Doinp Bet Logger — detection words: English (en).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Sportsbook words are built into parse.js; this file adds exchange and prediction-market words (Polymarket ticket wording checked on the live site, Sep 2026; Betfair and Kalshi wording from their help pages).
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["en"] = {
 "back": [
  "back",
  "back (bet for)",
  "bet for"
 ],
 "lay": [
  "lay",
  "lay (bet against)",
  "bet against"
 ],
 "liability": [
  "liability",
  "your liability",
  "risk"
 ],
 "yes": [
  "yes"
 ],
 "no": [
  "no"
 ],
 "buy": [
  "buy"
 ],
 "sell": [
  "sell"
 ],
 "toWin": [
  "to win",
  "payout",
  "potential payout",
  "max payout",
  "payout if yes",
  "payout if no"
 ],
 "shares": [
  "shares",
  "contracts"
 ],
 "avgPrice": [
  "avg. price",
  "avg price",
  "average price",
  "price"
 ],
 "fee": [
  "fee",
  "fees",
  "trading fee"
 ],
 "pmPlace": [
  "trade",
  "buy yes",
  "buy no",
  "place order",
  "submit order",
  "confirm order",
  "confirm trade",
  "submit"
 ],
 "status": {
  "matched": "pending",
  "unmatched": "pending"
 },
 "receipt": [
  "order placed",
  "order filled",
  "order submitted",
  "trade executed",
  "bets placed",
  "bet matched",
  "matched",
  "unmatched"
 ],
 "error": [
  "order failed",
  "order rejected",
  "insufficient buying power",
  "not enough balance"
 ]
};
