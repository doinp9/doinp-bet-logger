# Doinp Bet Logger

A browser extension (Chrome, Edge, Brave, Opera, Firefox · Manifest V3) that notices the bets
you place and logs them for you. It works on sportsbooks, betting exchanges (back / lay) and
prediction markets (Polymarket, Kalshi). It then exports them to a CSV file or to the
[Doinp betting tracker](https://doinp.com.br/tools/betting-tracker).

It reads pages. It never clicks, types, submits or sends anything, and it has no server.
**It collects no data:** everything stays in your browser. The code is here so you can check.
Portuguese install guide: [LEIA-ME.md](LEIA-ME.md).

Version 0.7.0 · [changelog](CHANGELOG.md) · [privacy](PRIVACY.md) · MIT license

---

## Privacy: what the extension can and cannot do

| | |
|---|---|
| **Reads** | the text of the page you're on, when you press a "place bet" control or use the popup. |
| **Stores** | the bets you keep, your settings and a short detection log, in `storage.local`. That is your browser profile on your device. Removing the extension deletes it; **Settings → Delete all data** clears it at any time. |
| **Sends** | nothing. There is no server, account, analytics, telemetry, tracking pixel or remote code. |
| **Changes on the page** | nothing. It adds no elements, clicks nothing, types nothing and makes no requests to the site. It runs in the browser's isolated extension world, so the page's own scripts can't see it. |

This is enforced, not just promised:

- **The browser blocks network access.** The extension pages have the content-security policy
  `connect-src 'none'` (see `manifest.json`). The popup and background can't open a
  connection even if code tried.
- **A test fails if network code appears.** `test/markets.test.js` fails if any file in
  `src/` contains `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource` or a
  remote script.
- **Firefox shows it at install:** the Firefox manifest declares
  `data_collection_permissions: { required: ["none"] }`.
- **Tracker hand-off stays in the browser.** The only hand-off is to the tracker page, when
  you open it and confirm. It goes page to page, with no network involved.

Why it asks for access to all websites: sportsbooks live on thousands of domains. Without that
permission, you would have to approve each book by hand, and Chrome closes the popup while
it asks. The access is only used to read the page, as described above.

**Your sportsbook account:** the extension only reads what is already on your screen, so the
site sees exactly the same traffic as without it. Each book's terms are its own; read them for
the books you use.

---

## Install from GitHub

Download this repository (**Code → Download ZIP**) and unzip it, or `git clone` it.

**Chrome, Edge, Brave, Opera**
1. Open `chrome://extensions` (Edge: `edge://extensions`) and turn on **Developer mode**.
2. Click **Load unpacked** and choose the unzipped folder (the one with `manifest.json`).
3. To update: replace the folder with the new version and click ↻ on the extension card. Your
   data stays.

Chrome may show a banner about developer-mode extensions at startup. That is expected for
extensions installed outside the Chrome Web Store.

**Firefox.** Mozilla only lets release and beta Firefox install extensions it has signed
([Mozilla: signing and distribution](https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/)).
Three ways to install:
- **Try it:** run `.\package.ps1` (it creates `dist\firefox`), then open
  `about:debugging#/runtime/this-firefox` → **Load Temporary Add-on** → `dist\firefox\manifest.json`.
  It stays until Firefox restarts.
- **Keep it, no signing:** use Firefox Developer Edition, Nightly or ESR. Set
  `xpinstall.signatures.required` to `false` in `about:config`, then install the zip from
  `dist\`.
- **Keep it on normal Firefox:** this needs Mozilla's signature. *Unlisted* (self-distribution)
  signing gives one without publishing the add-on on addons.mozilla.org, but it means uploading
  the zip to Mozilla. This repository doesn't do that; until someone does, Firefox users have
  the first two options.

On Firefox, notifications have no Save / Discard buttons (Firefox doesn't support
notification buttons); clicking the notification opens Review. **Firefox hasn't been tested
yet.**

---

## How it works

1. **You bet as usual.** When you press the place-bet control, the extension reads the slip
   before the page reacts. It then watches for up to 20 seconds:
   - a receipt ("Bet placed", "Aposta realizada", "Wette platziert", "Order filled", …) or the
     slip clearing → **confirmed**;
   - an error ("insufficient balance", "odds changed", …) → nothing is logged;
   - neither → **unconfirmed**. The bet waits in Review with no alert, and you can turn this
     off.
2. **Alert.** A system notification asks **Save** or **Discard**, so you don't need to open
   the extension.
3. **Pending bets wait for their result.** In **Capture → Import from My Bets**, the extension
   reads the book's history and settles each waiting bet. That includes ½ won / ½ lost on Asian
   lines, and profit/loss on exchanges.
4. **Export**:
   - **CSV** (default). Import the file in the tracker (Bets → Import).
   - **Send to tracker**, straight into the tracker page with one click to confirm. You can make
     it the default in Settings.

Every card explains its numbers in plain words ("Return 43.88 = half won (15.00 × 1.925) + half
refunded (15.00) → ½ won"). **Edit** lets you fix any field.

---

## Supported markets

### Sportsbooks
Any book, with no per-site setup. Nothing is tied to one site's markup; the extension relies on
how every book draws a slip:
- a price in its own element;
- a stake box;
- a place-bet control.

It handles:
- decimal, American and fractional odds;
- singles, several singles at once, and parlays;
- slips inside embedded frames;
- live bets;
- cash-out.

### Exchanges: back / lay, liability, commission
- **Reading the slip.** Prices are read from the slip's price boxes (exchanges let you edit
  the price). Each bet is **Back** or **Lay**, taken from the row's markup or its section
  heading.
- **Lay bets** record the backer's stake and the **liability** = stake × (odds − 1). The card
  checks the liability against what the slip shows.
- **Commission:** set it per exchange in **Settings → Sportsbooks → Commission %**. Until it's
  set, exchange cards show a warning, because profit would be overstated.
- **Settling:** exchanges show profit/loss per bet, and the result is proven from it. Both
  before-commission and after-commission figures are accepted.
- **Recognized automatically:** Betfair's exchange pages (`/exchange`), Smarkets, Matchbook
  and Betdaq. Any other site can be switched to "Exchange" in Settings → Sportsbooks → Type.

**How exchange bets go into a tracker that only knows back bets.** Every bet becomes the
equivalent back bet, so the profit comes out exactly the same. With commission c:

| Bet | Recorded as | Wins | Loses |
|---|---|---|---|
| Back S @ B | stake S @ 1 + (B − 1)(1 − c) | S(B − 1)(1 − c) | −S |
| Lay S @ L | "Lay: X", stake S(L − 1) @ 1 + (1 − c) / (L − 1) | S(1 − c) | −S(L − 1) |

Example: lay 10 @ 3.40 at 5 % is recorded as stake 24.00 @ 1.395833. It wins 9.50 and loses
24.00, exactly the exchange's figures. A test checks 1,560 combinations of odds, stake and
commission; each is within 0.01 of the exact profit. The raw figures travel alongside:
- CSV columns `direction`, `exch_odds`, `backer_stake`, `liability`, `commission_pct`;
- the tracker notes.

### Prediction markets: Polymarket, Kalshi
- **What it reads:** Yes / No at a price in cents, the amount (in dollars, or in contracts /
  shares), "To win" / payout, average price and fees.
- **Checks:**
  - shares = cost ÷ price;
  - a position is recorded as stake = cost + fee at odds = shares ÷ stake, so the profit if right
    is shares − cost − fee.
- **Sell orders** close a position you already hold, so they are not logged as new bets.
- **Order buttons** ("Trade", "Buy Yes") only count on prediction-market sites. Elsewhere they
  would be far too broad.
- **Recognized automatically:** polymarket.com, polymarket.us, kalshi.com, predictit.org.

---

## Languages

- **Interface:** 13 languages. It follows the browser's language, and Settings → Language
  can force one:
  - Português, English, Español, Français, Deutsch, Italiano, Nederlands, Polski, Türkçe,
    Русский, 한국어, 简体中文, 日本語.
- **Detection:** the same 13 languages, for:
  - place-bet buttons, receipts and errors;
  - stake / return labels and result words;
  - month names and "today / yesterday", plus Chinese / Japanese / Korean dates;
  - currencies: R$, $, €, £, ₽, zł, ₺, ¥, ₩, CHF, and space-grouped amounts ("1 234,56 €").

---

## What has been checked, and what hasn't

| | Status |
|---|---|
| Bet365 (Portuguese): slip, notification, My Bets | Tested on the real site by the maintainer. |
| Polymarket order ticket | Structure read from the live site (logged out, 24 Sep 2026). The confirmation text after "Trade" couldn't be seen without an account; "Order filled" is assumed. If it differs, the bet is still caught when the ticket clears, or kept as unconfirmed. |
| Betfair exchange, Kalshi | Both block automated access from the test machine. The wording comes from their help pages, and the page layouts in the tests are invented. |
| Detection words other than Portuguese / English | Generic betting vocabulary. Not yet checked against each book's exact labels. |
| Interface translations other than Portuguese / English | Machine-assisted. They need a native speaker's review. |
| Firefox | Not tested. |

If a site isn't detected:
1. Place a bet, or open the slip without betting.
2. Open **Settings → Diagnostics**.
3. Use **Copy log** and **Test snapshot**, and open an issue with both. Read the snapshot
   first: it contains the slip's text.

---

## Contributing

- **Detection words** live in `src/vocab/<lang>.js`, one file per language, as plain lists
  (`place`, `receipt`, `error`, `stake`, `ret`, `status`, …). Add the exact wording a site
  shows and open a pull request. For Chinese, Japanese and Korean, don't add one-character
  words: they would match inside team names.
- **Interface languages** live in `src/i18n/<lang>.js`. To add one:
  1. Copy `en.js` and translate the values.
  2. Load the file in `src/popup/popup.html`, in `src/background.js` (`importScripts`) and in
     `manifest.firefox.json`.
  3. Add the date locale to `LOCALES` in `popup.js` and `background.js`.

  The tests fail if a text is missing, or if a translation drops a `{placeholder}` or `<b>`.

## Development

```
node --test test/unit.test.js test/markets.test.js       # 23 tests, no browser needed
xvfb-run node test/e2e.js <path-to-website-repo>          # 62 end-to-end checks in Chromium
```

The end-to-end test loads the unpacked extension in Chromium and drives the synthetic pages in
`test/fixtures`. It covers:
- Portuguese and English slips, errors, iframes, a German slip and a Russian bet history;
- exchange back + lay placement and settlement;
- Polymarket-style and Kalshi-style tickets, including a Sell order that must not be logged;
- CSV and inbox import into the real tracker, with the lay bet's profit checked there.

| Path | Responsibility |
|---|---|
| `src/vocab/*.js` | Detection words per language (plain lists). |
| `src/lib/parse.js` | Pure text logic: numbers, money, odds, dates, the compiled vocabulary, result inference, exchange and prediction-market maths, and `trackerView` (the equivalent back bet). |
| `src/lib/extract.js` | Read-only DOM reading. Finds the place control and the slip, and reads sportsbook slips, exchange rows (back / lay), prediction tickets (Yes / No), bet-history cards and receipts. |
| `src/content/watch.js` | Content script: press → snapshot → outcome → report; detection log. |
| `src/content/tracker-bridge.js` | Hands saved bets to the tracker page (in-browser messages). |
| `src/background.js` | Storage (one change at a time), notifications, dedupe and settlement, site kinds and commission, tracker hand-off. |
| `src/popup/*` | Popup and full view. |
| `src/i18n/*.js` | Interface texts, 13 languages. |
| `src/lib/csv.js` | CSV: the tracker's 20 columns, then 9 exchange / prediction columns. |
| `integration/` | The tracker-side inbox (`bridge-inbox.jsx`) and how to install it. |
| `test/` | Unit tests, synthetic pages, end-to-end test. |

### CSV columns
1. **Tracker columns:** `date, time, sport, league, home, away, map, book, tipster, market,
   line, side, live, stake, odds, result, closing, model_prob, player, notes`. These are the
   tracker's own columns, and its importer maps them automatically.
2. **Exchange / prediction columns:** `venue, direction, exch_odds, backer_stake, liability,
   commission_pct, shares, share_price, fee`. Their names match none of the tracker's column
   guesses, so they are never mapped onto another field by mistake.

## License

[MIT](LICENSE).
