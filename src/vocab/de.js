/* Doinp Bet Logger — detection words: Deutsch (de).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["de"] = {
 "placeVerb": [
  "platzieren",
  "abgeben",
  "bestätigen",
  "abschließen",
  "abschicken"
 ],
 "betNoun": [
  "wette",
  "wetten",
  "tipp",
  "tipps",
  "wettschein"
 ],
 "place": [
  "wette platzieren",
  "wetten platzieren",
  "jetzt wetten",
  "wette abgeben",
  "tipp abgeben",
  "wette abschließen",
  "wette bestätigen",
  "wetten"
 ],
 "receipt": [
  "wette platziert",
  "wette angenommen",
  "wette bestätigt",
  "wetten platziert",
  "ihre wette wurde",
  "deine wette wurde",
  "wettschein-nr",
  "wettnummer",
  "wett-id",
  "wettbestätigung"
 ],
 "error": [
  "unzureichendes guthaben",
  "nicht genügend guthaben",
  "guthaben reicht nicht",
  "fehler",
  "abgelehnt",
  "nicht möglich",
  "quote hat sich geändert",
  "quoten haben sich geändert",
  "markt gesperrt",
  "markt geschlossen",
  "maximaler einsatz",
  "bitte einloggen",
  "bitte anmelden"
 ],
 "stake": [
  "einsatz",
  "gesamteinsatz",
  "wetteinsatz",
  "betrag"
 ],
 "ret": [
  "möglicher gewinn",
  "mögliche auszahlung",
  "potenzieller gewinn",
  "auszahlung",
  "gewinn"
 ],
 "totalOdds": [
  "gesamtquote",
  "kombiquote"
 ],
 "live": [
  "live"
 ],
 "parlay": [
  "kombi",
  "kombiwette",
  "mehrfachwette",
  "akku"
 ],
 "types": [
  "einzel",
  "einzelwette",
  "kombi",
  "kombiwette",
  "system",
  "systemwette"
 ],
 "market": [
  "spielausgang",
  "sieger",
  "siegwette",
  "handicap",
  "asiatisches handicap",
  "über",
  "unter",
  "tore",
  "anzahl tore",
  "ecken",
  "karten",
  "beide teams treffen",
  "doppelte chance",
  "unentschieden keine wette",
  "genaues ergebnis",
  "halbzeit",
  "spieler",
  "punkte",
  "karte"
 ],
 "status": {
  "gewonnen": "won",
  "verloren": "lost",
  "storniert": "void",
  "ungültig": "void",
  "erstattet": "void",
  "offen": "pending",
  "ausstehend": "pending",
  "ausgezahlt": "cashout",
  "cash-out": "cashout"
 },
 "halfWon": [
  "halb gewonnen"
 ],
 "halfLost": [
  "halb verloren"
 ],
 "noise": [
  "entfernen",
  "schließen",
  "alle entfernen",
  "bearbeiten",
  "löschen"
 ],
 "history": [
  "meine wetten",
  "wettverlauf",
  "offene wetten"
 ],
 "months": {
  "januar": 1,
  "jan": 1,
  "februar": 2,
  "feb": 2,
  "märz": 3,
  "mär": 3,
  "april": 4,
  "apr": 4,
  "mai": 5,
  "juni": 6,
  "juli": 7,
  "august": 8,
  "aug": 8,
  "september": 9,
  "sept": 9,
  "oktober": 10,
  "okt": 10,
  "november": 11,
  "dezember": 12,
  "dez": 12
 },
 "today": [
  "heute"
 ],
 "yesterday": [
  "gestern"
 ],
 "back": [
  "back",
  "dafür"
 ],
 "lay": [
  "lay",
  "dagegen"
 ],
 "liability": [
  "haftung",
  "risiko"
 ],
 "yes": [
  "ja"
 ],
 "no": [
  "nein"
 ],
 "buy": [
  "kaufen"
 ],
 "sell": [
  "verkaufen"
 ],
 "toWin": [
  "gewinn",
  "auszahlung"
 ],
 "shares": [
  "anteile",
  "kontrakte"
 ],
 "avgPrice": [
  "durchschnittspreis"
 ],
 "fee": [
  "gebühr",
  "gebühren",
  "provision"
 ],
 "pmPlace": [
  "handeln",
  "ja kaufen",
  "nein kaufen",
  "order senden"
 ]
};
