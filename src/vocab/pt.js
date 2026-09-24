/* Doinp Bet Logger — detection words: Português (pt).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Sportsbook words are built into parse.js; this file adds exchange and prediction-market words. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["pt"] = {
 "back": [
  "a favor",
  "apostar a favor",
  "back"
 ],
 "lay": [
  "contra",
  "apostar contra",
  "lay"
 ],
 "liability": [
  "responsabilidade",
  "risco",
  "exposição"
 ],
 "yes": [
  "sim"
 ],
 "no": [
  "não"
 ],
 "buy": [
  "comprar"
 ],
 "sell": [
  "vender"
 ],
 "toWin": [
  "para ganhar",
  "retorno se sim",
  "pagamento"
 ],
 "shares": [
  "cotas",
  "contratos",
  "ações"
 ],
 "avgPrice": [
  "preço médio",
  "preço"
 ],
 "fee": [
  "taxa",
  "taxas",
  "comissão"
 ],
 "pmPlace": [
  "negociar",
  "comprar sim",
  "comprar não",
  "enviar ordem",
  "confirmar ordem"
 ],
 "status": {
  "correspondida": "pending",
  "não correspondida": "pending"
 },
 "receipt": [
  "ordem enviada",
  "ordem executada",
  "aposta correspondida"
 ],
 "error": [
  "saldo insuficiente para"
 ]
};
