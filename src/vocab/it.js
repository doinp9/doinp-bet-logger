/* Doinp Bet Logger — detection words: Italiano (it).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["it"] = {
 "place": [
  "scommetti",
  "piazza scommessa",
  "piazza la scommessa",
  "conferma scommessa",
  "gioca",
  "scommetti ora",
  "conferma giocata"
 ],
 "receipt": [
  "scommessa piazzata",
  "scommessa accettata",
  "scommessa confermata",
  "giocata accettata",
  "la tua scommessa è stata",
  "ricevuta",
  "codice scommessa",
  "id scommessa",
  "numero scommessa"
 ],
 "error": [
  "saldo insufficiente",
  "fondi insufficienti",
  "errore",
  "rifiutata",
  "non è stato possibile",
  "la quota è cambiata",
  "le quote sono cambiate",
  "mercato sospeso",
  "mercato chiuso",
  "puntata massima",
  "effettua il login",
  "accedi"
 ],
 "stake": [
  "importo",
  "puntata",
  "importo totale",
  "giocata"
 ],
 "ret": [
  "vincita potenziale",
  "vincita",
  "possibile vincita",
  "pagamento"
 ],
 "totalOdds": [
  "quota totale"
 ],
 "live": [
  "live",
  "in diretta"
 ],
 "parlay": [
  "multipla",
  "combinata",
  "accumulatore"
 ],
 "types": [
  "singola",
  "multipla",
  "sistema"
 ],
 "market": [
  "esito finale",
  "1x2",
  "vincente",
  "vincitore",
  "handicap",
  "handicap asiatico",
  "over",
  "under",
  "gol",
  "angoli",
  "cartellini",
  "entrambe le squadre segnano",
  "goal/no goal",
  "doppia chance",
  "risultato esatto",
  "primo tempo",
  "giocatore",
  "punti",
  "mappa"
 ],
 "status": {
  "vinta": "won",
  "vincente": "won",
  "persa": "lost",
  "perdente": "lost",
  "annullata": "void",
  "rimborsata": "void",
  "in corso": "pending",
  "aperta": "pending",
  "in attesa": "pending",
  "incassata": "cashout"
 },
 "halfWon": [
  "mezza vinta",
  "metà vinta"
 ],
 "halfLost": [
  "mezza persa",
  "metà persa"
 ],
 "noise": [
  "rimuovi",
  "chiudi",
  "cancella tutto",
  "modifica",
  "elimina"
 ],
 "history": [
  "le mie scommesse",
  "storico",
  "scommesse aperte"
 ],
 "months": {
  "gennaio": 1,
  "gen": 1,
  "febbraio": 2,
  "marzo": 3,
  "aprile": 4,
  "maggio": 5,
  "mag": 5,
  "giugno": 6,
  "giu": 6,
  "luglio": 7,
  "lug": 7,
  "agosto": 8,
  "ago": 8,
  "settembre": 9,
  "set": 9,
  "ottobre": 10,
  "ott": 10,
  "novembre": 11,
  "dicembre": 12,
  "dic": 12
 },
 "today": [
  "oggi"
 ],
 "yesterday": [
  "ieri"
 ],
 "back": [
  "punta",
  "puntata"
 ],
 "lay": [
  "banca",
  "bancata"
 ],
 "liability": [
  "responsabilità",
  "rischio"
 ],
 "yes": [
  "sì"
 ],
 "no": [
  "no"
 ],
 "buy": [
  "compra"
 ],
 "sell": [
  "vendi"
 ],
 "toWin": [
  "per vincere",
  "pagamento"
 ],
 "shares": [
  "quote",
  "contratti"
 ],
 "avgPrice": [
  "prezzo medio"
 ],
 "fee": [
  "commissione",
  "commissioni"
 ],
 "pmPlace": [
  "fai trading",
  "compra sì",
  "compra no",
  "invia ordine"
 ]
};
