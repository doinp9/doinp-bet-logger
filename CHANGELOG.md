# Changelog

Newest first.

## 0.7.4 · bets without a date can be exported and sent

- **The problem:** Bet365's My Bets page often shows no date the extension can read. Those
  bets were stuck in Review, and neither Export CSV nor Send to tracker would take them.
- **The fix:** they are now exported and sent like any other bet. The tracker gives them the
  import day, and you correct the date there if needed. Tested end to end: two undated Bet365
  bets imported into the tracker with the import day.
- **Wording:** the card shows this as information, not a warning. After an export, the message
  says how many bets had no date.

## 0.7.3 · bet histories laid out as tables (Pinnacle)

- **Pinnacle's "Histórico de apostas" was read wrong,** because it is a table with column
  headers and the reader treated each row as a free-form card. Four symptoms:
  - A win's profit ("127.88") looked like a second price, so wins came out as 2-leg parlays
    (1.775 × 127.88 = 226.99) and were marked lost.
  - Titles collected every cell on the row ("9 Apostas esportivas Futebol Wolverhampton…").
  - "A -vs- B" teams weren't split.
  - "AO VIVO" and the score "[0-0]" stayed in the market and the selection.
- **New column reader.** When a history page has a header row with odds and stake columns
  ("Probabilidades", "Aposta (BRL)", plus Seleção / Status / Vitória-derrota), every value is
  read from its own column. This works for `<table>` and for div grids.
- **Results are proven by the money:** return = stake + profit/loss, checked against the
  odds.
- **Pending bets still settle:** a pending bet saved earlier is settled by the history and not
  duplicated.
- **Also fixed:** "Team -vs- Team" is split, the live tag sets the live flag, and bracketed
  scores are removed from selections.

## 0.7.2 · place-bet buttons by grammar, confirmations as a second path, learning

- **Cause of the Pinnacle miss:** its buttons read "CONFIRM 1 SINGLE BET" / "CONFIRMAR 1 SIMPLES
  APOSTA". Only fixed phrases like "Confirm bet" were recognised, so the press was ignored.
- **Buttons are recognised by grammar:** a place verb, up to three words, then a bet noun, in 10
  languages. That covers "Confirm 1 single bet", "Place 2 bets", "Confirmar 3 apostas
  múltiplas" and "Wette jetzt platzieren". History links ("My Bets", "Minhas apostas") still
  never count.
- **A click counts only if its slip has a stake typed in,** so a "Place your bets" banner never
  becomes a bet.
- **Second path: the confirmation.** If a book's button still isn't recognised, the bet is
  caught when the book confirms it inside the slip. Both conditions are required:
  - the confirmation mentions a bet ("Bet Accepted", "Aceitar aposta", …);
  - the area looks like a bet slip (a stake label or slip markup).

  A shop's "Place order" → "Order placed" is never logged (tested).
- **Learning:** an unrecognised button pressed inside a slip and followed by a confirmation
  becomes that site's place-bet button. Diagnostics shows the click and the learned label.
- **Pinnacle's "Total Win" / "Total Ganho"** is read as winnings, so the return check works on
  the logged-in slip.

## 0.7.1 · Pinnacle, and tabs left open during an update

- **Tabs open during an install or update now work.** Chrome doesn't put a new or updated
  extension into tabs that are already open. The old copy in such a tab can't report anything,
  so a sportsbook left open during an update detected nothing until the page was reloaded. The
  extension now injects itself into open tabs when installed or updated, and an old copy steps
  aside.
- **Pinnacle:**
  - Receipts now recognised: pinnacle.bet.br's "Aceitar aposta" and "Aposta aceita", and "1
    aposta(s) realizada(s)" / "1 Bet(s) Placed".
  - The stake label "Risco" is now read.
  - "Win" / "Ganho" is read as the winnings (stake × (odds − 1)) rather than the return, so the
    return check passes.
  - Tested on a page that copies pinnacle.com's real slip (Stake and Win boxes, Payout).

## 0.7.0

See the README: exchanges (back / lay, liability, commission), prediction markets (Polymarket, Kalshi), detection words in 13 languages, 5 more interface languages (fr, tr, pl, ru, nl), open-source release with a no-network guarantee.

Fixes found while testing:
- **Test snapshot:** when no slip was found, the page's input values were recorded, which
  could include a typed e-mail or password. Only number fields are recorded now.
