/* Doinp Bet Logger — detection words: Türkçe (tr).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["tr"] = {
 "place": [
  "bahis yap",
  "bahsi yap",
  "bahis oyna",
  "kuponu onayla",
  "bahsi onayla",
  "hemen oyna",
  "oyna"
 ],
 "receipt": [
  "bahis alındı",
  "bahsiniz alındı",
  "bahis kabul edildi",
  "bahis onaylandı",
  "kuponunuz oynandı",
  "kupon numarası",
  "bahis numarası",
  "kupon no"
 ],
 "error": [
  "yetersiz bakiye",
  "bakiye yetersiz",
  "hata",
  "reddedildi",
  "başarısız",
  "oran değişti",
  "oranlar değişti",
  "market askıya alındı",
  "piyasa kapalı",
  "maksimum bahis",
  "giriş yapın"
 ],
 "stake": [
  "bahis tutarı",
  "tutar",
  "miktar",
  "toplam bahis",
  "yatırılan"
 ],
 "ret": [
  "olası kazanç",
  "potansiyel kazanç",
  "muhtemel kazanç",
  "kazanç",
  "ödeme"
 ],
 "totalOdds": [
  "toplam oran"
 ],
 "live": [
  "canlı"
 ],
 "parlay": [
  "kombine",
  "kombinasyon",
  "sistem",
  "çoklu"
 ],
 "types": [
  "tekli",
  "kombine",
  "sistem"
 ],
 "market": [
  "maç sonucu",
  "kazanan",
  "handikap",
  "asya handikap",
  "üst",
  "alt",
  "gol",
  "korner",
  "kart",
  "karşılıklı gol",
  "çifte şans",
  "beraberlikte iade",
  "skor",
  "ilk yarı",
  "oyuncu",
  "sayı",
  "harita"
 ],
 "status": {
  "kazandı": "won",
  "kazanan": "won",
  "kaybetti": "lost",
  "kaybeden": "lost",
  "iptal": "void",
  "iade": "void",
  "iade edildi": "void",
  "açık": "pending",
  "beklemede": "pending",
  "devam ediyor": "pending",
  "bozduruldu": "cashout",
  "nakit çekildi": "cashout"
 },
 "halfWon": [
  "yarı kazandı",
  "yarım kazandı"
 ],
 "halfLost": [
  "yarı kaybetti",
  "yarım kaybetti"
 ],
 "noise": [
  "kaldır",
  "kapat",
  "temizle",
  "düzenle",
  "sil"
 ],
 "history": [
  "bahislerim",
  "kuponlarım",
  "geçmiş",
  "açık bahisler"
 ],
 "months": {
  "ocak": 1,
  "oca": 1,
  "şubat": 2,
  "şub": 2,
  "mart": 3,
  "nisan": 4,
  "nis": 4,
  "mayıs": 5,
  "may": 5,
  "haziran": 6,
  "haz": 6,
  "temmuz": 7,
  "tem": 7,
  "ağustos": 8,
  "ağu": 8,
  "eylül": 9,
  "eyl": 9,
  "ekim": 10,
  "eki": 10,
  "kasım": 11,
  "kas": 11,
  "aralık": 12,
  "ara": 12
 },
 "today": [
  "bugün"
 ],
 "yesterday": [
  "dün"
 ],
 "back": [
  "lehine",
  "back"
 ],
 "lay": [
  "aleyhine",
  "lay"
 ],
 "liability": [
  "sorumluluk",
  "risk"
 ],
 "yes": [
  "evet"
 ],
 "no": [
  "hayır"
 ],
 "buy": [
  "al"
 ],
 "sell": [
  "sat"
 ],
 "toWin": [
  "kazanılacak",
  "ödeme"
 ],
 "shares": [
  "hisse",
  "kontrat"
 ],
 "avgPrice": [
  "ortalama fiyat"
 ],
 "fee": [
  "ücret",
  "komisyon"
 ],
 "pmPlace": [
  "işlem yap",
  "evet al",
  "hayır al",
  "emri gönder"
 ]
};
