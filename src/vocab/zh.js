/* Doinp Bet Logger — detection words: 简体中文 (zh).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["zh"] = {
 "betNoun": [
  "投注",
  "注单",
  "下注"
 ],
 "place": [
  "投注",
  "确认投注",
  "立即投注",
  "下注",
  "确认下注",
  "提交投注"
 ],
 "receipt": [
  "投注成功",
  "下注成功",
  "投注已确认",
  "投注已接受",
  "注单号",
  "投注单号",
  "注单编号"
 ],
 "error": [
  "余额不足",
  "错误",
  "拒绝",
  "失败",
  "赔率已变",
  "赔率变化",
  "盘口已关闭",
  "暂停投注",
  "最高投注",
  "请登录"
 ],
 "stake": [
  "投注额",
  "投注金额",
  "下注金额",
  "金额"
 ],
 "ret": [
  "预计返还",
  "可赢金额",
  "潜在奖金",
  "返还",
  "派彩"
 ],
 "totalOdds": [
  "总赔率"
 ],
 "live": [
  "滚球",
  "直播"
 ],
 "parlay": [
  "串关",
  "过关",
  "混合过关"
 ],
 "types": [
  "单关",
  "单注",
  "串关",
  "过关"
 ],
 "market": [
  "独赢",
  "全场胜负",
  "胜负",
  "让球",
  "亚洲让球",
  "大小",
  "进球",
  "角球",
  "黄牌",
  "双方进球",
  "双重机会",
  "波胆",
  "半场",
  "球员",
  "得分"
 ],
 "status": {
  "赢": "won",
  "已赢": "won",
  "中奖": "won",
  "输": "lost",
  "已输": "lost",
  "未中奖": "lost",
  "取消": "void",
  "作废": "void",
  "走水": "push",
  "未结算": "pending",
  "进行中": "pending",
  "提前结算": "cashout",
  "赢半": "half-won",
  "输半": "half-lost"
 },
 "halfWon": [
  "赢半"
 ],
 "halfLost": [
  "输半"
 ],
 "noise": [
  "删除",
  "关闭",
  "清空",
  "编辑"
 ],
 "history": [
  "我的投注",
  "投注记录",
  "注单记录"
 ],
 "months": {},
 "today": [
  "今天"
 ],
 "yesterday": [
  "昨天"
 ],
 "back": [
  "支持"
 ],
 "lay": [
  "反对"
 ],
 "liability": [
  "负债",
  "风险"
 ],
 "yes": [
  "是"
 ],
 "no": [
  "否"
 ],
 "buy": [
  "买入"
 ],
 "sell": [
  "卖出"
 ],
 "toWin": [
  "可赢",
  "派彩"
 ],
 "shares": [
  "份额",
  "合约"
 ],
 "avgPrice": [
  "平均价格"
 ],
 "fee": [
  "手续费",
  "费用"
 ],
 "pmPlace": [
  "交易",
  "买入是",
  "买入否",
  "提交订单"
 ]
};