- **Receipts:** a receipt that shows no prices made the extension re-read the page's odds grid.
  On one test page that turned odds of 1.85 into 30.303 (1.85 × 3.90 × 4.20). Receipt prices
  are now accepted only when they're close to the slip's.
- **"Profit: £15.00":** lines like this lost their amount and were read as text. A number right
  after a currency sign is no longer treated as a price.
- **Team order:** when the selection is also one of the teams, the teams could come out
  reversed. The line that carried the price is the one removed now.

## 0.6.0 · four more interface languages

- **German (de), Italian (it), Simplified Chinese (zh) and Japanese (ja).** The interface now
  has 8 languages: pt, en, es, ko, de, it, zh, ja.
- **Auto** picks the language from the browser's UI language. Tested by launching Chromium
  in each language: de → German, it → Italian, zh-CN → Chinese, ja → Japanese.
- Traditional-Chinese browsers (zh-TW, zh-HK) get Simplified Chinese.
- Dates and money are formatted for each language (de-DE, it-IT, zh-CN, ja-JP).
- The unit test now also checks that every translation keeps the same `{placeholders}` and
  `<b>` tags as English.
- **All 4 new files are machine-assisted.** Have a native speaker review them before
  publishing, as with es and ko.
- **Limitation: detection still reads Portuguese and English pages only.** The words that
  detection relies on are listed in `src/lib/parse.js` (`V`, `STATUS`):
  - the place-bet button;
  - the receipt;
  - error messages;
  - Stake / Return labels;
  - My Bets results.

  A sportsbook shown in German, Italian, Spanish, Korean, Chinese or Japanese is not
  recognised by those words. The interface language doesn't change this. Adding a language
  to detection needs that book's real wording: send a **Test snapshot** and the
  **Diagnostics** log from it.

## 0.5.0 · pending bets wait for their result

- **Saving a pending bet holds it until it settles.** It goes to **Histórico → Pendentes** (a
  compact list, one row per bet) instead of staying as a large card in Revisar.
- **How a pending bet settles:** open **My Bets / Minhas apostas** on the book, then use
  **Capturar → Importar desta página**. When the extension reads that bet with a result:
  - the held bet gets the result (won, lost, ½ won, void, and so on);
  - it moves to **Para exportar** (CSV mode), or goes to the tracker (tracker mode);
  - it is never removed and never added twice. The match allows a different date, because
    Bet365's history can show the settle date instead of the placement date.
- **Exportar mesmo assim** in Pendentes exports the held bets now, as "Pendente".
- **A bet you already exported that settles later** gets the result recorded in the log with a
  "Resultado lido depois da exportação" warning. The tracker must be updated by hand for that
  bet.
- **History tabs:** Pendentes · Para exportar · No tracker · Exportadas · Descartadas · Todas,
  with a count on each.
- **Auto language follows the browser's UI language:**
  - Portuguese → Portuguese, English → English, Spanish → Spanish, Korean → Korean;
  - any other language falls back to English until a file for it is added;
  - **Ajustes → Idioma** can force one.
  - `es.js` and `ko.js` were machine-assisted, so they need a native speaker's review.
- **Adding a language:**
  1. Copy `src/i18n/en.js` to `src/i18n/<code>.js` (for example `de.js`).
  2. Change `["en"]` to `["de"]`, set `"lang.name"`, and translate the values.
  3. Add the file to the script lists in `src/background.js` (`importScripts`),
     `src/popup/popup.html` and `manifest.firefox.json`, and add a date locale to `LOCALES` in
     `popup.js` and `background.js`.
  4. `node --test test/unit.test.js` checks that no key is missing.

## 0.4.1

- **Revisar:** every card and the selection bar now have two full-size buttons:
  - **Exportar CSV** (the main button). It downloads the CSV straight away and moves those
    bets to the log as "CSV".
  - **Enviar ao tracker** (the second button).
- Choosing **Ajustes → Exportação → Meu betting tracker** swaps the two buttons, in Revisar
  and in Histórico.
- **Copiar CSV** is a proper button in the selection bar, next to Descartar.
- Bets without a date are left out of an export, with a warning, because the tracker would
  give them today's date.

## 0.4.0 · export options

