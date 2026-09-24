/* Doinp Bet Logger — detection words: 日本語 (ja).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["ja"] = {
 "place": [
  "ベットする",
  "ベットを確定",
  "ベット確定",
  "賭ける",
  "ベットを行う"
 ],
 "receipt": [
  "ベット完了",
  "ベットが完了",
  "ベットを受け付け",
  "受付完了",
  "ベットが確定",
  "ベットid",
  "ベット番号",
  "チケット番号"
 ],
 "error": [
  "残高不足",
  "残高が不足",
  "エラー",
  "拒否",
  "失敗",
  "オッズが変更",
  "マーケット停止",
  "受付終了",
  "最大ベット",
  "ログイン"
 ],
 "stake": [
  "ベット額",
  "賭け金",
  "掛け金",
  "金額"
 ],
 "ret": [
  "予想払戻",
  "払戻予定",
  "払戻",
  "配当",
  "獲得予定"
 ],
 "totalOdds": [
  "合計オッズ"
 ],
 "live": [
  "ライブ"
 ],
 "parlay": [
  "マルチ",
  "パーレー",
  "アキュムレーター"
 ],
 "types": [
  "シングル",
  "マルチ",
  "システム"
 ],
 "market": [
  "勝敗",
  "試合結果",
  "勝者",
  "ハンデ",
  "ハンディキャップ",
  "アジアンハンデ",
  "オーバー",
  "アンダー",
  "ゴール",
  "コーナー",
  "カード",
  "両チーム得点",
  "ダブルチャンス",
  "正確なスコア",
  "前半",
  "選手",
  "得点"
 ],
 "status": {
  "勝ち": "won",
  "的中": "won",
  "負け": "lost",
  "不的中": "lost",
  "無効": "void",
  "返金": "void",
  "キャンセル": "void",
  "未確定": "pending",
  "進行中": "pending",
  "キャッシュアウト": "cashout"
 },
 "halfWon": [
  "半分勝ち",
  "ハーフ勝ち"
 ],
 "halfLost": [
  "半分負け",
  "ハーフ負け"
 ],
 "noise": [
  "削除",
  "閉じる",
  "すべて削除",
  "編集"
 ],
 "history": [
  "マイベット",
  "ベット履歴",
  "履歴"
 ],
 "months": {},
 "today": [
  "今日",
  "本日"
 ],
 "yesterday": [
  "昨日"
 ],
 "back": [
  "バック"
 ],
 "lay": [
  "レイ"
 ],
 "liability": [
  "責任額",
  "リスク"
 ],
 "yes": [
  "はい"
 ],
 "no": [
  "いいえ"
 ],
 "buy": [
  "購入",
  "買い"
 ],
 "sell": [
  "売却",
  "売り"
 ],
 "toWin": [
  "獲得額",
  "払戻"
 ],
 "shares": [
  "シェア",
  "契約"
 ],
 "avgPrice": [
  "平均価格"
 ],
 "fee": [
  "手数料"
 ],
 "pmPlace": [
  "取引",
  "はいを購入",
  "いいえを購入",
  "注文する"
 ]
};
