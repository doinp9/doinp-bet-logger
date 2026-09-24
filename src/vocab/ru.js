/* Doinp Bet Logger — detection words: Русский (ru).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["ru"] = {
 "placeVerb": [
  "сделать",
  "подтвердить",
  "поставить",
  "заключить"
 ],
 "betNoun": [
  "ставку",
  "ставки",
  "ставок",
  "пари"
 ],
 "place": [
  "сделать ставку",
  "поставить",
  "заключить пари",
  "подтвердить ставку",
  "сделать ставки"
 ],
 "receipt": [
  "ставка принята",
  "ставка сделана",
  "ставка подтверждена",
  "ваша ставка принята",
  "пари заключено",
  "номер ставки",
  "номер купона",
  "купон принят"
 ],
 "error": [
  "недостаточно средств",
  "недостаточно денег",
  "ошибка",
  "отклонена",
  "не удалось",
  "коэффициент изменился",
  "коэффициенты изменились",
  "рынок приостановлен",
  "событие закрыто",
  "максимальная ставка",
  "войдите"
 ],
 "stake": [
  "сумма ставки",
  "сумма",
  "ставка",
  "общая сумма"
 ],
 "ret": [
  "возможный выигрыш",
  "потенциальный выигрыш",
  "выигрыш",
  "выплата"
 ],
 "totalOdds": [
  "общий коэффициент",
  "итоговый коэффициент"
 ],
 "live": [
  "лайв",
  "live",
  "в игре"
 ],
 "parlay": [
  "экспресс",
  "система",
  "комбинированная"
 ],
 "types": [
  "ординар",
  "одиночная",
  "экспресс",
  "система"
 ],
 "market": [
  "исход матча",
  "победитель",
  "фора",
  "азиатская фора",
  "тотал",
  "больше",
  "меньше",
  "голы",
  "угловые",
  "карточки",
  "обе забьют",
  "двойной шанс",
  "точный счёт",
  "тайм",
  "игрок",
  "очки",
  "карта"
 ],
 "status": {
  "выигрыш": "won",
  "выиграла": "won",
  "выигрышная": "won",
  "проигрыш": "lost",
  "проиграла": "lost",
  "проигрышная": "lost",
  "возврат": "void",
  "аннулирована": "void",
  "отменена": "void",
  "не рассчитана": "pending",
  "в игре": "pending",
  "открыта": "pending",
  "продана": "cashout",
  "выкуп": "cashout"
 },
 "halfWon": [
  "выигрыш наполовину",
  "половина выигрыша"
 ],
 "halfLost": [
  "проигрыш наполовину",
  "половина проигрыша"
 ],
 "noise": [
  "удалить",
  "закрыть",
  "очистить",
  "изменить"
 ],
 "history": [
  "мои ставки",
  "история ставок",
  "история",
  "открытые ставки"
 ],
 "months": {
  "января": 1,
  "янв": 1,
  "февраля": 2,
  "фев": 2,
  "марта": 3,
  "мар": 3,
  "апреля": 4,
  "апр": 4,
  "мая": 5,
  "июня": 6,
  "июн": 6,
  "июля": 7,
  "июл": 7,
  "августа": 8,
  "авг": 8,
  "сентября": 9,
  "сен": 9,
  "октября": 10,
  "окт": 10,
  "ноября": 11,
  "ноя": 11,
  "декабря": 12,
  "дек": 12
 },
 "today": [
  "сегодня"
 ],
 "yesterday": [
  "вчера"
 ],
 "back": [
  "за",
  "back"
 ],
 "lay": [
  "против",
  "lay"
 ],
 "liability": [
  "ответственность",
  "риск"
 ],
 "yes": [
  "да"
 ],
 "no": [
  "нет"
 ],
 "buy": [
  "купить"
 ],
 "sell": [
  "продать"
 ],
 "toWin": [
  "к выигрышу",
  "выплата"
 ],
 "shares": [
  "акции",
  "контракты"
 ],
 "avgPrice": [
  "средняя цена"
 ],
 "fee": [
  "комиссия"
 ],
 "pmPlace": [
  "торговать",
  "купить да",
  "купить нет",
  "отправить ордер"
 ]
};