- **Two ways to export saved bets**, chosen in **Ajustes → Exportação**:
  1. **Arquivo CSV (padrão).** Saved bets wait in **Histórico → Salvas**. **Exportar CSV**
     downloads one file with all of them, which you import in the tracker (Apostas →
     Importar → arquivo). Exported bets move to the log as "CSV".
  2. **Meu betting tracker.** Saving a bet (in the popup or from the notification) sends it
     to the tracker. The next time the tracker page is open with a file loaded, an inbox lists
     the bets and **Adicionar** puts them in. That's one click instead of the export/import
     round trip.
- The other option is always available as the second button in Histórico, so you can send
  one batch to the tracker even when CSV is the default, or the reverse.
- **The tracker side isn't installed yet.** Option 2 needs `integration/bridge-inbox.jsx`
  added to the website, which is 1 new file and 2 one-line edits (see
  `integration/INTEGRATION.md`). Until then, CSV is the working route.
- **Bet365 reading fixes:**
  - "1 GB Packers Selections" is now read as "GB Packers" (the slip's count header is ignored);
  - "Under 11.5 11.5" becomes "Under 11.5";
  - the same team is never used twice ("HOU Astros x HOU Astros");
  - "To Win Match", "Winner", "Run line" and similar are read as markets, not teams;
  - "R$" and the amount on separate lines are read together, so the currency shows.

## 0.3.0 · works out of the box

- **No permission prompt and no "enable" step.** In 0.2, "Ativar neste site" asked the
  browser for permission, and Chrome most likely closed the popup when its dialog opened, so
  the site was never saved (I can't reproduce Chrome's prompt here to confirm this). Site
  access is now granted when the extension is installed, and detection works on any
  sportsbook right away.
- **Automatic on any book, with a pause per site.** The top of the popup shows
  **Pausar aqui / Retomar**. A book is added to **Ajustes → Casas de apostas** the first time
  a bet is detected there, so you can rename it or set its odds format.
- **Optional stricter mode:** Ajustes → Onde detectar → **Só nas casas que eu ativar**. With
  that on, the extension only reads the books switched on in the list, and "Ativar" at the top
  is instant.
- **Capturar works on any page,** with nothing to enable first.
- **Safety:** English "Place …" only counts when followed by bet or wager, so "Place order" on
  a shop is never read as a bet. On sites that aren't sportsbooks, the extension does nothing
  unless you press a control labelled like a bet.
- **New icon:** the Doinp "D" logo (`icons/logo.png`, used everywhere). It's a vector redraw
  of the image you sent (`icons/logo.svg`). To use your exact image, crop it to the rounded
  square and save it over `icons/logo.png` (a square PNG of at least 128 px), then click ↻ on
  the extension.
- **Chrome listing:** Chrome now shows "Read and change all your data on all websites" for
  the extension. That access is what removes the prompt. The extension still only reads
  pages, never changes them, and sends nothing anywhere. If detection stops, check
  `chrome://extensions` → Doinp Bet Logger → Details → **Site access**: it must be
  **On all sites**.

## 0.2.0

| Reported | Cause | Fix |
|---|---|---|
| Duplicated bet: single read as "Parlay · 2 legs", odds 2.756 | The site draws "R$" and "1.66" as separate elements, so "To Return R$1.66" was read as a second price | A number right after a currency sign, or under a Stake / Return label, is treated as money, never as a price |
| Nothing detected automatically; only "Manual" worked | The place-bet control was a plain `div`, not a real button, so the click wasn't recognised | Any element whose label says "Place bet" / "Apostar" counts. Pressing the pointer and pressing Enter in the stake box also count |
| Asian handicap: "Return doesn't match" | "½ Won ½ Void" wasn't read. 30 × 1.925 = 57.75 ≠ 43.88 | The result is read from the tags and proven from the return: 43.88 = 15 × 1.925 + 15 → **½ ganho**. Every card now says in words why the numbers add up |
| Selection "R$", no date, teams missing | A lone currency sign was taken as the selection. Teams on separate lines and dates in group headers weren't read | The selection comes from the text on the same row as the price. Two name lines become the teams. The date is read from the nearest header above the card. If there's still no date, the card asks for one before saving |
| "3 bets added from history" but only 1 in the queue | Three saves ran at the same time and overwrote each other | All storage changes now run one at a time |
