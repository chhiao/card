# 🃏 牌搭子 Card Buddies

找朋友圍一桌，或叫電腦來湊人數——打開就能玩的撲克牌遊戲大廳。

**線上遊玩：** `https://<你的帳號>.github.io/<repo 名稱>/`

## 目前的牌桌

| 遊戲 | 人數 | 特色 |
| --- | --- | --- |
| 🂡 21 點 Blackjack | 1–5 | 和電腦莊家對決，5 局比籌碼 |
| 👑 大老二 Big Two | 2–4 | 台灣聚會經典，支援單張、對子、順子、葫蘆、鐵支、同花順 |
| 7️⃣ 排七 Sevens | 3–6 | 從 7 往兩邊接龍，沒牌就得蓋牌扣分 |

每個座位都能選「真人」或「電腦」（簡單／普通／困難）。多位真人時在同一台裝置輪流，換人前會自動遮住手牌。

## 這個專案的重點：AGENTS.md

這不只是一個網頁，而是一套**可以持續擴充的規則**。[`AGENTS.md`](AGENTS.md) 定義了：

- 專案目的、技術限制、網頁風格與共用元件
- 目錄結構與命名規則
- 遊戲的「規則模組介面」與「畫面介面」
- 新增遊戲的 SOP 與驗證方式
- AI 修改專案時必須遵守的規則

只要對 AI 說「依照 AGENTS.md 新增一個抽鬼牌遊戲」，它就能用同一套架構做出新的牌桌，大廳也會自動出現新卡片。

## 本機執行

```bash
python3 -m http.server 8000
# 打開 http://localhost:8000
```

（也可以直接雙擊 `index.html` 開啟。）

## 檢查工具

```bash
node tools/check.js            # 檢查檔案結構是否符合 AGENTS.md
node tools/simulate.js         # 讓電腦互打，每個遊戲 200 局，確認規則不會卡死
```

## 部署到 GitHub Pages

1. 把整個資料夾推到 GitHub repo 的 `main` 分支。
2. Settings → Pages → Source：`Deploy from a branch`，Branch：`main`、資料夾 `/ (root)`。
3. 等一兩分鐘，網址就會出現在 Pages 設定頁上方。
