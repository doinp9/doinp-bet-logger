/* Doinp Bet Logger — detection words: Polski (pl).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["pl"] = {
 "place": [
  "postaw zakład",
  "postaw",
  "obstaw",
  "zatwierdź zakład",
  "złóż zakład",
  "graj"
 ],
 "receipt": [
  "zakład przyjęty",
  "zakład postawiony",
  "zakład zaakceptowany",
  "twój zakład został",
  "kupon przyjęty",
  "numer kuponu",
  "id zakładu",
  "potwierdzenie"
 ],
 "error": [
  "niewystarczające środki",
  "brak środków",
  "za mało środków",
  "błąd",
  "odrzucony",
  "nie udało się",
  "kurs się zmienił",
  "kursy się zmieniły",
  "rynek zawieszony",
  "rynek zamknięty",
  "maksymalna stawka",
  "zaloguj się"
 ],
 "stake": [
  "stawka",
  "stawka całkowita",
  "kwota"
 ],
 "ret": [
  "możliwa wygrana",
  "potencjalna wygrana",
  "wygrana",
  "wypłata"
 ],
 "totalOdds": [
  "kurs całkowity",
  "kurs łączny"
 ],
 "live": [
  "na żywo",
  "live"
 ],
 "parlay": [
  "kupon ako",
  "ako",
  "akumulator",
  "zakład łączony",
  "kombinacja"
 ],
 "types": [
  "pojedynczy",
  "solo",
  "ako",
  "system"
 ],
 "market": [
  "wynik meczu",
  "zwycięzca",
  "handicap",
  "handicap azjatycki",
  "powyżej",
  "poniżej",
  "gole",
  "rzuty rożne",
  "kartki",
  "obie drużyny strzelą",
  "podwójna szansa",
  "zakład bez remisu",
  "dokładny wynik",
  "połowa",
  "zawodnik",
  "punkty",
  "mapa"
 ],
 "status": {
  "wygrany": "won",
  "wygrana": "won",
  "przegrany": "lost",
  "przegrana": "lost",
  "anulowany": "void",
  "zwrot": "void",
  "zwrócony": "void",
  "otwarty": "pending",
  "w toku": "pending",
  "oczekujący": "pending",
  "wypłacony": "cashout"
 },
 "halfWon": [
  "połowa wygrana",
  "pół wygranej"
 ],
 "halfLost": [
  "połowa przegrana",
  "pół przegranej"
 ],
 "noise": [
  "usuń",
  "zamknij",
  "wyczyść",
  "edytuj"
 ],
 "history": [
  "moje zakłady",
  "historia",
  "otwarte zakłady"
 ],
 "months": {
  "stycznia": 1,
  "styczeń": 1,
  "sty": 1,
  "lutego": 2,
  "luty": 2,
  "lut": 2,
  "marca": 3,
  "marzec": 3,
  "kwietnia": 4,
  "kwiecień": 4,
  "kwi": 4,
  "maja": 5,
  "maj": 5,
  "czerwca": 6,
  "czerwiec": 6,
  "cze": 6,
  "lipca": 7,
  "lipiec": 7,
  "lip": 7,
  "sierpnia": 8,
  "sierpień": 8,
  "sie": 8,
  "września": 9,
  "wrzesień": 9,
  "wrz": 9,
  "października": 10,
  "październik": 10,
  "paź": 10,
  "listopada": 11,
  "listopad": 11,
  "lis": 11,
  "grudnia": 12,
  "grudzień": 12,
  "gru": 12
 },
 "today": [
  "dzisiaj",
  "dziś"
 ],
 "yesterday": [
  "wczoraj"
 ],
 "back": [
  "za",
  "back"
 ],
 "lay": [
  "przeciw",
  "lay"
 ],
 "liability": [
  "zobowiązanie",
  "ryzyko"
 ],
 "yes": [
  "tak"
 ],
 "no": [
  "nie"
 ],
 "buy": [
  "kup"
 ],
 "sell": [
  "sprzedaj"
 ],
 "toWin": [
  "do wygrania",
  "wypłata"
 ],
 "shares": [
  "udziały",
  "kontrakty"
 ],
 "avgPrice": [
  "średnia cena"
 ],
 "fee": [
  "opłata",
  "prowizja"
 ],
 "pmPlace": [
  "handluj",
  "kup tak",
  "kup nie",
  "złóż zlecenie"
 ]
};
