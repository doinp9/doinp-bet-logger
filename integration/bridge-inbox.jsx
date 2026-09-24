/* =====================================================
   Betting Tracker — inbox for the Doinp Bet Logger extension
   Receives the bets the extension sends (window.postMessage
   from its content script on this page), shows them for a
   final confirmation, and adds the chosen ones with the
   normal "add-bets" action. Nothing is added without a click.

   Protocol (version 1)
     page → ext  { source:"doinp-tracker",    type:"ready" }
     ext  → page { source:"doinp-bet-logger", type:"hello" | "bets", bets:[...] }
     page → ext  { source:"doinp-tracker",    type:"imported" | "dismissed", ids:[...] }

   Loaded after ui.jsx / bets.jsx (uses Modal, Btn, Icon,
   ResultBadge, useTracker, blankBet, TRK) and rendered by
   App inside TrackerCtx.Provider:  <BridgeInbox view={view} />
   ===================================================== */

const BRIDGE_EXT = "doinp-bet-logger";
const BRIDGE_PAGE = "doinp-tracker";
const BRIDGE_RESULTS = ["pending", "won", "lost", "cashout", "push", "void", "half-won", "half-lost"];

function bridgePost(msg) {
  window.postMessage(Object.assign({ source: BRIDGE_PAGE, version: 1 }, msg), location.origin);
}

// the extension's payload is data from another context: validate every field
function bridgeClean(raw) {
  const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return isFinite(n) ? n : null; };
  const str = (v, max) => (v == null ? "" : String(v)).slice(0, max || 200);
  return (Array.isArray(raw) ? raw : []).slice(0, 500).map((b) => ({
    extId: str(b.extId, 80),
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : TRK.today(),
    time: /^\d{2}:\d{2}$/.test(b.time) ? b.time : "",
    book: str(b.book, 60), teamA: str(b.teamA), teamB: str(b.teamB),
    market: str(b.market, 80), line: str(b.line, 20), side: str(b.side),
    odds: num(b.odds), stake: num(b.stake),
    result: BRIDGE_RESULTS.includes(b.result) ? b.result : "pending",
    returned: num(b.returned), live: !!b.live, isParlay: !!b.isParlay,
    legs: Array.isArray(b.legs) ? b.legs.slice(0, 30).map((l) => ({ event: str(l && l.event), market: str(l && l.market, 80), sel: str(l && l.sel), odds: num(l && l.odds) || 0 })) : [],
    notes: str(b.notes, 500)
  })).filter((b) => b.extId && b.odds > 1);
}

const BRIDGE_L = {
  pt: { title: "Apostas do Doinp Bet Logger", sub: "Confira antes de adicionar. Esporte, liga, modelo e banca usam os padrões do tracker; edite depois se precisar.",
    add: "Adicionar {n}", later: "Depois", dismiss: "Descartar selecionadas", parlay: "Múltipla", legs: "pernas", all: "Todas" },
  en: { title: "Bets from Doinp Bet Logger", sub: "Check them before adding. Sport, league, model and bankroll use the tracker defaults; edit them afterwards if needed.",
    add: "Add {n}", later: "Later", dismiss: "Discard selected", parlay: "Parlay", legs: "legs", all: "All" }
};

