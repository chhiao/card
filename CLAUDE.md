# CLAUDE.md

本專案的完整規則寫在 AGENTS.md（給所有 AI 工具共用），Claude Code 會透過下面這行自動載入：

@AGENTS.md

## 給 Claude 的補充

- 回覆與程式註解使用**繁體中文（台灣）**。
- 最常見的任務是「新增一個撲克牌遊戲」，請嚴格照 AGENTS.md 第 7 節 SOP 進行，完成後回報三項驗證結果
  （`node tools/check.js`、`node tools/simulate.js <id> 300`、瀏覽器實測）。
- 開始寫新遊戲前，先讀 `games/big-two/rules.js` 與 `games/big-two/game.js` 當作風格範本。
- 不確定遊戲規則細節（地區玩法差異）時，先列出選項問使用者，不要自行假設。
- 使用者問規則或網站怎麼用時，先讀 `wiki/index.md` 與相關的 `wiki/pages/*.md` 再回答；有新資料或新答案時照 AGENTS.md 第 11 節更新百科並跑 `node tools/wiki.js`。
