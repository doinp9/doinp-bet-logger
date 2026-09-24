/* Doinp Bet Logger — detection words: 한국어 (ko).
   What the extension looks for on a sportsbook, exchange or prediction-market page in this
   language. Generic betting vocabulary, not yet checked against each site's exact labels.
   To improve detection for a site: add the exact wording the site shows (copy it from
   Settings → Diagnostics or a Test snapshot) and open a pull request.
   Keys: place (the button that places the bet), receipt (bet accepted), error (bet refused),
   stake / ret / totalOdds (labels), status (history result words → result), halfWon / halfLost,
   live, parlay, types (bet-type headers), market, noise (buttons inside a slip), history (links
   that are NOT a place button), months, today, yesterday, and for exchanges and prediction
   markets: back, lay, liability, yes, no, buy, sell, toWin, shares, avgPrice, fee, pmPlace. */
(globalThis.DBL_VOCAB = globalThis.DBL_VOCAB || {})["ko"] = {
 "place": [
  "베팅하기",
  "베팅",
  "배팅하기",
  "베팅 확인",
  "베팅 완료하기"
 ],
 "receipt": [
  "베팅 완료",
  "베팅이 완료",
  "베팅 성공",
  "베팅이 접수",
  "베팅 확인됨",
  "베팅 번호",
  "영수증"
 ],
 "error": [
  "잔액 부족",
  "잔액이 부족",
  "오류",
  "거절",
  "실패",
  "배당이 변경",
  "배당률이 변경",
  "마켓 중지",
  "마켓 마감",
  "최대 베팅",
  "로그인"
 ],
 "stake": [
  "베팅 금액",
  "베팅금",
  "금액",
  "총 베팅"
 ],
 "ret": [
  "예상 당첨금",
  "예상 수익",
  "당첨금",
  "지급액"
 ],
 "totalOdds": [
  "총 배당",
  "총 배당률"
 ],
 "live": [
  "라이브",
  "인플레이"
 ],
 "parlay": [
  "다폴더",
  "멀티",
  "조합",
  "파레이"
 ],
 "types": [
  "싱글",
  "단폴더",
  "다폴더",
  "시스템"
 ],
 "market": [
  "승무패",
  "승패",
  "핸디캡",
  "아시안 핸디캡",
  "오버",
  "언더",
  "코너킥",
  "카드",
  "양팀 득점",
  "더블 찬스",
  "정확한 스코어",
  "전반전",
  "선수",
  "득점"
 ],
 "status": {
  "적중": "won",
  "당첨": "won",
  "승리": "won",
  "미적중": "lost",
  "낙첨": "lost",
  "패배": "lost",
  "취소": "void",
  "적특": "void",
  "환불": "void",
  "진행 중": "pending",
  "대기": "pending",
  "미정산": "pending",
  "캐시아웃": "cashout"
 },
 "halfWon": [
  "절반 적중",
  "하프 윈"
 ],
 "halfLost": [
  "절반 미적중",
  "하프 로스"
 ],
 "noise": [
  "삭제",
  "닫기",
  "모두 지우기",
  "편집"
 ],
 "history": [
  "내 베팅",
  "베팅 내역",
  "내역"
 ],
 "months": {},
 "today": [
  "오늘"
 ],
 "yesterday": [
  "어제"
 ],
 "back": [
  "백"
 ],
 "lay": [
  "레이"
 ],
 "liability": [
  "책임액",
  "리스크"
 ],
 "yes": [
  "예"
 ],
 "no": [
  "아니오"
 ],
 "buy": [
  "매수"
 ],
 "sell": [
  "매도"
 ],
 "toWin": [
  "당첨 시",
  "지급"
 ],
 "shares": [
  "주식",
  "계약"
 ],
 "avgPrice": [
  "평균 가격"
 ],
 "fee": [
  "수수료"
 ],
 "pmPlace": [
  "거래",
  "예 매수",
  "아니오 매수",
  "주문하기"
 ]
};