function BridgeInbox({ view }) {
  const { state, dispatch, t, lang } = useTracker();
  const L = BRIDGE_L[lang] || BRIDGE_L.en;
  const [items, setItems] = useState([]);
  const [sel, setSel] = useState(() => new Set());
  const [open, setOpen] = useState(false);
  const cur = state.settings.currency;

  useEffect(() => {
    const onMsg = (e) => {
      if (e.source !== window || !e.data || e.data.source !== BRIDGE_EXT) return;
      if (e.data.type === "hello") bridgePost({ type: "ready" });
      else if (e.data.type === "bets") {
        const incoming = bridgeClean(e.data.bets);
        if (!incoming.length) return;
        setItems((prev) => { const have = new Set(prev.map((x) => x.extId)); return prev.concat(incoming.filter((x) => !have.has(x.extId))); });
        setSel((prev) => { const n = new Set(prev); incoming.forEach((x) => n.add(x.extId)); return n; });
      }
    };
    window.addEventListener("message", onMsg);
    bridgePost({ type: "ready" });
    return () => window.removeEventListener("message", onMsg);
  }, []);

  // only offer the inbox once a tracker file is open
  useEffect(() => { if (view === "app" && items.length) setOpen(true); }, [view, items.length]);

  const drop = (ids) => {
    const s = new Set(ids);
    setItems((prev) => prev.filter((x) => !s.has(x.extId)));
    setSel((prev) => { const n = new Set(prev); ids.forEach((id) => n.delete(id)); return n; });
  };

  const add = () => {
    const chosen = items.filter((x) => sel.has(x.extId));
    if (!chosen.length) return;
    const base = blankBet(state);
    const bets = chosen.map((x) => ({
      ...base,
      id: "b" + Math.random().toString(36).slice(2, 10),
      date: x.date, time: x.time, book: x.book || base.book,
      teamA: x.teamA || (x.isParlay ? L.parlay : "—"), teamB: x.teamB,
      market: x.market || (x.isParlay ? "Parlay" : base.market), line: x.line, side: x.side, live: x.live,
      odds: x.odds, stake: x.stake != null ? x.stake : base.stake, result: x.result, returned: x.returned,
      isParlay: x.isParlay, legs: x.legs, notes: x.notes,
      closingOdds: null, modelProb: null, minutes: null, projection: null, actual: null
    }));
    dispatch({ type: "add-bets", bets });
    bridgePost({ type: "imported", ids: chosen.map((x) => x.extId) });
    drop(chosen.map((x) => x.extId));
    if (chosen.length === items.length) setOpen(false);
  };
  const dismiss = () => {
    const ids = items.filter((x) => sel.has(x.extId)).map((x) => x.extId);
    if (!ids.length) return;
    bridgePost({ type: "dismissed", ids });
    drop(ids);
    if (ids.length === items.length) setOpen(false);
  };
  const toggle = (id) => setSel((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allOn = items.length > 0 && items.every((x) => sel.has(x.extId));

  if (!open || !items.length) return null;
  return (
    <Modal open={open} onClose={() => setOpen(false)} title={L.title} width={980}
      footer={<>
        <button className="trk-dangerlink" style={{ marginRight: "auto" }} onClick={dismiss} disabled={!sel.size}><Icon name="trash" size={15} /> {L.dismiss}</button>
        <Btn variant="ghost" onClick={() => setOpen(false)}>{L.later}</Btn>
        <Btn variant="primary" icon="check" onClick={add} disabled={!sel.size}>{L.add.replace("{n}", sel.size)}</Btn>
      </>}>
      <p className="trk-savenote"><Icon name="lock" size={14} /> {L.sub}</p>
      <div className="table-wrap trk-tablewrap">
        <table className="table trk-table">
          <thead>
            <tr>
              <th className="trk-th-check"><input type="checkbox" checked={allOn} aria-label={L.all}
                onChange={() => setSel(allOn ? new Set() : new Set(items.map((x) => x.extId)))} /></th>
              <th style={{ textAlign: "left" }}>{t("col.date")}</th>
              <th style={{ textAlign: "left" }}>{t("col.event")}</th>
              <th style={{ textAlign: "left" }}>{t("col.side")}</th>
              <th>{t("col.odds")}</th>
              <th>{t("col.stake")}</th>
              <th>{t("col.result")}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x.extId} className={sel.has(x.extId) ? "is-selected" : ""} onClick={() => toggle(x.extId)}>
                <td className="trk-td-check" onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={sel.has(x.extId)} onChange={() => toggle(x.extId)} aria-label={x.side || x.teamA} />
                </td>
                <td style={{ textAlign: "left", color: "var(--text-dim)" }}>{TRK.fmtDate(x.date)}{x.time ? " " + x.time : ""}</td>
                <td style={{ textAlign: "left" }}>
                  <div className="trk-cellmain">{x.isParlay ? L.parlay + " · " + x.legs.length + " " + L.legs : (x.teamA + (x.teamB ? " v " + x.teamB : ""))}</div>
                  <div className="trk-cellsub">{x.market}{x.live ? " · LIVE" : ""}</div>
                </td>
                <td style={{ textAlign: "left" }}>
                  <div className="trk-cellmain">{x.side || "—"}</div>
                  <div className="trk-cellsub">{x.book}</div>
                </td>
                <td style={{ fontWeight: 700 }}>{TRK.fmtOdds(x.odds)}</td>
                <td>{x.stake == null ? "—" : TRK.fmtMoney(x.stake, cur)}</td>
                <td><ResultBadge result={x.result} t={t} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
}

Object.assign(window, { BridgeInbox });
