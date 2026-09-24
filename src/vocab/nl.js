/* Doinp Bet Logger — detection words: Nederlands (nl).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["nl"] = {
 "place": [
  "plaats weddenschap",
  "weddenschap plaatsen",
  "plaats inzet",
  "inzet plaatsen",
  "nu wedden",
  "wedden",
  "bevestig weddenschap"
 ],
 "receipt": [
  "weddenschap geplaatst",
  "weddenschap geaccepteerd",
  "weddenschap bevestigd",
  "inzet geplaatst",
  "je weddenschap is",
  "uw weddenschap is",
  "weddenschap-id",
  "wednummer",
  "bon"
 ],
 "error": [
  "onvoldoende saldo",
  "fout",
  "geweigerd",
  "afgewezen",
  "niet mogelijk",
  "odds zijn gewijzigd",
  "de odds zijn veranderd",
  "markt opgeschort",
  "markt gesloten",
  "maximale inzet",
  "log in"
 ],
 "stake": [
  "inzet",
  "totale inzet",
  "bedrag"
 ],
 "ret": [
  "mogelijke winst",
  "potentiële winst",
  "mogelijke uitbetaling",
  "uitbetaling",
  "winst"
 ],
 "totalOdds": [
  "totale odds",
  "totale quotering"
 ],
 "live": [
  "live"
 ],
 "parlay": [
  "combinatie",
  "combi",
  "meervoudig",
  "accumulator"
 ],
 "types": [
  "enkel",
  "enkelvoudig",
  "combinatie",
  "systeem"
 ],
 "market": [
  "wedstrijdresultaat",
  "winnaar",
  "handicap",
  "aziatische handicap",
  "meer dan",
  "minder dan",
  "over",
  "onder",
  "doelpunten",
  "hoekschoppen",
  "kaarten",
  "beide teams scoren",
  "dubbele kans",
  "gelijkspel geen weddenschap",
  "juiste score",
  "rust",
  "speler",
  "punten",
  "map"
 ],
 "status": {
  "gewonnen": "won",
  "verloren": "lost",
  "geannuleerd": "void",
  "ongeldig": "void",
  "terugbetaald": "void",
  "open": "pending",
  "lopend": "pending",
  "uitbetaald": "cashout"
 },
 "halfWon": [
  "half gewonnen"
 ],
 "halfLost": [
  "half verloren"
 ],
 "noise": [
  "verwijderen",
  "sluiten",
  "alles wissen",
  "bewerken"
 ],
 "history": [
  "mijn weddenschappen",
  "geschiedenis",
  "open weddenschappen"
 ],
 "months": {
  "januari": 1,
  "februari": 2,
  "maart": 3,
  "mrt": 3,
  "april": 4,
  "mei": 5,
  "juni": 6,
  "juli": 7,
  "augustus": 8,
  "september": 9,
  "oktober": 10,
  "okt": 10,
  "november": 11,
  "december": 12
 },
 "today": [
  "vandaag"
 ],
 "yesterday": [
  "gisteren"
 ],
 "back": [
  "back",
  "voor"
 ],
 "lay": [
  "lay",
  "tegen"
 ],
 "liability": [
  "aansprakelijkheid",
  "risico"
 ],
 "yes": [
  "ja"
 ],
 "no": [
  "nee"
 ],
 "buy": [
  "kopen"
 ],
 "sell": [
  "verkopen"
 ],
 "toWin": [
  "te winnen",
  "uitbetaling"
 ],
 "shares": [
  "aandelen",
  "contracten"
 ],
 "avgPrice": [
  "gemiddelde prijs"
 ],
 "fee": [
  "kosten",
  "commissie"
 ],
 "pmPlace": [
  "handelen",
  "koop ja",
  "koop nee",
  "order plaatsen"
 ]
};
