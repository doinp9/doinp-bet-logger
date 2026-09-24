// End-to-end test: loads the unpacked extension in Chromium, drives the synthetic
// sportsbook fixtures, then hands the bets to a locally served copy of the tracker
// (with integration/bridge-inbox.jsx wired in through request routing — the repo is
// not modified). Run:  xvfb-run node test/e2e.js <path-to-website-repo>
"use strict";
const path = require("path"), fs = require("fs"), os = require("os");
const { execFileSync, spawn } = require("child_process");
const { chromium } = require(process.env.PW || "/opt/node22/lib/node_modules/playwright");

const EXT_SRC = path.resolve(__dirname, "..");
const REPO = path.resolve(process.argv[2] || "/home/user/website");
const results = [];
const check = (name, ok, detail) => { results.push({ name, ok: !!ok, detail }); console.log((ok ? "PASS " : "FAIL ") + name + (detail ? "  — " + detail : "")); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function serve(dir, port) {
  const p = spawn("npx", ["http-server", dir, "-p", String(port), "-s", "-c-1"], { stdio: "ignore" });
  return p;
}

(async () => {
  // test build: identical code, plus a blanket host permission so no permission prompt is needed
  const BUILD = fs.mkdtempSync(path.join(os.tmpdir(), "dbl-build-"));
  execFileSync("cp", ["-r", ...["manifest.json", "_locales", "icons", "src"].map((f) => path.join(EXT_SRC, f)), BUILD]);
  const man = JSON.parse(fs.readFileSync(path.join(BUILD, "manifest.json"), "utf8"));
  man.host_permissions.push("*://*/*");
  fs.writeFileSync(path.join(BUILD, "manifest.json"), JSON.stringify(man, null, 2));

  const servers = [serve(path.join(EXT_SRC, "test/fixtures"), 8766), serve(path.join(EXT_SRC, "test/fixtures"), 8767), serve(REPO, 8765)];
  await sleep(2500);

  const ctx = await chromium.launchPersistentContext(fs.mkdtempSync(path.join(os.tmpdir(), "dbl-prof-")), {
    headless: false, executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome",
    viewport: { width: 1280, height: 860 },
    args: ["--disable-extensions-except=" + BUILD, "--load-extension=" + BUILD]
  });
  // optional: NETJS=<module path> exporting async (context) => {…} to route the tracker's CDN requests (e.g. behind a TLS-intercepting proxy)
  if (process.env.NETJS) await require(process.env.NETJS)(ctx);
  // wire the inbox into the served tracker without touching the repo
  const inbox = fs.readFileSync(path.join(EXT_SRC, "integration/bridge-inbox.jsx"), "utf8");
  await ctx.route(/localhost:8765\/tools\/betting-tracker(\.html)?$/, async (route) => {
    const html = fs.readFileSync(path.join(REPO, "tools/betting-tracker.html"), "utf8")
      .replace('<script type="text/babel" src="tracker/app.jsx"></script>', '<script type="text/babel" src="tracker/bridge-inbox.jsx"></script>\n  <script type="text/babel" src="tracker/app.jsx"></script>');
    await route.fulfill({ status: 200, contentType: "text/html", body: html });
  });
  await ctx.route(/localhost:8765\/tools\/tracker\/bridge-inbox\.jsx$/, (route) => route.fulfill({ status: 200, contentType: "text/plain", body: inbox }));
  await ctx.route(/localhost:8765\/tools\/tracker\/app\.jsx$/, async (route) => {
    const src = fs.readFileSync(path.join(REPO, "tools/tracker/app.jsx"), "utf8").replace("<Toast msg={toast} />", "<Toast msg={toast} />\n        <BridgeInbox view={view} />");
    await route.fulfill({ status: 200, contentType: "text/plain", body: src });
  });

  let sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
  const extId = sw.url().split("/")[2];
  const bgRun = (fn, arg) => sw.evaluate(fn, arg);
  const queue = () => bgRun(() => chrome.storage.local.get(["queue", "outbox"]));
  // popup screenshots (Review, plus Settings for the language shots) into OUT
  async function pop2Shots(name) {
    const p = await ctx.newPage();
    await p.setViewportSize({ width: 480, height: 600 });
    await p.goto(`chrome-extension://${extId}/src/popup/popup.html#review`); await sleep(900);
    await p.screenshot({ path: path.join(process.env.OUT || os.tmpdir(), "v8-" + name + ".png") });
    if (/^lang-/.test(name)) { await p.click("#tabs button[data-tab=settings]"); await sleep(300); await p.screenshot({ path: path.join(process.env.OUT || os.tmpdir(), "v8-" + name + "-settings.png") }); }
    await p.close();
  }

  await bgRun(() => HANDLERS["save-settings"]({ settings: { trackerUrl: "http://localhost:8765/tools/betting-tracker.html" } }));
  await bgRun(() => HANDLERS["enable-site"]({ domain: "localhost", book: "Casa Teste", extraDomains: [], fmt: "auto" }));
  await bgRun(() => HANDLERS["enable-site"]({ domain: "127.0.0.1", book: "Casa D", extraDomains: ["localhost"], fmt: "auto" }));
  const regs = await bgRun(() => chrome.scripting.getRegisteredContentScripts());
  check("automatic mode: one watcher for every site, no permission prompt", regs.length === 1 && regs[0].id === "dbl-all" && regs[0].allFrames && regs[0].matches.includes("https://*/*"), JSON.stringify(regs.map((r) => [r.id, r.matches])));
  await bgRun(() => HANDLERS["save-settings"]({ settings: { mode: "list" } }));
  const regsList = await bgRun(() => chrome.scripting.getRegisteredContentScripts());
  check("list mode: watchers only for books switched on", regsList.length === 2 && regsList.every((r) => r.id !== "dbl-all"), JSON.stringify(regsList.map((r) => r.id)));
  await bgRun(() => HANDLERS["save-settings"]({ settings: { mode: "auto" } }));

  const page = await ctx.newPage();

  /* 1. PT single with receipt; nav link must not trigger */
  await page.goto("http://localhost:8766/pt-single.html"); await sleep(800);
  await page.click("#nav-mybets"); await page.click(".grid .o >> nth=0");
  await page.fill("#stake", "10,00"); await page.click("#place"); await sleep(3000);
  let q = (await queue()).queue || [];
  const a = q[0];
  check("PT single: one suggestion", q.length === 1, "queue=" + q.length);
  check("PT single: fields", a && a.status === "placed" && a.signal === "receipt" && a.bet.odds === 2.1 && a.bet.stake === 10 && a.bet.teamA === "Flamengo" && a.bet.teamB === "Palmeiras" && a.bet.market === "Resultado Final" && a.bet.side === "Flamengo" && a.bet.book === "Casa Teste",
    a && JSON.stringify({ st: a.status, sg: a.signal, ...a.bet, legs: undefined }));
  check("PT single: return cross-check", a && a.checks.returnMatch === true, a && JSON.stringify(a.checks));

  /* 2. Error after click → nothing */
  await page.goto("http://localhost:8766/pt-error.html"); await sleep(800);
  await page.fill("#stake", "15,00"); await page.click("#place"); await sleep(3000);
  q = (await queue()).queue;
  check("error message → no suggestion", q.length === 1, "queue=" + q.length);

  /* 2b. Paused site → nothing is read */
  await bgRun(() => HANDLERS["set-site"]({ domain: "localhost", patch: { state: "paused" } }));
  await page.goto("http://localhost:8766/pt-single.html"); await sleep(800);
  await page.fill("#stake", "11,00"); await page.click("#place"); await sleep(3000);
  q = (await queue()).queue;
  const tr0 = (await bgRun(() => chrome.storage.local.get("trace"))).trace || [];
  check("paused site: bet ignored and nothing logged", q.length === 1 && !tr0.some((e) => /11/.test(e.detail || "")), "queue=" + q.length);
  await bgRun(() => HANDLERS["set-site"]({ domain: "localhost", patch: { state: "on" } }));

  /* 3. EN parlay, slip clears without receipt text */
  await page.goto("http://localhost:8766/en-parlay.html"); await sleep(800);
  await page.fill("#stake", "20"); await page.click("#place"); await sleep(3500);
  q = (await queue()).queue;
  const pl = q.find((x) => x.bet.isParlay);
  check("EN parlay: detected via cleared slip", pl && pl.signal === "cleared" && pl.bet.legs.length === 3 && pl.bet.odds === 5.4 && pl.bet.stake === 20 && pl.bet.legs[2].sel === "Over 2.5 Goals" && pl.bet.legs[2].market === "Total Goals", pl && JSON.stringify({ sg: pl.signal, odds: pl.bet.odds, stake: pl.bet.stake, legs: pl.bet.legs }));
  check("EN parlay: return cross-check", pl && pl.checks.returnMatch === true, pl && JSON.stringify(pl.checks));

  /* 4. PT two singles, each with its own stake */
  await page.goto("http://localhost:8766/pt-singles.html"); await sleep(800);
  const ins = page.locator(".valor");
  await ins.nth(0).fill("50"); await ins.nth(1).fill("25"); await page.click("#place"); await sleep(3000);
  q = (await queue()).queue;
  const sg = q.filter((x) => x.host === "localhost" && !x.bet.isParlay && x.bet.book === "Casa Teste" && (x.bet.odds === 1.95 || x.bet.odds === 3.4));
  check("PT singles: two bets with own stakes", sg.length === 2 && sg.some((x) => x.bet.odds === 1.95 && x.bet.stake === 50) && sg.some((x) => x.bet.odds === 3.4 && x.bet.stake === 25 && x.bet.live && x.bet.side === "Empate" && x.bet.teamB === "Vitória"),
    JSON.stringify(sg.map((x) => ({ o: x.bet.odds, s: x.bet.stake, live: x.bet.live, side: x.bet.side, ev: x.bet.teamA + "|" + x.bet.teamB }))));

  /* 5. Sportsbook inside a cross-origin iframe; the book comes from the top page */
  await page.goto("http://127.0.0.1:8767/frame-host.html"); await sleep(1500);
  const fr = page.frameLocator("#sb");
  await fr.locator("#stake").fill("12,50"); await fr.locator("#place").click(); await sleep(3000);
  q = (await queue()).queue;
  const ifr = q.find((x) => x.host === "127.0.0.1");
  check("iframe slip: detected, book from top page", ifr && ifr.bet.book === "Casa D" && ifr.bet.stake === 12.5 && ifr.bet.odds === 2.1, ifr && JSON.stringify({ book: ifr.bet.book, stake: ifr.bet.stake }));

  /* 6. Duplicate placement within 10 minutes is ignored */
  const before = q.length;
  await page.goto("http://localhost:8766/pt-single.html"); await sleep(800);
  await page.fill("#stake", "10,00"); await page.click("#place"); await sleep(3000);
  q = (await queue()).queue;
  check("same slip placed again within 10 min → deduplicated", q.length === before, before + " → " + q.length);

  /* 7. History page scan (what the popup's "Ler histórico" runs) */
  await page.goto("http://localhost:8766/history.html"); await sleep(800);
  const hist = await bgRun(async () => {
    const [tab] = await chrome.tabs.query({ url: "http://localhost/history.html" });
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => window.__dblApi && window.__dblApi.scanHistory() });
    const rows = res.map((r) => r.result).filter(Boolean).flatMap((x) => x.rows);
    const add = await HANDLERS["add-items"]({ host: "localhost", payload: { rows } });
    return { rows, add };
  });
  const hr = hist.rows.map((r) => r.bet);
  check("history: 3 cards found", hr.length === 3, JSON.stringify(hr.map((b) => [b.result, b.odds, b.stake, b.date])));
  const won = hr.find((b) => b.result === "won"), lost = hr.find((b) => b.result === "lost"), pend = hr.find((b) => b.result === "pending");
  check("history: won card", won && won.odds === 2.4 && won.stake === 20 && won.date === "2026-09-12" && won.time === "21:30" && won.teamA === "Grêmio" && won.teamB === "Internacional" && won.market === "Resultado Final" && won.selection === "Grêmio", won && JSON.stringify(won));
  check("history: lost card with line", lost && lost.odds === 1.9 && lost.stake === 30 && lost.line === "220.5" && lost.selection === "Mais de 220.5" && lost.market === "Total de pontos", lost && JSON.stringify(lost));
  check("history: pending parlay uses total odds", pend && pend.isParlay && pend.legs.length === 2 && pend.odds === 3.89 && pend.stake === 10 && pend.legs[0].sel === "Sim" && pend.legs[1].sel === "Santos", pend && JSON.stringify(pend));
  check("history: added to queue", hist.add.added === 3, JSON.stringify(hist.add));

  /* 8. Book with div buttons and split currency (your Bet365 screenshot) */
  const OUT = process.env.OUT || os.tmpdir();
  const q0 = (await queue()).queue.length;
  await page.goto("http://localhost:8766/b365-receipt.html"); await sleep(800);
  await page.fill("#stake", "1"); await page.click("#place .t"); await sleep(3200);
  q = (await queue()).queue;
  const car = q.find((x) => x.bet.side === "CAR Panthers");
  check("div place button: bet detected automatically", q.length === q0 + 1 && car && car.status === "placed" && car.signal === "receipt", JSON.stringify({ n: q.length - q0, st: car && car.status, sg: car && car.signal }));
  check("split currency: single bet, no phantom leg", car && !car.bet.isParlay && car.bet.odds === 1.66 && car.bet.stake === 1 && car.bet.market === "Money Line" && car.bet.teamA === "CAR Panthers" && car.bet.teamB === "CLE Browns" && car.bet.currency === "BRL",
    car && JSON.stringify({ parlay: car.bet.isParlay, odds: car.bet.odds, stake: car.bet.stake, mk: car.bet.market, ev: car.bet.teamA + "|" + car.bet.teamB, cur: car.bet.currency }));
  check("split currency: return check explained", car && car.checks.returnMatch === true && car.checks.basis === "potential" && car.checks.ret === 1.66, car && JSON.stringify(car.checks));
  const notes = await bgRun(() => chrome.notifications.getAll());
  const nid = Object.keys(notes).find((k) => car && k.includes(car.id));
  check("notification raised at placement", !!nid, JSON.stringify(Object.keys(notes)));
  const trace = (await bgRun(() => chrome.storage.local.get("trace"))).trace || [];
  check("detection log: press + receipt recorded", trace.some((e) => e.step === "press" && /CAR Panthers @ 1.66/.test(e.detail)) && trace.some((e) => e.step === "outcome" && /^receipt/.test(e.detail)), JSON.stringify(trace.slice(0, 4).map((e) => e.step + ": " + e.detail)));
  await bgRun((nid) => __dblTest.onNoteButton(nid, 0), nid);
  let s2 = await queue();
  check("notification Save → waiting for the tracker", !s2.queue.some((x) => x.id === car.id) && s2.outbox.some((x) => x.id === car.id), JSON.stringify({ q: s2.queue.length, o: s2.outbox.length }));

  const carHeld = (await queue()).outbox.find((x) => x.id === car.id);
  check("pending bet saved → held in Pending (not exported yet)", carHeld && carHeld.dest === "hold", JSON.stringify(carHeld && carHeld.dest));
  await page.goto("http://localhost:8766/b365-settled.html"); await sleep(800);
  const qs0 = (await queue()).queue.length;
  const hs = await bgRun(async () => {
    const [tab] = await chrome.tabs.query({ url: "http://localhost/b365-settled.html" });
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => window.__dblApi && window.__dblApi.scanHistory() });
    const rows = res.map((r) => r.result).filter(Boolean).flatMap((x) => x.rows);
    return await HANDLERS["add-items"]({ host: "localhost", payload: { rows } });
  });
  const carNow = (await queue()).outbox.find((x) => x.id === car.id);
  check("My Bets dated days later settles the held bet (no duplicate) and releases it for export",
    hs.added === 0 && hs.updated === 1 && hs.released === 1 && (await queue()).queue.length === qs0 && carNow && carNow.bet.result === "won" && carNow.dest === "pending",
    JSON.stringify({ hs, result: carNow && carNow.bet.result, dest: carNow && carNow.dest }));

  /* 9. My Bets with ½ won ½ void, teams on separate lines, date in a group header */
  await page.goto("http://localhost:8766/b365-history.html"); await sleep(800);
  const qb = (await queue()).queue.length;
  const h2 = await bgRun(async () => {
    const [tab] = await chrome.tabs.query({ url: "http://localhost/b365-history.html" });
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => window.__dblApi && window.__dblApi.scanHistory() });
    const rows = res.map((r) => r.result).filter(Boolean).flatMap((x) => x.rows);
    return { rows, add: await HANDLERS["add-items"]({ host: "localhost", payload: { rows } }) };
  });
  q = (await queue()).queue;
  check("My Bets: all 3 cards saved (no lost writes)", h2.add.added === 3 && q.length === qb + 3, JSON.stringify(h2.add) + " queue " + qb + " → " + q.length);
  const gr = q.find((x) => /^Grorud/.test(x.bet.side));
  check("Asian handicap: ½ won ½ void → half-won", gr && gr.bet.result === "half-won" && gr.checks.basis === "half-won" && gr.checks.returnMatch === true && gr.checks.expected === 43.88, gr && JSON.stringify({ r: gr.bet.result, c: gr.checks }));
  check("Asian handicap: fields", gr && gr.bet.side === "Grorud 0.0,+0.5" && gr.bet.line === "0.0,+0.5" && gr.bet.market === "Asian Handicap" && gr.bet.teamA === "Grorud" && gr.bet.teamB === "Moss" && gr.bet.stake === 30 && gr.bet.odds === 1.925 && gr.bet.date === "2026-09-20",
    gr && JSON.stringify({ side: gr.bet.side, line: gr.bet.line, mk: gr.bet.market, ev: gr.bet.teamA + "|" + gr.bet.teamB, st: gr.bet.stake, o: gr.bet.odds, d: gr.bet.date }));
  const kh = q.find((x) => x.bet.side === "Kauhajoen Karhu");
  check("My Bets: teams + won check", kh && kh.bet.teamA === "Kipina Basket" && kh.bet.teamB === "Kauhajoen Karhu" && kh.bet.result === "won" && kh.checks.basis === "won", kh && JSON.stringify({ ev: kh.bet.teamA + "|" + kh.bet.teamB, r: kh.bet.result }));

  /* 10. My Bets row for a bet already waiting → result updated, not duplicated */
  await page.goto("http://localhost:8766/pt-history-today.html"); await sleep(800);
  const qc = (await queue()).queue.length;
  const h3 = await bgRun(async () => {
    const [tab] = await chrome.tabs.query({ url: "http://localhost/pt-history-today.html" });
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => window.__dblApi && window.__dblApi.scanHistory() });
    const rows = res.map((r) => r.result).filter(Boolean).flatMap((x) => x.rows);
    return await HANDLERS["add-items"]({ host: "localhost", payload: { rows } });
  });
  q = (await queue()).queue;
  const fla = q.filter((x) => x.bet.side === "Flamengo" && x.host === "localhost");
  check("My Bets updates the pending bet instead of duplicating", h3.added === 0 && h3.updated === 1 && q.length === qc && fla.length === 1 && fla[0].bet.result === "won", JSON.stringify(h3) + " " + JSON.stringify(fla.map((x) => x.bet.result)));

  /* 11. discard → history → restore; delete from history */
  await bgRun((id) => HANDLERS.discard({ ids: [id] }), kh.id);
  let st3 = await bgRun(() => chrome.storage.local.get(["queue", "history"]));
  const he = st3.history.find((e) => e.item.id === kh.id);
  check("discard moves the bet to history", !st3.queue.some((x) => x.id === kh.id) && he && he.outcome === "discarded");
  await bgRun((id) => HANDLERS.restore({ ids: [id] }), he.id);
  st3 = await bgRun(() => chrome.storage.local.get(["queue", "history"]));
  check("restore brings it back to Review", st3.queue.some((x) => x.id === kh.id) && !st3.history.some((e) => e.id === he.id));

  /* 12. screenshots: every tab, popup and full view, with the queue filled */
  const pop = await ctx.newPage();
  await pop.setViewportSize({ width: 480, height: 600 });
  const [fixtureTab] = await bgRun(() => chrome.tabs.query({ url: "http://localhost/pt-history-today.html" }));
  await pop.goto(`chrome-extension://${extId}/src/popup/popup.html?tab=${fixtureTab.id}#review`); await sleep(900);
  check("popup renders every queued bet", (await pop.locator(".bet").count()) === (await queue()).queue.length);
  await pop.locator(".bet input[type=checkbox]").nth(0).check(); await pop.locator(".bet input[type=checkbox]").nth(1).check(); await sleep(200);
  await pop.screenshot({ path: path.join(OUT, "popup-review.png") });
  const grCard = pop.locator(".bet", { hasText: "Grorud" });
  await grCard.scrollIntoViewIfNeeded(); await sleep(150);
  await grCard.screenshot({ path: path.join(OUT, "card-asian.png") });
  check("half-won card explains the return", /½/.test(await grCard.innerText()) && /43[.,]88/.test(await grCard.innerText()), (await grCard.innerText()).replace(/\n/g, " | ").slice(0, 300));
  for (const tb of ["capture", "history", "settings"]) {
    await pop.click(`#tabs button[data-tab=${tb}]`); await sleep(300);
    await pop.evaluate(() => { document.getElementById("view").scrollTop = 0; });
    await pop.screenshot({ path: path.join(OUT, "popup-" + tb + ".png") });
  }
  await pop.close();
  const full = await ctx.newPage();
  await full.setViewportSize({ width: 1280, height: 860 });
  await full.goto(`chrome-extension://${extId}/src/popup/popup.html?view=full#review`); await sleep(900);
  await full.screenshot({ path: path.join(OUT, "full-review.png") });
  await full.close();

  /* 13. CSV fallback → the tracker's existing CSV import */
  const csvItems = (await queue()).queue;
  require(path.join(EXT_SRC, "src/lib/parse.js")); require(path.join(EXT_SRC, "src/lib/csv.js"));
  const csv = globalThis.DBL_CSV.toCSV(csvItems);
  const tr = await ctx.newPage();
  await tr.goto("http://localhost:8765/tools/betting-tracker.html", { waitUntil: "networkidle" });
  await tr.waitForSelector(".trk-hero", { timeout: 60000 });
  await tr.click(".trk-hero__demo .trk-textlink"); await tr.waitForSelector(".trk-kpis");
  // default export is CSV: a bet saved from the notification must NOT be pushed to the tracker
  await sleep(2500);
  check("CSV export (default): saved bet stays out of the tracker", (await tr.locator(".trk-modal h3").count()) === 0);
  const nBets = () => tr.evaluate(() => JSON.parse(localStorage.getItem("doinp.tracker.state")).bets.length);
  const n0 = await nBets();
  await tr.click(".trk-tab:nth-child(2)"); await sleep(400);
  await tr.click(".trk-bets__head >> text=Import"); await sleep(300);
  await tr.fill(".trk-imp__ta", csv); await sleep(500);
  const impLabel = await tr.locator(".trk-modal__foot .btn--primary").innerText();
  check("CSV: tracker importer reads every row", impLabel.includes("(" + csvItems.length + ")"), impLabel.trim());
  await tr.locator(".trk-modal__foot .btn--primary").click(); await sleep(500);
  const n1 = await nBets();
  check("CSV: bets added to the tracker", n1 === n0 + csvItems.length, n0 + " → " + n1);
  const halfInTracker = await tr.evaluate(() => JSON.parse(localStorage.getItem("doinp.tracker.state")).bets.filter((b) => b.result === "half-won").length);
  check("CSV: half-won result survives the import", halfInTracker === 1, String(halfInTracker));

  /* 14. Save → tracker inbox → imported → history */
  const ids = csvItems.map((x) => x.id);
  const nPend = csvItems.filter((x) => x.bet.result === "pending").length;
  const sv = await bgRun((ids) => HANDLERS.save({ ids }), ids);
  const ob = (await queue()).outbox;
  const outN = ob.filter((x) => x.dest !== "hold").length;
  check("save (CSV default): settled bets wait for export, pending ones are held", sv.saved + sv.held === ids.length && sv.held === nPend && sv.dest === "pending" && ob.filter((x) => x.dest === "hold").length === nPend,
    JSON.stringify({ sv, nPend, outN }));
  const served0 = await bgRun(() => HANDLERS["bridge-get-outbox"]({}));
  check("tracker is served nothing while exports are CSV", served0.bets.length === 0, String(served0.bets.length));
  const sent = await bgRun(() => HANDLERS["send-to-tracker"]({}));
  check("Send to tracker: every saved bet marked for the tracker, tracker tab focused", sent.sent === outN && sent.opened === false, JSON.stringify(sent));
  const INBOX = /Bets from Doinp Bet Logger|Apostas do Doinp Bet Logger/;
  await tr.waitForSelector(".trk-modal h3", { timeout: 8000 }).catch(() => {});
  check("bridge: tracker inbox opened with the bets", (await tr.locator(".trk-modal h3", { hasText: INBOX }).count()) === 1);
  const rows = await tr.locator(".trk-modal tbody tr").count();
  check("bridge: inbox lists everything waiting", rows === outN, rows + " rows / " + outN + " waiting");
  await sleep(500);
  await tr.screenshot({ path: path.join(OUT, "tracker-inbox.png") });
  await tr.locator(".trk-modal__foot .btn--primary").click(); await sleep(900);
  const n2 = await nBets();
  check("bridge: confirmed bets added", n2 === n1 + outN, n1 + " → " + n2);
  const st4 = await bgRun(() => chrome.storage.local.get(["queue", "outbox", "history"]));
  check("bridge: sent bets move to history as imported; held ones stay", st4.outbox.length === nPend && st4.outbox.every((x) => x.dest === "hold") && st4.queue.length === 0 && st4.history.filter((e) => e.outcome === "imported").length === outN, JSON.stringify({ q: st4.queue.length, o: st4.outbox.length, imported: st4.history.filter((e) => e.outcome === "imported").length }));

  /* 14b. A book never configured is detected out of the box and remembered */
  await bgRun(() => HANDLERS["disable-site"]({ domain: "localhost" }));
  await page.goto("http://localhost:8766/pt-single.html"); await sleep(800);
  await page.fill("#stake", "7,00"); await page.click("#place"); await sleep(3000);
  const st6 = await bgRun(() => chrome.storage.local.get(["queue", "sites"]));
  const nw = st6.queue.find((x) => x.bet.stake === 7);
  check("unconfigured book: detected with no setup and added to the list", nw && nw.status === "placed" && nw.bet.book === "Localhost" && st6.sites.localhost && st6.sites.localhost.auto === true, JSON.stringify({ book: nw && nw.bet.book, site: st6.sites.localhost }));

  /* 14c. Tracker as the default export: Save goes straight to the tracker */
  await bgRun(() => HANDLERS["save-settings"]({ settings: { exportTo: "tracker" } }));
  const tq = (await queue()).queue.map((x) => x.id);
  const sv2 = await bgRun((ids) => HANDLERS.save({ ids }), tq);
  const served1 = await bgRun(() => HANDLERS["bridge-get-outbox"]({}));
  check("tracker export: a pending bet is held, nothing served", tq.length === 1 && sv2.held === 1 && served1.bets.length === 0, JSON.stringify({ tq: tq.length, sv2, served: served1.bets.length }));
  await bgRun((ids) => HANDLERS["send-to-tracker"]({ ids }), tq);
  const served2 = await bgRun(() => HANDLERS["bridge-get-outbox"]({}));
  check("Export anyway: the held bet is sent to the tracker", served2.bets.length === 1 && served2.bets[0].extId === tq[0], String(served2.bets.length));
  // CSV export of what's saved → history "exported"
  const outIds = (await queue()).outbox.map((x) => x.id);
  await bgRun((ids) => HANDLERS["outbox-exported"]({ ids }), outIds);
  const st7 = await bgRun(() => chrome.storage.local.get(["outbox", "history"]));
  check("Export CSV: saved bets move to the log as exported", st7.outbox.length === 0 && outIds.every((id) => st7.history.some((e) => e.item.id === id && e.outcome === "exported")));
  await bgRun(() => HANDLERS["save-settings"]({ settings: { exportTo: "csv" } }));

  /* 16. Other languages: a German slip and a Russian bet history */
  const scan = (url) => bgRun(async (url) => {
    const [tab] = await chrome.tabs.query({ url });
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, func: () => window.__dblApi && window.__dblApi.scanHistory() });
    const rows = res.map((r) => r.result).filter(Boolean).flatMap((x) => x.rows);
    return { rows, add: await HANDLERS["add-items"]({ host: "localhost", payload: { rows } }) };
  }, url);
  await page.goto("http://localhost:8766/de-slip.html"); await sleep(800);
  await page.fill("#stake", "10,00"); await page.click("#place"); await sleep(3000);
  q = (await queue()).queue;
  const de = q.find((x) => x.bet.side === "Bayern München");
  check("German slip: 'Wette platzieren' detected, receipt 'Wette platziert'", de && de.status === "placed" && de.signal === "receipt", de && JSON.stringify({ st: de.status, sg: de.signal }));
  check("German slip: fields, euro, return check", de && de.bet.odds === 1.85 && de.bet.stake === 10 && de.bet.market === "Spielausgang" && de.bet.teamA === "Bayern München" && de.bet.teamB === "Borussia Dortmund" && de.bet.currency === "EUR" && de.checks.returnMatch === true,
    de && JSON.stringify({ o: de.bet.odds, s: de.bet.stake, mk: de.bet.market, ev: de.bet.teamA + "|" + de.bet.teamB, cur: de.bet.currency, c: de.checks }));
  await page.goto("http://localhost:8766/ru-history.html"); await sleep(800);
  const ru = await scan("http://localhost/ru-history.html");
  const ruWon = ru.rows.map((r) => r.bet).find((b) => b.result === "won"), ruLost = ru.rows.map((r) => r.bet).find((b) => b.result === "lost");
  check("Russian My Bets: results, '1 000 ₽' amounts, date '12 марта 2026'", ru.rows.length === 2 && ruWon && ruWon.stake === 1000 && ruWon.odds === 2.4 && ruWon.currency === "RUB" && ruWon.date === "2026-03-12" && ruWon.selection === "Спартак Москва" && ruWon.teamB === "Зенит" && ruLost && ruLost.stake === 500 && ruLost.odds === 1.95,
    JSON.stringify(ru.rows.map((r) => ({ r: r.bet.result, s: r.bet.stake, o: r.bet.odds, c: r.bet.currency, d: r.bet.date, sel: r.bet.selection, ev: r.bet.teamA + "|" + r.bet.teamB }))));

  /* 17. Exchange: back + lay with commission, liability check, settled by profit / loss */
  await bgRun(() => HANDLERS["set-site"]({ domain: "localhost", patch: { kind: "exchange", commission: 5 } }));
  await page.goto("http://localhost:8766/bf-exchange.html"); await sleep(900);
  await page.fill("#bstake", "10"); await page.fill("#lstake", "10"); await page.click("#place"); await sleep(3000);
  q = (await queue()).queue;
  const xb = q.find((x) => x.bet.kind === "exchange" && x.bet.dir === "back"), xl = q.find((x) => x.bet.kind === "exchange" && x.bet.dir === "lay");
  check("exchange: back bet read (side from the row's class)", xb && xb.status === "placed" && xb.bet.side === "Arsenal" && xb.bet.odds === 2.5 && xb.bet.stake === 10 && xb.bet.commission === 5 && xb.bet.teamA === "Arsenal" && xb.bet.teamB === "Chelsea" && xb.bet.market === "Match Odds",
    xb && JSON.stringify({ st: xb.status, ...xb.bet, legs: undefined }));
  check("exchange: lay bet read (side from the section heading), liability 10 × (3.4 − 1) = 24", xl && xl.bet.side === "Chelsea" && xl.bet.odds === 3.4 && xl.bet.stake === 10 && xl.bet.liability === 24 && xl.bet.currency === "GBP" && xl.checks.basis === "liability" && xl.checks.returnMatch === true,
    xl && JSON.stringify({ ...xl.bet, legs: undefined, c: xl.checks }));
  await pop2Shots("exchange");
  const xs = await bgRun((ids) => HANDLERS.save({ ids }), [xb.id, xl.id]);
  check("exchange: pending bets held until settled", xs.held === 2, JSON.stringify(xs));
  await page.goto("http://localhost:8766/bf-history.html"); await sleep(800);
  const bh = await scan("http://localhost/bf-history.html");
  const ob2 = (await queue()).outbox;
  const xl2 = ob2.find((x) => x.id === xl.id), xb2 = ob2.find((x) => x.id === xb.id);
  check("exchange settled page: lay lost (P/L −24.00), back won (P/L 14.25 after 5 %), no duplicates",
    bh.add.added === 0 && bh.add.updated === 2 && bh.add.released === 2 && xl2 && xl2.bet.result === "lost" && xl2.checks.basis === "pl-lost" && xb2 && xb2.bet.result === "won" && xb2.checks.basis === "pl-won",
    JSON.stringify({ add: bh.add, lay: xl2 && [xl2.bet.result, xl2.checks], back: xb2 && [xb2.bet.result, xb2.checks] }));
  // the tracker only knows back bets: the CSV row must give it the exact profit
  const xcsv = globalThis.DBL_CSV.toCSV([xl2, xb2]);
  const tb0 = await nBets();
  // the inbox may still be open from "Export anyway": close it first
  if (await tr.locator(".trk-scrim").count()) { await tr.keyboard.press("Escape"); await sleep(300); }
  if (await tr.locator(".trk-scrim").count()) { await tr.locator(".trk-modal__foot button:not(.btn--primary)").first().click().catch(() => {}); await sleep(300); }
  await tr.click(".trk-tab:nth-child(2)"); await sleep(400);
  await tr.click(".trk-bets__head >> text=Import"); await sleep(300);
  await tr.fill(".trk-imp__ta", xcsv); await sleep(500);
  await tr.locator(".trk-modal__foot .btn--primary").click(); await sleep(600);
  const imported = await tr.evaluate(() => JSON.parse(localStorage.getItem("doinp.tracker.state")).bets.slice(-2));
  const pnl = (b) => b.result === "won" ? b.stake * (b.odds - 1) : b.result === "lost" ? -b.stake : 0;
  const tl = imported.find((b) => /^Lay: Chelsea/.test(b.side)), tbk = imported.find((b) => b.side === "Arsenal");
  check("exchange → tracker CSV: profit exact (lay −24.00, back +14.25)", (await nBets()) === tb0 + 2 && tl && Math.abs(pnl(tl) + 24) < 0.005 && tbk && Math.abs(pnl(tbk) - 14.25) < 0.005,
    JSON.stringify(imported.map((b) => ({ side: b.side, stake: b.stake, odds: b.odds, r: b.result, pnl: pnl(b) }))));

  /* 18. Prediction markets: Polymarket-style (dollars) and Kalshi-style (contracts) tickets */
  await bgRun(() => HANDLERS["set-site"]({ domain: "localhost", patch: { kind: "prediction", commission: null } }));
  await page.goto("http://localhost:8766/pm-ticket.html"); await sleep(900);
  await page.fill("#amt", "10"); await sleep(200); await page.click("#trade"); await sleep(3000);
  q = (await queue()).queue;
  const pm = q.find((x) => x.bet.kind === "prediction" && x.bet.teamA === "Fed Decision in October?");
  check("Polymarket-style: 'Trade' detected, Yes 35¢, $10 → 28.57 shares", pm && pm.status === "placed" && pm.signal === "receipt" && pm.bet.dir === "yes" && pm.bet.price === 0.35 && pm.bet.stake === 10 && pm.bet.shares === 28.57 && pm.bet.odds === 2.857 && pm.bet.market === "No change" && pm.bet.side === "No change · Yes" && pm.checks.returnMatch === true,
    pm && JSON.stringify({ st: pm.status, sg: pm.signal, ...pm.bet, legs: undefined, c: pm.checks }));
  const qn = q.length;
  await page.click("#sell"); await page.fill("#amt", "5"); await sleep(200); await page.click("#trade"); await sleep(3000);
  const trs = (await bgRun(() => chrome.storage.local.get("trace"))).trace || [];
  check("Polymarket-style: a Sell order is not logged as a bet", (await queue()).queue.length === qn && trs.some((e) => /sell order/.test(e.detail || "")), JSON.stringify(trs.slice(0, 2)));
  await page.goto("http://localhost:8766/kalshi-ticket.html"); await sleep(900);
  await page.fill("#n", "20"); await sleep(200); await page.click("#go"); await sleep(3000);
  q = (await queue()).queue;
  const ks = q.find((x) => x.bet.kind === "prediction" && x.bet.teamA === "Highest temperature in NYC today?");
  // 20 contracts × 42¢ = 8.40; fee round-up(0.07 × 20 × 0.42 × 0.58 = 0.341) = 0.35; pays 20.00
  check("Kalshi-style: 20 contracts at 42¢ → cost 8.40, fee 0.35, pays 20", ks && ks.bet.shares === 20 && ks.bet.stake === 8.4 && ks.bet.fee === 0.35 && ks.bet.price === 0.42 && ks.bet.market === "86° to 87°" && ks.checks.returnMatch === true,
    ks && JSON.stringify({ ...ks.bet, legs: undefined, c: ks.checks }));
  await pop2Shots("prediction");
  await bgRun(() => HANDLERS["set-site"]({ domain: "localhost", patch: { kind: "auto" } }));

  /* 18b. Test snapshot never records typed text (passwords, e-mails), even when no slip is found */
  await page.goto("http://localhost:8766/ru-history.html"); await sleep(800);
  await page.evaluate(() => { document.body.insertAdjacentHTML("afterbegin", '<form><input type="email" id="em"><input type="password" id="pw"><input type="text" id="nm"><input type="text" id="amt"></form>'); });
  await page.fill("#em", "me@example.com"); await page.fill("#pw", "hunter2secret"); await page.fill("#nm", "João Silva"); await page.fill("#amt", "12,50");
  const snapTxt = await bgRun(async () => {
    const [tab] = await chrome.tabs.query({ url: "http://localhost/ru-history.html" });
    const res = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: () => JSON.stringify(window.__dblApi.snapshot()) });
    return res[0].result;
  });
  const snapObj = JSON.parse(snapTxt);
  check("test snapshot (no slip, whole page): number kept; password, e-mail and typed name never recorded",
    snapObj.slipFound === false && /12,50/.test(snapTxt) && !/hunter2secret|me@example\.com|João Silva/.test(snapTxt) && /not recorded/.test(snapTxt), snapTxt.length + " chars");

  /* 18c. Pinnacle (structure from pinnacle.com; receipts as on the user's pinnacle.bet.br screenshots) */
  for (const lg of ["en", "pt"]) {
    await page.goto("http://localhost:8766/pinnacle.html" + (lg === "pt" ? "?lang=pt" : "")); await sleep(800);
    await page.click("#pick"); await page.fill("#stake", lg === "pt" ? "2" : "1"); await sleep(200); await page.click("#place"); await sleep(3200);
    q = (await queue()).queue;
    const pin = q.find((x) => x.bet.side === "New York Yankees" && x.bet.stake === (lg === "pt" ? 2 : 1));
    check("Pinnacle (" + lg + "): detected with receipt '" + (lg === "pt" ? "Aceitar aposta" : "Bet Accepted") + "', Stake + Win boxes read right",
      pin && pin.status === "placed" && pin.signal === "receipt" && pin.bet.odds === 1.684 && pin.bet.teamA === "Tampa Bay Rays" && pin.bet.teamB === "New York Yankees" && /^Money Line – (Game|Jogo) – MLB$/.test(pin.bet.market) && pin.bet.currency === "BRL" && pin.checks.returnMatch === true,
      pin && JSON.stringify({ st: pin.status, sg: pin.signal, o: pin.bet.odds, s: pin.bet.stake, ev: pin.bet.teamA + "|" + pin.bet.teamB, mk: pin.bet.market, cur: pin.bet.currency, c: pin.checks }));
  }

  /* 18d. A tab that was open before the extension was installed / updated gets the watcher injected; no double watcher */
  await bgRun(() => chrome.scripting.unregisterContentScripts());
  await page.goto("http://localhost:8766/de-slip.html"); await sleep(800);
  const bare = await page.evaluate(() => typeof window.__dblApi);
  await bgRun(() => __dblTest.injectOpenTabs());
  await bgRun(() => __dblTest.injectOpenTabs()); // twice: the second copy must stand down
  await sleep(500);
  const qi = (await queue()).queue.length;
  await page.fill("#stake", "3,00"); await page.click("#place"); await sleep(3000);
  const qi2 = (await queue()).queue.filter((x) => x.bet.side === "Bayern München" && x.bet.stake === 3).length;
  check("tab open before install/update: watcher injected, bet detected once", bare === "undefined" && qi2 === 1 && (await queue()).queue.length === qi + 1, JSON.stringify({ bare, found: qi2 }));
  await bgRun(() => HANDLERS["save-settings"]({ settings: { mode: "list" } })); await bgRun(() => HANDLERS["save-settings"]({ settings: { mode: "auto" } })); // re-register

  /* 19. The new interface languages */
  for (const lg of ["fr", "ru"]) {
    await bgRun((lg) => HANDLERS["save-settings"]({ settings: { lang: lg } }), lg);
    await pop2Shots("lang-" + lg);
  }
  await bgRun(() => HANDLERS["save-settings"]({ settings: { lang: "auto" } }));

  /* 15. Delete all data */
  await bgRun(() => HANDLERS["clear-all"]({}));
  const st5 = await bgRun(() => chrome.storage.local.get(["queue", "outbox", "history", "trace", "sites"]));
  check("delete all data: empties queue, waiting, history, log; keeps sites", !st5.queue.length && !st5.outbox.length && !st5.history.length && !st5.trace.length && Object.keys(st5.sites).length === 2);

  await ctx.close();
  servers.forEach((s) => s.kill());
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
