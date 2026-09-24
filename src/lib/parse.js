/* =====================================================
   Doinp Bet Logger — pure text parsing (no DOM)
   Numbers (pt-BR / en), money, odds tokens (decimal /
   American / fractional), dates, event splitting and the
   PT/EN vocabulary used to recognise bet slips, receipts
   and bet-history cards. Loaded by content scripts, the
   popup and the Node tests. Exposes globalThis.DBL_PARSE.
   ===================================================== */
(function (root) {
  "use strict";

  /* ---------- text ---------- */
  // lowercase, strip accents, collapse whitespace
  function norm(s) {
    return String(s == null ? "" : s)
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .replace(/[   ]/g, " ")
      .toLowerCase().replace(/\s+/g, " ").trim();
  }
  function clean(s) { return String(s == null ? "" : s).replace(/[   ]/g, " ").replace(/\s+/g, " ").trim(); }

  /* ---------- numbers ---------- */
  // kind: "odds" (the separator is always decimal) | "amount" (may carry thousands separators)
  // locale: "pt" | "en" | null — only used to break the "1.250" / "1,250" tie for amounts
  function parseNumber(raw, kind, locale) {
    if (raw == null) return null;
    if (typeof raw === "number") return isFinite(raw) ? raw : null;
    var s = String(raw).replace(/[\s   ]/g, "").replace(/−/g, "-");
    s = s.replace(/[^\d.,\-+]/g, "");
    if (!/\d/.test(s)) return null;
    var neg = /^-/.test(s);
    s = s.replace(/[+\-]/g, "");
    var lc = s.lastIndexOf(","), ld = s.lastIndexOf(".");
    if (lc >= 0 && ld >= 0) {
      var dec = lc > ld ? "," : ".";
      var thou = dec === "," ? "." : ",";
      s = s.split(thou).join("").replace(dec, ".");
    } else if (lc >= 0 || ld >= 0) {
      var sep = lc >= 0 ? "," : ".";
      var parts = s.split(sep);
      if (parts.length > 2) {
        s = parts.join(""); // 1.234.567 -> thousands
      } else if (kind === "odds") {
        s = parts[0] + "." + parts[1];
      } else {
        var after = parts[1].length;
        if (after !== 3) {
          s = parts[0] + "." + parts[1];
        } else {
          // exactly three digits after a single separator: thousands or decimal?
          var loc = locale || "pt";
          var isThousands = (loc === "pt" && sep === ".") || (loc === "en" && sep === ",");
          s = isThousands ? parts.join("") : parts[0] + "." + parts[1];
        }
      }
    }
    var v = parseFloat(s);
    if (!isFinite(v)) return null;
    return neg ? -v : v;
  }

  /* ---------- money ---------- */
  // currency signs and codes (longest first so "US$" wins over "$")
  var CUR_SRC = "R\\$|US\\$|руб\\.?|zł|PLN|RUB|TRY|JPY|CNY|KRW|CHF|SEK|NOK|DKK|BRL|USD|EUR|GBP|TL|kr|\\$|€|£|₽|₺|¥|￥|円|元|₩|원";
  var CUR = "(" + CUR_SRC + ")";
  // "1 234,56" / "10 000" (space or narrow no-break space as the thousands separator) before the plain forms
  var NUM_AFTER = "-?\\d{1,3}(?:[\u00a0\u202f ]\\d{3})+(?:[.,]\\d{1,2})?|-?\\d[\\d.,]*\\d|\\d";
  var AMOUNT_RE = new RegExp(CUR + "\\s{0,3}(-?\\d[\\d.,\u00a0\u202f ]*\\d|\\d)|(" + NUM_AFTER + ")\\s{0,3}" + CUR, "g");
  // every currency-marked amount in a string
  function findAmounts(text, locale) {
    var out = [], m, s = String(text || "");
    AMOUNT_RE.lastIndex = 0;
    while ((m = AMOUNT_RE.exec(s))) {
      var cur = m[1] || m[4], num = m[2] || m[3];
      var v = parseNumber(num, "amount", locale || (cur === "R$" || cur === "BRL" ? "pt" : null));
      if (v != null) out.push({ value: v, currency: curCode(cur), index: m.index, raw: m[0] });
    }
    return out;
  }
  function curCode(c) {
    if (!c) return null;
    if (c === "R$" || c === "BRL") return "BRL";
    if (c === "€" || c === "EUR") return "EUR";
    if (c === "£" || c === "GBP") return "GBP";
    if (/^(₽|руб\.?|RUB)$/.test(c)) return "RUB";
    if (/^(zł|PLN)$/.test(c)) return "PLN";
    if (/^(₺|TL|TRY)$/.test(c)) return "TRY";
    if (/^(¥|￥|円|JPY)$/.test(c)) return "JPY"; // "¥" is also yuan: extract.js switches it to CNY on Chinese pages
    if (/^(元|CNY)$/.test(c)) return "CNY";
    if (/^(₩|원|KRW)$/.test(c)) return "KRW";
    if (/^(CHF|SEK|NOK|DKK)$/.test(c)) return c;
    if (c === "kr") return null; // Swedish, Norwegian or Danish crown: unknown which
    return "USD";
  }
  // a bare amount with or without a currency sign (used for input values / label rows)
  function parseAmount(text, locale) {
    var a = findAmounts(text, locale);
    if (a.length) return a[0].value;
    var m = String(text || "").match(/-?\d[\d.,\s]*\d|\d/);
    return m ? parseNumber(m[0], "amount", locale) : null;
  }

  /* ---------- odds ---------- */
  function americanToDecimal(a) { return a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a); }
  function validDecimal(v) { return v != null && v >= 1.01 && v <= 1001; }
  function r3(v) { return Math.round(v * 1000) / 1000; }

  // the WHOLE string is one odds token (how books render prices: their own element)
  // fmt: "auto" | "decimal" | "american" | "fractional"
  function exactOdds(text, fmt) {
    var t = clean(text).replace(/^@\s*/, "").replace(/^(odds?|cota(c|ç)(a|ã)o|cota)\s*:?\s*/i, "");
    fmt = fmt || "auto";
    // exchanges print prices with one or two decimals ("3.4", "2.52")
    if (fmt === "exchange") { var xm = t.match(/^\d{1,4}[.,]\d{1,2}$/); return xm ? exchangeOdds(t) : null; }
    if (fmt === "auto" || fmt === "decimal") {
      var d = t.match(/^(\d{1,3}[.,]\d{2,3})$/);
      if (d) { var v = parseNumber(d[1], "odds"); if (validDecimal(v)) return r3(v); }
      if (fmt === "decimal") return null;
    }
    if (fmt === "auto" || fmt === "american") {
      var a = t.replace(/−/g, "-").match(/^([+-])(\d{3,5})$/);
      if (a) { var n = parseInt(a[2], 10) * (a[1] === "-" ? -1 : 1); if (Math.abs(n) >= 100) return r3(americanToDecimal(n)); }
    }
    if (fmt === "fractional" || (fmt === "auto" && /^(evs|evens)$/i.test(t))) {
      if (/^(evs|evens)$/i.test(t)) return 2;
      var f = t.match(/^(\d{1,3})\/(\d{1,3})$/);
      if (f && +f[2] > 0) return r3(1 + (+f[1]) / (+f[2]));
    }
    return null;
  }

  // odds tokens embedded in running text (receipts, history cards, labels)
  var CUR_END_RE = new RegExp("(" + CUR_SRC + ")\\s*$", "i"), CUR_START_RE = new RegExp("^\\s*(" + CUR_SRC + ")", "i");
  var DEC_IN_TEXT = /(^|[^\d.,\/:+\-−$€£])(\d{1,3}[.,]\d{2,3})(?![\d.,%\/:])/g;
  function oddsInText(text, fmt) {
    var s = String(text || ""), out = [], m;
    if (fmt !== "american" && fmt !== "fractional") {
      DEC_IN_TEXT.lastIndex = 0;
      while ((m = DEC_IN_TEXT.exec(s))) {
        var before = s.slice(Math.max(0, m.index - 4), m.index + m[1].length);
        var after = s.slice(m.index + m[0].length, m.index + m[0].length + 5);
        if (CUR_END_RE.test(before)) continue;
        if (/^\s*(%|u\b)/i.test(after) || CUR_START_RE.test(after)) continue;
        var v = parseNumber(m[2], "odds");
        if (validDecimal(v)) out.push({ value: r3(v), index: m.index + m[1].length, raw: m[2] });
      }
    }
    if (!out.length && (fmt === "american" || fmt === "auto")) {
      var am = /(^|[^\w.,])([+\-−]\d{3,5})(?![\d.,])/g;
      while ((m = am.exec(s))) {
        var n = parseInt(m[2].replace("−", "-"), 10);
        if (Math.abs(n) >= 100) out.push({ value: r3(americanToDecimal(n)), index: m.index + m[1].length, raw: m[2] });
      }
    }
    if (!out.length && fmt === "fractional") {
      var fr = /(^|[^\d\/])(\d{1,3})\/(\d{1,3})(?![\d\/])/g;
      while ((m = fr.exec(s))) if (+m[3] > 0) out.push({ value: r3(1 + (+m[2]) / (+m[3])), index: m.index + m[1].length, raw: m[2] + "/" + m[3] });
    }
    return out;
  }

  /* ---------- vocabulary (matched against norm()ed text) ---------- */
  var V = {
    // class / id / data-* / aria attributes of a bet-slip container
    slipAttr: /bet.?slip|betslip|slip|cupom|cupon|coupon|bilhete|boletim|ticket|carrinho|basket|bet-?builder/i,
    // the button that places the bet
    placePt: /^(fazer|efetuar|confirmar|finalizar|colocar|realizar)\s+(a\s+|as\s+|sua\s+)?apostas?\b|^apostar\b|^aposte\b|\be\s+apostar\b/,
    // "Place Bet", "Place bets £10" — never a bare "Place …" ("Place order" on a shop must not count)
    placeEn: /^place\s+(a\s+|my\s+|your\s+)?(bets?|wagers?)\b|^bet\s+now\b|^confirm\s+(my\s+)?bets?\b|^submit\s+bets?\b|\band\s+place\s+bets?\b/,
    // text that shows the bet went through
    receipt: /apostas?\s+(foi\s+|foram\s+)?(feitas?|realizadas?|confirmadas?|aceitas?|efetuadas?|registradas?|colocadas?)|sua aposta foi|bets?\s+(has been\s+|have been\s+)?(placed|accepted|confirmed)|bet receipt|your bet has|comprovante|recibo( da aposta)?|(n[oº°]|numero|id|codigo|referencia|ref\.?)\s*(da\s+)?aposta|bet\s*(id|ref|reference|number)\b/,
    // text that shows it did NOT go through
    error: /saldo insuficiente|insufficient (funds|balance)|\berro\b|\berror\b|rejeitad|rejected|recusad|declined|falhou|\bfailed\b|nao foi possivel|could not|unable to|(odds?|cotas?|cotacoes)\s+(mudaram|mudou|alterad|changed)|mercado (suspenso|fechado|indisponivel)|market (suspended|closed|unavailable)|selecao (suspensa|indisponivel)|stake (too|exceeds)|aposta maxima|maximum stake|faca (o )?login|entre na sua conta|please (log|sign) in/,
    stakeLabel: /^(valor( da aposta| apostado| total)?|stake|total stake|aposta( total)?|total apostado|montante|quantia|entrada|wager|risk)\b/,
    returnLabel: /(retorno|ganhos?|possiveis ganhos|ganho potencial|premio|pagamento|payout|potential|to return|returns?)\b/,
    totalOddsLabel: /(odds?|cotacao|cota)\s*(total|totais|combinada)|total\s*(odds|cotacao)|odds? acumuladas?/,
    live: /\bao vivo\b|\blive\b|in.?play|\bem jogo\b/,
    parlay: /multipla|acumulad|combinad|parlay|accumulator|\bacca\b|\bmultiple\b/,
    market: /\b(resultado final|1x2|match (result|winner)|to win( the)?( match| fight| game)?|winner|vencedor( da partida| do jogo)?|para (vencer|ganhar)|run line|puck line|total runs|runs|corridas|moneyline|money line|handicap|asian|asiatic\w*|totals?|totais|mais\/menos|mais de|menos de|over|under|ambas|btts|both teams|dupla chance|double chance|escanteios?|corners?|cart(a|o)(es)?|cards?|gols?|goals?|pontos|points|rebotes|rebounds|assistencias|assists|jogador|player|mapa|map|set|placar|correct score|empate anula|draw no bet|spread|dnb|intervalo|half|periodo|quarter|tempo|marcar|to score|scorer|goleador)\b/,
    noise: /^(remover|remove|x|×|fechar|close|editar|edit|limpar|clear|limpar tudo|remove all|excluir|delete|ok|✕|✖)$/
  };
  // exact status labels on bet-history cards
  var STATUS = {
    "ganhou": "won", "ganha": "won", "ganho": "won", "vencedora": "won", "won": "won", "win": "won", "winner": "won", "green": "won", "paga": "won", "paid": "won",
    "perdeu": "lost", "perdida": "lost", "perdido": "lost", "lost": "lost", "loss": "lost", "lose": "lost", "red": "lost",
    "anulada": "void", "anulado": "void", "cancelada": "void", "cancelado": "void", "void": "void", "voided": "void", "reembolsada": "void", "devolvida": "void", "refunded": "void", "push": "push",
    "cash out": "cashout", "cashout": "cashout", "cashed out": "cashout", "encerrada": "cashout", "encerrado": "cashout",
    "pendente": "pending", "em aberto": "pending", "aberta": "pending", "aberto": "pending", "open": "pending", "pending": "pending", "ativa": "pending", "unsettled": "pending",
    "meio ganho": "half-won", "half won": "half-won", "meia vitoria": "half-won",
    "meia derrota": "half-lost", "meio perdido": "half-lost", "half lost": "half-lost"
  };
  // "½ Won" / "½ Void" style tags inside a settled card (Asian quarter lines)
  var HALF_WON = /(\u00bd|1\/2)\s*(won|win|ganh\w*|vit\w*)|half[\s-]?won|meio ganho|meia vitoria/;
  var HALF_LOST = /(\u00bd|1\/2)\s*(lost|loss|lose|perd\w*|derrot\w*)|half[\s-]?lost|meia derrota|meio perdido/;
  var HALF_TAG_STRIP = /(\u00bd|1\/2)\s*(won|win|void|lost|loss|push|ganhou|ganho|perdeu|perdido|anulad[ao]|devolvid[ao]|reembolsad[ao])/gi;
  function halfResult(text) { var n = norm(text); return HALF_WON.test(n) ? "half-won" : HALF_LOST.test(n) ? "half-lost" : null; }
  // lines that are page chrome, promos or bare symbols, never part of a bet's description
  var CUR_ONLY_RE = new RegExp("^(" + CUR_SRC + ")$", "i");
  var UI_NOISE = /^(live alerts?|alertas?( ao vivo)?|reuse selections?|reutilizar( selecoes)?|early payout|pagamento antecipado|cash ?out|encerrar aposta|share|compartilhar|editar aposta|edit bet|bet builder|criar aposta|boost(ed)?|turbinad[ao]|super odds?|returned|devolvido|stake|valor|retorno|return|to return|odds?)$/;
  var PROMO_STRIP = /\b(early payout|pagamento antecipado|boosted|turbinad[ao]|bet boost|super odds?)\b/gi;
  function isNoiseLine(l) {
    var n = norm(l);
    if (!n) return true;
    if (!/\p{L}/u.test(n)) return true;                          // no letters (any script): scores, bare numbers
    if (CUR_ONLY_RE.test(n)) return true;                       // a currency sign on its own
    return UI_NOISE.test(n) || V.receipt.test(n);
  }
  // slip headers like "1 Selections" / "2 Seleções" / "Singles" glued onto a selection row
  var COUNT_WORD = /\b(selections?|sele[c\u00e7](?:ao|\u00e3o|oes|\u00f5es)|singles?|simples)\b/i;
  function stripTags(l) {
    var t = clean(String(l).replace(HALF_TAG_STRIP, " ").replace(PROMO_STRIP, " ").replace(/\s*\[\s*\d{1,3}\s*[-:]\s*\d{1,3}\s*\]/g, " "));
    if (COUNT_WORD.test(t)) t = clean(t.replace(new RegExp(COUNT_WORD.source, "gi"), " ").replace(/^\d{1,2}\s+(?=\D)/, ""));
    // "Under 11.5 11.5": a line drawn twice on one row
    return t.split(" ").filter(function (w, i, a) { return i === 0 || w !== a[i - 1]; }).join(" ");
  }

  /* ---------- other languages: src/vocab/<lang>.js, loaded before this file ----------
     Each file lists plain words; they are normalized like page text (norm()) and compiled
     into the regexes above. Latin / Cyrillic words need a letter boundary on both sides;
     Chinese, Japanese and Korean have no spaces between words, so theirs match anywhere
     (single-character words are left out of those files for that reason). */
  var VOC = root.DBL_VOCAB || {};
  var CJK = /[ᄀ-ᇿ぀-ヿ㄰-㆏㐀-鿿가-힯豈-﫿]/;
  function esc(w) { return w.replace(/[.*+?^${}()|[\]\\\/]/g, "\\$&"); }
  // every word under `key` in every language file, normalized, longest first
  function vocab(key) {
    var seen = {}, out = [];
    Object.keys(VOC).forEach(function (l) {
      var v = VOC[l] && VOC[l][key];
      if (!v) return;
      (Array.isArray(v) ? v : Object.keys(v)).forEach(function (w) { var n = norm(w); if (n && !seen[n]) { seen[n] = 1; out.push(n); } });
    });
    return out.sort(function (a, b) { return b.length - a.length; });
  }
  function alt(list) {
    return list.map(function (w) {
      var e = esc(w).replace(/ /g, "\\s+");
      return CJK.test(w) ? e : "(?<![\\p{L}\\p{N}])" + e + "(?![\\p{L}\\p{N}])";
    }).join("|");
  }
  // how: "any" (anywhere) | "start" (at the start of the text) | "whole" (the whole text)
  function vocabSrc(key, how) {
    var list = vocab(key);
    if (!list.length) return null;
    var a = "(?:" + alt(list) + ")";
    return how === "start" ? "^" + a : how === "whole" ? "^" + a + "$" : a;
  }
  // the built-in PT/EN regex OR the other languages' words (unicode mode for \p{L})
  function widen(re, key, how, flags) {
    var x = vocabSrc(key, how);
    return x ? new RegExp("(?:" + re.source + ")|" + x, (flags || "") + "u") : re;
  }
  // the text after a place-bet word: nothing, or an amount ("Wette platzieren 10,00 €")
  var AFTER_PLACE = "(?=$|[\\s\\d.,:()\\-])";
  var PLACE_X = vocabSrc("place", "start");
  var PLACE_X_RE = PLACE_X ? new RegExp(PLACE_X + AFTER_PLACE, "u") : null;
  // Grammar, so wording no one listed still works: a verb, up to three words, a bet noun
  // ("Confirm 1 single bet", "Confirmar 1 simples aposta", "Place 2 bets", "Fazer minhas apostas"),
  // or noun first for German / Dutch / Turkish ("Wette jetzt platzieren", "Bahisleri onayla").
  var VERBS = vocab("placeVerb").map(esc).join("|"), NOUNS = vocab("betNoun").map(esc).join("|");
  var MID = "(?:\\s+[\\p{L}\\p{N}()'\u2019.]+)";
  var PLACE_GRAMMAR = VERBS && NOUNS ? new RegExp("^(?:(?:" + VERBS + ")" + MID + "{0,3}?\\s+(?:" + NOUNS + ")|(?:" + NOUNS + ")" + MID + "{0,2}?\\s+(?:" + VERBS + "))" + AFTER_PLACE, "u") : null;
  // a text that talks about a bet ("Bet Accepted", "Aceitar aposta", "投注成功") — a shop's "Order placed" doesn't
  var BET_NOUN_RE = NOUNS ? new RegExp(alt(vocab("betNoun")), "u") : /(?!)/;
  function hasBetNoun(text) { return BET_NOUN_RE.test(norm(text)); }
  var PLACE_VERB_START = new RegExp("^(?:" + (VERBS || "(?!)") + ")(?![\\p{L}])", "u");
  var PM_PLACE_SRC = vocabSrc("pmPlace", "start");
  var PM_PLACE_RE = PM_PLACE_SRC ? new RegExp(PM_PLACE_SRC + AFTER_PLACE, "u") : null;
  var HISTORY_LINK = widen(/minhas apostas|my bets|historico|history|apostas abertas|open bets/, "history", "any");
  V.receipt = widen(V.receipt, "receipt", "any");
  V.error = widen(V.error, "error", "any");
  V.stakeLabel = widen(V.stakeLabel, "stake", "start");
  V.returnLabel = widen(V.returnLabel, "ret", "start");
  V.totalOddsLabel = widen(V.totalOddsLabel, "totalOdds", "start");
  V.live = widen(V.live, "live", "any");
  V.parlay = widen(V.parlay, "parlay", "any");
  V.market = widen(V.market, "market", "any");
  V.noise = widen(V.noise, "noise", "whole");
  V.types = new RegExp(vocabSrc("types", "whole") || "(?!)", "u");
  HALF_WON = widen(HALF_WON, "halfWon", "any");
  HALF_LOST = widen(HALF_LOST, "halfLost", "any");
  var HALF_WORDS = vocabSrc("halfWon", "any"), HALF_WORDS_L = vocabSrc("halfLost", "any");
  if (HALF_WORDS || HALF_WORDS_L) HALF_TAG_STRIP = new RegExp("(?:" + HALF_TAG_STRIP.source + ")" + (HALF_WORDS ? "|" + HALF_WORDS : "") + (HALF_WORDS_L ? "|" + HALF_WORDS_L : ""), "giu");
  Object.keys(VOC).forEach(function (l) {
    var st = VOC[l] && VOC[l].status || {};
    Object.keys(st).forEach(function (w) { var n = norm(w); if (st[w] && !STATUS[n]) STATUS[n] = st[w]; });
  });
  // exchanges and prediction markets (also PT / EN: those words live in the vocab files only)
  var X = {
    back: vocabSrc("back", "whole"), lay: vocabSrc("lay", "whole"), liability: vocabSrc("liability", "start"),
    yes: vocabSrc("yes", "whole"), no: vocabSrc("no", "whole"), buy: vocabSrc("buy", "whole"), sell: vocabSrc("sell", "whole"),
    toWin: vocabSrc("toWin", "start"), shares: vocabSrc("shares", "start"), avgPrice: vocabSrc("avgPrice", "start"), fee: vocabSrc("fee", "start")
  };
  Object.keys(X).forEach(function (k) { X[k] = new RegExp(X[k] || "(?!)", "u"); });
  var TODAY_RE = widen(/\b(hoje|today)\b/, "today", "any"), YESTERDAY_RE = widen(/\b(ontem|yesterday)\b/, "yesterday", "any");

  // Which outcome explains a settled return?  stake S, decimal odds o, return R.
  //   won S*o | half-won S/2*o + S/2 | void/push S | half-lost S/2 | lost 0
  // Returns { result, expected } for the match (the site's own label wins ties), or null
  // (cash-out, odds changed, or a stake/odds read wrongly).
  function inferResult(stake, odds, ret, label) {
    if (!(stake > 0 && odds > 1 && ret != null && ret >= 0)) return null;
    var c = [["won", stake * odds], ["half-won", stake / 2 * odds + stake / 2], ["void", stake], ["half-lost", stake / 2], ["lost", 0]];
    var tol = Math.max(0.02, 0.005 * stake * odds);
    var hits = c.filter(function (x) { return Math.abs(x[1] - ret) <= tol; });
    if (!hits.length) return null;
    var pick = hits.filter(function (x) { return x[0] === label || (label === "push" && x[0] === "void"); })[0];
    if (!pick) pick = hits.sort(function (a, b) { return Math.abs(a[1] - ret) - Math.abs(b[1] - ret); })[0];
    return { result: pick[0] === "void" && label === "push" ? "push" : pick[0], expected: Math.round(pick[1] * 100) / 100 };
  }

  function statusOf(text) { var n = norm(text).replace(/[.!:]+$/, ""); return STATUS[n] || null; }

  // kind: "prediction" also accepts prediction-market order buttons ("Trade", "Buy Yes"),
  // which would be far too broad on any other site
  function isPlaceButton(text, kind) {
    var n = norm(text);
    if (!n || n.length > 48) return false;
    // "Fazer minhas apostas" is an action; "Minhas apostas" alone is the history link
    if (PLACE_GRAMMAR && PLACE_VERB_START.test(n) && PLACE_GRAMMAR.test(n)) return true;
    if (HISTORY_LINK.test(n)) return false;
    if (V.placePt.test(n) || V.placeEn.test(n) || (PLACE_X_RE && PLACE_X_RE.test(n)) || (PLACE_GRAMMAR && PLACE_GRAMMAR.test(n))) return true;
    return kind === "prediction" && !!PM_PLACE_RE && PM_PLACE_RE.test(n);
  }

  /* ---------- events / selections ---------- */
  var VS_RE = /\s+(?:v|vs\.?|versus|x|-|–|—|@)\s+|\s*-vs\.?-\s*/i;
  function splitEvent(text) {
    var t = clean(text);
    var parts = t.split(VS_RE);
    if (parts.length === 2 && parts[0].length > 1 && parts[1].length > 1) return { teamA: parts[0], teamB: parts[1] };
    return null;
  }
  // a line number from a selection like "Mais de 2.5" / "Over 224.5" / "Celtics -4.5"
  function lineOf(sel) {
    var n = norm(sel);
    var m = n.match(/(?:mais de|menos de|over|under|acima de|abaixo de|\bo\b|\bu\b)\s*([\d.,]+)/);
    if (m) return String(parseNumber(m[1], "odds"));
    // split Asian line: "Grorud 0.0,+0.5" / "Team -0.5,-1.0"
    m = clean(sel).replace(/\u2212/g, "-").match(/\s([+\-]?\d+(?:\.\d+)?\s*,\s*[+\-]?\d+(?:\.\d+)?)\s*\)?$/);
    if (m) return m[1].replace(/\s+/g, "");
    m = clean(sel).replace(/−/g, "-").match(/([+\-]\d+(?:[.,]\d+)?)\s*\)?$/);
    if (m) return m[1].replace(",", ".");
    return "";
  }

  /* ---------- dates ---------- */
  var MONTHS = { jan: 1, fev: 2, feb: 2, mar: 3, abr: 4, apr: 4, mai: 5, may: 5, jun: 6, jul: 7, ago: 8, aug: 8, set: 9, sep: 9, sept: 9, out: 10, oct: 10, nov: 11, dez: 12, dec: 12,
    janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6, julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    january: 1, february: 2, march: 3, april: 4, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12 };
  Object.keys(VOC).forEach(function (l) {
    var mo = VOC[l] && VOC[l].months || {};
    Object.keys(mo).forEach(function (w) { var n = norm(w).replace(/\.$/, ""); if (!(n in MONTHS)) MONTHS[n] = mo[w]; });
  });
  function pad(n) { return String(n).padStart(2, "0"); }
  // LOCAL calendar date (never toISOString: that is the UTC day)
  function localISO(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
  function localTime(d) { return pad(d.getHours()) + ":" + pad(d.getMinutes()); }
  function mk(y, m, d) {
    if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31)) return null;
    var dt = new Date(y, m - 1, d);
    return dt.getMonth() === m - 1 ? localISO(dt) : null;
  }
  // first date in a string -> { date: "YYYY-MM-DD", time: "HH:MM" | "" }
  // monthFirst: true for en-US pages; pt pages are day-first
  function findDate(text, now, monthFirst) {
    now = now || new Date();
    var s = norm(text), date = null, m;
    var tm = s.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/);
    var time = tm ? pad(+tm[1]) + ":" + tm[2] : "";
    if ((m = s.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/))) date = mk(+m[1], +m[2], +m[3]);
    if (!date && (m = s.match(/\b(\d{1,2})[\/.](\d{1,2})[\/.](\d{2,4})\b/))) {
      var y = +m[3]; if (y < 100) y += 2000;
      date = monthFirst ? mk(y, +m[1], +m[2]) : mk(y, +m[2], +m[1]);
    }
    // Chinese / Japanese "2026年9月24日", "9月24日" and Korean "9월 24일" (read before norm(), which splits Hangul)
    var raw = String(text || "").normalize("NFC");
    if (!date && (m = raw.match(/(?:(20\d{2})\s*[年년]\s*)?(\d{1,2})\s*[月월]\s*(\d{1,2})\s*[日일]/))) {
      date = mk(m[1] ? +m[1] : now.getFullYear(), +m[2], +m[3]);
      if (date && !m[1] && date > localISO(now)) date = mk(now.getFullYear() - 1, +m[2], +m[3]);
    }
    if (!date && (m = s.match(/(?<![\p{L}\d])(\d{1,2})\.?(?:\s+de)?\s+(\p{L}{3,12})\.?(?:\s+de)?(?:\s+(20\d{2}))?(?![\p{L}\d])/u)) && MONTHS[m[2]]) {
      date = mk(m[3] ? +m[3] : now.getFullYear(), MONTHS[m[2]], +m[1]);
      if (date && !m[3] && date > localISO(now)) date = mk(now.getFullYear() - 1, MONTHS[m[2]], +m[1]);
    }
    if (!date && (m = s.match(/(?<![\p{L}\d])(\p{L}{3,12})\.?\s+(\d{1,2}),?(?:\s+(20\d{2}))?(?![\p{L}\d])/u)) && MONTHS[m[1]]) {
      date = mk(m[3] ? +m[3] : now.getFullYear(), MONTHS[m[1]], +m[2]);
      if (date && !m[3] && date > localISO(now)) date = mk(now.getFullYear() - 1, MONTHS[m[1]], +m[2]);
    }
    if (!date && (m = s.match(/\b(\d{1,2})\/(\d{1,2})\b/)) && !/\d\/\d{1,2}\/\d/.test(s)) {
      var a = +m[1], b = +m[2];
      date = monthFirst ? mk(now.getFullYear(), a, b) : mk(now.getFullYear(), b, a);
      if (date && date > localISO(now)) date = monthFirst ? mk(now.getFullYear() - 1, a, b) : mk(now.getFullYear() - 1, b, a);
    }
    if (!date && TODAY_RE.test(s)) date = localISO(now);
    if (!date && YESTERDAY_RE.test(s)) { var y2 = new Date(now); y2.setDate(y2.getDate() - 1); date = localISO(y2); }
    return date ? { date: date, time: time } : null;
  }

  /* ---------- book name from a hostname ---------- */
  var TWO_PART = ["bet.br", "com.br", "net.br", "org.br", "co.uk", "org.uk", "com.au", "co.za", "com.mx", "com.ar", "com.co", "co.nz", "com.pe", "com.pt", "co.in"];
  // registrable domain guess (no public-suffix list): sports.betano.bet.br -> betano.bet.br
  function baseDomain(host) {
    var h = String(host || "").toLowerCase().replace(/^www\./, "");
    if (/^\d+(\.\d+){3}$/.test(h)) return h; // an IP address has no registrable domain
    var parts = h.split(".");
    if (parts.length <= 2) return h;
    var last2 = parts.slice(-2).join(".");
    return TWO_PART.indexOf(last2) >= 0 ? parts.slice(-3).join(".") : last2;
  }
  // match patterns for a site's domains ("*." also matches the bare domain; IPs/localhost can't take "*.")
  function originsFor(domains) {
    return domains.map(function (d) { return /^(\d+\.){3}\d+$|^localhost$/.test(d) ? "*://" + d + "/*" : "*://*." + d + "/*"; });
  }
  function bookFromHost(host) {
    var b = baseDomain(host).split(".")[0] || String(host || "");
    return b.charAt(0).toUpperCase() + b.slice(1);
  }

  /* ---------- a line that is only a date ("24/09 15:30", "heute 15:30", "9月24日") ---------- */
  function isDateLine(text) {
    var l = clean(text);
    if (!l || l.length > 32 || !findDate(l)) return false;
    var rest = norm(l).split(/[\s,.\/:\-]+/).filter(function (w) {
      return w && !/^\d+[a-z]{0,2}$/.test(w) && !(w in MONTHS) && !TODAY_RE.test(w) && !YESTERDAY_RE.test(w) && !/^(de|as|at|um|a|le|il|в|у)$/.test(w);
    });
    return !rest.join("").replace(/[\d年月日월일h]/g, "").match(/\p{L}/u);
  }

  /* ---------- exchanges (back / lay) ---------- */
  // exchange prices: 1.01–1000 with up to two decimals, integers included ("2.5", "10", "1.01")
  function exchangeOdds(text) {
    var m = clean(text).match(/^(\d{1,4})(?:[.,](\d{1,2}))?$/);
    if (!m) return null;
    var v = parseFloat(m[1] + (m[2] ? "." + m[2] : ""));
    return v >= 1.01 && v <= 1000 ? v : null;
  }
  // "back" | "lay" | null for a label ("Back", "Lay (Bet Against)", "A favor", "Contra")
  function exchangeSide(text) { var n = norm(text); return X.back.test(n) ? "back" : X.lay.test(n) ? "lay" : null; }
  function liabilityLabel(text) { return X.liability.test(norm(text)); }
  // commission c is a fraction (0.05 = 5 %), charged on net winnings.
  // back S @ B:  wins S(B-1)(1-c), loses S          lay S @ L:  wins S(1-c), loses S(L-1)
  function exchangeProfit(dir, odds, stake, c, result) {
    c = c || 0;
    if (!(odds > 1 && stake > 0)) return null;
    if (result === "void" || result === "push") return 0;
    if (dir === "lay") return result === "won" ? stake * (1 - c) : result === "lost" ? -stake * (odds - 1) : null;
    return result === "won" ? stake * (odds - 1) * (1 - c) : result === "lost" ? -stake : null;
  }
  // settle an exchange bet from the profit/loss the site shows. Books show P/L before or
  // after commission, so both are accepted.
  function inferExchange(dir, odds, stake, c, pl) {
    if (!(odds > 1 && stake > 0) || pl == null) return null;
    var tol = Math.max(0.02, 0.005 * stake * odds);
    var cands = [["void", 0], ["won", exchangeProfit(dir, odds, stake, 0, "won")], ["won", exchangeProfit(dir, odds, stake, c, "won")], ["lost", exchangeProfit(dir, odds, stake, c, "lost")]];
    var hit = cands.filter(function (x) { return Math.abs(x[1] - pl) <= tol; })[0];
    return hit ? { result: hit[0], expected: Math.round(hit[1] * 100) / 100 } : null;
  }

  /* ---------- prediction markets (Polymarket, Kalshi, …) ---------- */
  // "35¢" / "0.3¢" / "Yes 35¢" / "Buy No 66¢" / "Yes $0.35" → { side: "yes"|"no"|null, price: 0–1 }
  function centsPrice(text) {
    var t = clean(text), m;
    var price = null, lead = t;
    if ((m = t.match(/^(.*?)\s*(\d{1,2}(?:[.,]\d{1,2})?)\s*¢$/))) { price = parseFloat(m[2].replace(",", ".")) / 100; lead = m[1]; }
    else if ((m = t.match(/^(.*?)\s*\$\s*(0?[.,]\d{1,4})$/))) { price = parseFloat("0." + m[2].split(/[.,]/)[1]); lead = m[1]; }
    if (price == null || !(price > 0 && price < 1)) return null;
    var words = norm(lead).split(" ").filter(function (w) { return w && !X.buy.test(w) && !X.sell.test(w); }).join(" ");
    var side = !words ? null : X.yes.test(words) ? "yes" : X.no.test(words) ? "no" : undefined;
    if (side === undefined) return null; // "Arsenal 35¢" is not a Yes / No price
    if (side === null && /\$/.test(t)) return null; // "$0.35" alone is an amount (a fee), not a price
    return { side: side, price: Math.round(price * 10000) / 10000 };
  }
  function isYesNo(text) { var n = norm(text); return X.yes.test(n) ? "yes" : X.no.test(n) ? "no" : null; }
  function pmLabel(text, key) { return X[key].test(norm(text)); }
  // a bought position pays 1 per share if it resolves your way: result from what came back
  function inferPrediction(shares, ret) {
    if (!(shares > 0) || ret == null) return null;
    var tol = Math.max(0.02, shares * 0.002);
    return Math.abs(ret - shares) <= tol ? { result: "won", expected: shares } : Math.abs(ret) <= tol ? { result: "lost", expected: 0 } : null;
  }

  /* ---------- what a tracker that only knows back bets should record ----------
     Profit must come out exact, so every kind of bet becomes an equivalent back bet:
       exchange back S @ B, commission c →  stake S,        odds 1 + (B-1)(1-c)
       exchange lay  S @ L, commission c →  stake S(L-1),   odds 1 + (1-c)/(L-1)   ("Lay: X": you win when X doesn't)
       prediction: cost C + fee F, N shares → stake C+F,   odds N / (C+F)          (each share pays 1)
     The raw figures travel next to it (CSV extra columns, tracker notes). */
  function trackerView(b) {
    var k = b.kind || "sportsbook", c = (b.commission || 0) / 100, out = { stake: b.stake, odds: b.odds, side: b.side || "", extra: "" };
    if (k === "exchange" && b.odds > 1 && b.stake > 0) {
      if (b.dir === "lay") {
        out.stake = r2(b.stake * (b.odds - 1));
        // odds from the rounded stake, so the winning profit S(1-c) is exact
        out.odds = r6(1 + b.stake * (1 - c) / out.stake);
        out.side = "Lay: " + (b.side || "");
        out.extra = "Lay " + b.odds + " · backer's stake " + r2(b.stake) + " · liability " + out.stake;
      } else {
        out.odds = r6(1 + (b.odds - 1) * (1 - c));
        out.extra = "Back " + b.odds;
      }
      if (c) out.extra += " · commission " + b.commission + "%";
    } else if (k === "prediction" && b.stake > 0) {
      var cost = b.stake + (b.fee || 0);
      var shares = b.shares > 0 ? b.shares : (b.price > 0 ? b.stake / b.price : null);
      if (shares) { out.stake = r2(cost); out.odds = r6(shares / out.stake); }
      out.extra = (b.dir ? b.dir.toUpperCase() + " " : "") + (b.price ? Math.round(b.price * 1000) / 10 + "¢" : "") + (shares ? " · " + r2(shares) + " shares" : "") + (b.fee ? " · fee " + r2(b.fee) : "");
    }
    return out;
  }
  function r2(v) { return Math.round(v * 100) / 100; }
  function r4(v) { return Math.round(v * 10000) / 10000; }
  // converted odds keep 6 decimals: the profit stays exact to the cent even on a large liability
  function r6(v) { return Math.round(v * 1e6) / 1e6; }

  /* ---------- which kind of site ---------- */
  // known exchanges and prediction markets; anything else is a sportsbook unless set in Settings
  var PREDICTION_HOSTS = /(^|\.)(polymarket\.com|polymarket\.us|kalshi\.com|predictit\.org)$/;
  var EXCHANGE_HOSTS = /(^|\.)(smarkets\.com|matchbook\.com|betdaq\.com)$/;
  function kindFor(host, path) {
    var h = String(host || "").toLowerCase();
    if (PREDICTION_HOSTS.test(h)) return "prediction";
    if (EXCHANGE_HOSTS.test(h)) return "exchange";
    // Betfair runs a sportsbook and an exchange on the same domain
    if (/(^|\.)betfair\./.test(h) && (/^\/exchange\b/.test(path || "") || /^exchange\./.test(h))) return "exchange";
    return "sportsbook";
  }

  /* ---------- misc ---------- */
  function near(a, b, relTol) { return a != null && b != null && Math.abs(a - b) <= Math.max(0.011, Math.abs(b) * (relTol || 0.02)); }
  function product(list) { return list.reduce(function (p, v) { return p * v; }, 1); }

  root.DBL_PARSE = {
    norm: norm, clean: clean, parseNumber: parseNumber, parseAmount: parseAmount, findAmounts: findAmounts,
    exactOdds: exactOdds, oddsInText: oddsInText, americanToDecimal: americanToDecimal,
    V: V, statusOf: statusOf, isPlaceButton: isPlaceButton, halfResult: halfResult, isNoiseLine: isNoiseLine, stripTags: stripTags, inferResult: inferResult,
    splitEvent: splitEvent, lineOf: lineOf, findDate: findDate, localISO: localISO, localTime: localTime,
    baseDomain: baseDomain, bookFromHost: bookFromHost, originsFor: originsFor, near: near, product: product, r3: r3, r2: r2,
    CUR_SRC: CUR_SRC, isDateLine: isDateLine, vocab: vocab, kindFor: kindFor, r4: r4, X: X, hasBetNoun: hasBetNoun,
    exchangeOdds: exchangeOdds, exchangeSide: exchangeSide, liabilityLabel: liabilityLabel, exchangeProfit: exchangeProfit, inferExchange: inferExchange,
    centsPrice: centsPrice, isYesNo: isYesNo, pmLabel: pmLabel, inferPrediction: inferPrediction, trackerView: trackerView
  };
})(typeof globalThis !== "undefined" ? globalThis : this);
