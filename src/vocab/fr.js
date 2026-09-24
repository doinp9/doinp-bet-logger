/* Doinp Bet Logger — detection words: Français (fr).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["fr"] = {
 "place": [
  "parier",
  "placer le pari",
  "placer les paris",
  "placer un pari",
  "valider le pari",
  "valider mon pari",
  "confirmer le pari",
  "miser"
 ],
 "receipt": [
  "pari placé",
  "pari enregistré",
  "pari accepté",
  "pari validé",
  "paris placés",
  "votre pari a été",
  "référence du pari",
  "numéro de pari",
  "reçu"
 ],
 "error": [
  "solde insuffisant",
  "fonds insuffisants",
  "erreur",
  "refusé",
  "impossible de",
  "la cote a changé",
  "les cotes ont changé",
  "marché suspendu",
  "marché fermé",
  "mise maximale",
  "veuillez vous connecter"
 ],
 "stake": [
  "mise",
  "mise totale",
  "montant"
 ],
 "ret": [
  "gain potentiel",
  "gains potentiels",
  "gains possibles",
  "retour",
  "paiement",
  "gain"
 ],
 "totalOdds": [
  "cote totale",
  "cotes totales"
 ],
 "live": [
  "en direct",
  "live"
 ],
 "parlay": [
  "combiné",
  "pari combiné",
  "multiple",
  "accumulateur"
 ],
 "types": [
  "simple",
  "combiné",
  "système"
 ],
 "market": [
  "résultat du match",
  "vainqueur",
  "vainqueur du match",
  "handicap",
  "handicap asiatique",
  "plus de",
  "moins de",
  "total de buts",
  "buts",
  "corners",
  "cartons",
  "les deux équipes marquent",
  "double chance",
  "remboursé si match nul",
  "score exact",
  "mi-temps",
  "joueur",
  "points",
  "carte"
 ],
 "status": {
  "gagné": "won",
  "gagnant": "won",
  "perdu": "lost",
  "perdant": "lost",
  "annulé": "void",
  "remboursé": "void",
  "en cours": "pending",
  "en attente": "pending",
  "ouvert": "pending",
  "cash out effectué": "cashout",
  "encaissé": "cashout"
 },
 "halfWon": [
  "moitié gagné",
  "demi gagné"
 ],
 "halfLost": [
  "moitié perdu",
  "demi perdu"
 ],
 "noise": [
  "supprimer",
  "fermer",
  "tout effacer",
  "modifier",
  "retirer"
 ],
 "history": [
  "mes paris",
  "historique",
  "paris en cours"
 ],
 "months": {
  "janvier": 1,
  "janv": 1,
  "février": 2,
  "févr": 2,
  "mars": 3,
  "avril": 4,
  "avr": 4,
  "mai": 5,
  "juin": 6,
  "juillet": 7,
  "juil": 7,
  "août": 8,
  "septembre": 9,
  "octobre": 10,
  "novembre": 11,
  "décembre": 12,
  "déc": 12
 },
 "today": [
  "aujourd'hui"
 ],
 "yesterday": [
  "hier"
 ],
 "back": [
  "pour",
  "parier pour"
 ],
 "lay": [
  "contre",
  "parier contre"
 ],
 "liability": [
  "responsabilité",
  "risque"
 ],
 "yes": [
  "oui"
 ],
 "no": [
  "non"
 ],
 "buy": [
  "acheter"
 ],
 "sell": [
  "vendre"
 ],
 "toWin": [
  "pour gagner",
  "paiement"
 ],
 "shares": [
  "parts",
  "contrats"
 ],
 "avgPrice": [
  "prix moyen"
 ],
 "fee": [
  "frais",
  "commission"
 ],
 "pmPlace": [
  "trader",
  "acheter oui",
  "acheter non",
  "passer l'ordre"
 ]
};
