/* Doinp Bet Logger — detection words: Español (es).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["es"] = {
 "place": [
  "realizar apuesta",
  "realizar apuestas",
  "hacer apuesta",
  "apostar",
  "apuesta ya",
  "confirmar apuesta",
  "colocar apuesta",
  "enviar apuesta"
 ],
 "receipt": [
  "apuesta realizada",
  "apuesta aceptada",
  "apuesta confirmada",
  "apuestas realizadas",
  "tu apuesta ha sido",
  "comprobante",
  "id de apuesta",
  "número de apuesta",
  "referencia de la apuesta"
 ],
 "error": [
  "saldo insuficiente",
  "fondos insuficientes",
  "error",
  "rechazada",
  "no se pudo",
  "la cuota ha cambiado",
  "las cuotas han cambiado",
  "cuotas cambiaron",
  "mercado suspendido",
  "mercado cerrado",
  "apuesta máxima",
  "inicia sesión"
 ],
 "stake": [
  "importe",
  "apuesta",
  "importe total",
  "total apostado",
  "cantidad"
 ],
 "ret": [
  "ganancia potencial",
  "ganancias potenciales",
  "posibles ganancias",
  "retorno potencial",
  "retorno",
  "pago",
  "ganancias"
 ],
 "totalOdds": [
  "cuota total",
  "cuotas totales"
 ],
 "live": [
  "en vivo",
  "en directo"
 ],
 "parlay": [
  "combinada",
  "múltiple",
  "acumulada",
  "parlay"
 ],
 "types": [
  "sencilla",
  "simple",
  "combinada",
  "múltiple",
  "sistema"
 ],
 "market": [
  "resultado final",
  "ganador del partido",
  "ganador",
  "hándicap",
  "handicap asiático",
  "más de",
  "menos de",
  "total de goles",
  "goles",
  "córners",
  "tarjetas",
  "ambos equipos marcan",
  "doble oportunidad",
  "empate apuesta no válida",
  "resultado exacto",
  "descanso",
  "primera mitad",
  "jugador",
  "puntos",
  "mapa"
 ],
 "status": {
  "ganada": "won",
  "ganó": "won",
  "perdida": "lost",
  "perdió": "lost",
  "anulada": "void",
  "cancelada": "void",
  "reembolsada": "void",
  "devuelta": "void",
  "abierta": "pending",
  "pendiente": "pending",
  "en curso": "pending",
  "cobrada": "cashout",
  "cash out realizado": "cashout"
 },
 "halfWon": [
  "medio ganada",
  "mitad ganada"
 ],
 "halfLost": [
  "medio perdida",
  "mitad perdida"
 ],
 "noise": [
  "eliminar",
  "cerrar",
  "borrar todo",
  "editar",
  "quitar"
 ],
 "history": [
  "mis apuestas",
  "historial",
  "apuestas abiertas"
 ],
 "months": {
  "enero": 1,
  "ene": 1,
  "febrero": 2,
  "marzo": 3,
  "abril": 4,
  "mayo": 5,
  "junio": 6,
  "julio": 7,
  "agosto": 8,
  "septiembre": 9,
  "setiembre": 9,
  "octubre": 10,
  "noviembre": 11,
  "diciembre": 12,
  "dic": 12
 },
 "today": [
  "hoy"
 ],
 "yesterday": [
  "ayer"
 ],
 "back": [
  "a favor"
 ],
 "lay": [
  "en contra"
 ],
 "liability": [
  "riesgo",
  "responsabilidad"
 ],
 "yes": [
  "sí"
 ],
 "no": [
  "no"
 ],
 "buy": [
  "comprar"
 ],
 "sell": [
  "vender"
 ],
 "toWin": [
  "para ganar",
  "pago"
 ],
 "shares": [
  "acciones",
  "contratos"
 ],
 "avgPrice": [
  "precio medio"
 ],
 "fee": [
  "comisión",
  "tarifa"
 ],
 "pmPlace": [
  "operar",
  "comprar sí",
  "comprar no",
  "enviar orden"
 ]
};
