# Privacy policy · Doinp Bet Logger

**Short version: the extension collects no data. Nothing leaves your browser.**

## What it reads
It reads the text of the web page you are on:
- when you press a control labelled like a place-bet button;
- when you use the popup's **Capture** actions.

It reads only what is already on your screen: the bet slip, the receipt, your bet history.

## What it stores, and where
- **What:** the bets you keep, your settings, the sites it has seen bets on, and a detection
  log of the last 100 events.
- **Where:** `storage.local`, which is part of your browser profile on your device. The
  maintainer can't see it; no one else can either.
- **How to delete it:** **Settings → Delete all data**, or **Reset extension**. Removing the
  extension also deletes it.

## What it sends
**Nothing.** There is no server, account, analytics, telemetry, advertising or remote code.
- The extension's pages run under the content-security policy `connect-src 'none'`, so the
  browser refuses any network connection from them.
- A test fails if network code is ever added to `src/`.

Saved bets reach the Doinp betting tracker in two ways, both started by you:
- **CSV:** a file you download and import yourself.
- **Send to tracker:** the extension passes the bets to the tracker page open in your browser,
  page to page. That page shows them and asks you to confirm.

## What it changes
Nothing. On the sites you visit, it:
- adds no elements;
- clicks nothing and types nothing;
- sends no requests.

## Diagnostics you share
**Copy log** and **Test snapshot** (Settings → Diagnostics) create text on your device. They
contain the page's slip text and the values of number fields (stakes, prices). The values of
any other field (passwords, e-mails, typed text) are replaced by "(not recorded)".
- **When they leave your device:** only if you choose to paste them somewhere, for example a
  GitHub issue.
- **Before sharing:** read them first.

## Contact
Open an issue at https://github.com/doinp9 (the extension's repository).
