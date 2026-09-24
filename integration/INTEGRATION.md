# Tracker integration — the inbox for Doinp Bet Logger

This is optional. Without it, use the extension's **Copy CSV / Download CSV** buttons and
the tracker's existing **Bets → Import**. The CSV columns match the tracker's own example
format, and the end-to-end test confirms the tracker maps 20 of its 25 import fields and
imports every row.

With it, **Send to tracker** in the extension opens (or focuses) your tracker tab. An inbox
then lists the bets, and you confirm them there. Nothing is added without your click.

## Install: 1 new file, 2 one-line edits

1. Copy `bridge-inbox.jsx` to `tools/tracker/bridge-inbox.jsx`.
2. `tools/betting-tracker.html`: load it just before `app.jsx`.
   ```html
   <script type="text/babel" src="tracker/bridge-inbox.jsx"></script>
   <script type="text/babel" src="tracker/app.jsx"></script>
   ```
3. `tools/tracker/app.jsx`: render it inside `<TrackerCtx.Provider>`, right after `<Toast msg={toast} />`.
   ```jsx
   <Toast msg={toast} />
   <BridgeInbox view={view} />
   ```

These are exactly the two edits the end-to-end test applies (through request routing) to a
local copy of the tracker. I have not made them in your repository.

## Behaviour

- The inbox opens only once a tracker file is open (view `app`). Before that the bets wait.
- **Add N** dispatches the existing `add-bets` action. Each bet starts from `blankBet(state)`,
  so sport, league, model/tipster and bankroll take the tracker's defaults. Date, time,
  book, event, market, line, selection, odds, stake, result, live flag, parlay legs and
  notes come from the extension.
- **Discard selected** tells the extension to drop those bets. **Later** closes the inbox.
  The bets stay in the extension (shown as "waiting in the tracker") until they are added
  or discarded. Reloading the tracker shows them again.
- The bet sheet has no new columns. The data model and the .xlsx format are unchanged.

## Message protocol (window.postMessage, same origin, `version: 1`)

| Direction | Message |
|---|---|
| ext → page | `{ source: "doinp-bet-logger", type: "hello" }` |
| page → ext | `{ source: "doinp-tracker", type: "ready" }` |
| ext → page | `{ source: "doinp-bet-logger", type: "bets", bets: [...] }` |
| page → ext | `{ source: "doinp-tracker", type: "imported" \| "dismissed", ids: [...] }` |

Both sides announce themselves on load, so the load order doesn't matter. The inbox checks
`event.source === window` and validates every field (type, length, date format, result
list) before showing anything.

## Bet fields sent by the extension

`extId, date (YYYY-MM-DD, local), time (HH:MM), book, sport (""), league (""), teamA, teamB,
market, line, side, live, stake, odds (decimal), result, returned, isParlay,
legs [{event, market, sel, odds}], notes, source, confidence`
