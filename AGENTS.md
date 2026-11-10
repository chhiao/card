# AGENTS.md — 牌搭子 Card Buddies

> 這份文件是寫給 **AI 協作者（Claude Code、Codex、Cursor…）** 和人類開發者看的專案規則。
> 動手修改任何檔案前，請先讀完這份文件；新增內容時，照著「新增遊戲 SOP」一步一步做。

---

## 1. 專案目的

**牌搭子 Card Buddies** 是一個「撲克牌遊戲大廳」網站：

- 打開首頁（大廳）就能看到所有牌桌遊戲，點進去即可開局。
- 第 1 個座位是開局的人自己（也可以改成電腦＝觀戰），其他座位可以設定成 **好友（線上）** 或 **電腦**（電腦分簡單／普通／困難）。
- 有好友座位時會開一個 **線上房間**，產生邀請連結（`games/<id>/index.html?join=<房號>`）；好友用自己的手機或電腦打開就能加入。
- 純靜態網站，部署在 **GitHub Pages**，不需要後端、不需要登入、不需要建置（build）。

這個專案的核心精神是：**共用的事情只做一次，新遊戲只寫規則與畫面**。
開局設定、線上房間、電腦回合、牌局紀錄、結算畫面全部由 `core/table.js`（連線細節在 `core/net.js`）處理。

---

## 2. 技術限制（必須遵守）

| 規則 | 原因 |
| --- | --- |
| 只用原生 HTML / CSS / JavaScript，**不使用框架、不使用 npm 套件、不需要 build** | GitHub Pages 直接部署；任何人 clone 下來就能跑 |
| **不使用 ES modules**（`import` / `export`），一律用 `<script src>` 依序載入並掛在全域 `CB` 上 | 讓 `file://` 直接雙擊開啟也能運作 |
| JavaScript 寫法以 ES5 為主（`var`、`function`），可用 `Array.prototype` 常見方法 | 與既有程式風格一致 |
| 所有亂數必須用傳入的 `rng`（`CB.createRng(seed)`），**禁止 `Math.random()`**（唯一例外：`CB.randomSeed()`） | 同一個牌局編號（seed）必須能重現同一副牌 |
| `rules.js` **不可以碰 DOM**（`document`、`window.xxx`、`localStorage`） | 規則要能在 Node 裡模擬測試（`tools/simulate.js`） |
| `localStorage` 只能透過 `CB.store.get/set` 存取 | 已包好 try/catch，隱私模式不會壞掉 |
| 外部資源只允許 Google Fonts（且要有系統字型備援），以及線上對戰用的 PeerJS（見下方） | 離線或被擋時網站仍可使用 |
| PeerJS 只能由 `core/net.js` **在需要時動態載入**（有好友座位或用邀請連結加入時），不可寫進 `<script>` | 只跟電腦玩時完全不連網；PeerJS 載入失敗也不影響單機遊戲 |
| 所有路徑使用**相對路徑** | GitHub Pages 網址會帶 repo 名稱（`/<repo>/`），絕對路徑會壞 |

---

## 3. 目錄結構與命名

```
card-buddies/
├── index.html                ← 大廳（首頁），卡片由 manifest 自動產生
├── wiki.html                 ← 規則百科（LLM Wiki 的網頁版，見第 11 節）
├── AGENTS.md                 ← 本文件（專案規則）
├── CLAUDE.md                 ← Claude Code 入口，引用本文件
├── README.md                 ← 給人看的專案介紹
├── .nojekyll                 ← 讓 GitHub Pages 不經過 Jekyll 處理
├── assets/
│   └── style.css             ← 全站唯一的樣式表（設計變數都在 :root）
├── core/                     ← 共用核心，新增遊戲時「通常不需要改」
│   ├── base.js               ← 命名空間 CB、registerGame、defineRules、CB.h、CB.store
│   ├── rng.js                ← 可重現亂數 CB.createRng(seed)
│   ├── cards.js              ← 撲克牌資料結構與繪製 CB.Cards（含鬼牌 Cards.joker()）
│   ├── net.js                ← 線上連線 CB.Net（PeerJS / WebRTC，動態載入）
│   ├── table.js              ← 牌桌控制器 CB.Table.mount()
│   ├── lobby.js              ← 大廳卡片渲染
│   ├── markdown.js           ← 極簡 Markdown 轉 HTML CB.markdown（純函式，Node 可執行）
│   └── wiki.js               ← 規則百科頁的畫面
├── games/
│   ├── manifest.js           ← 遊戲清單（大廳與牌桌都讀這裡）
│   └── <game-id>/            ← 一個遊戲一個資料夾
│       ├── index.html        ← 固定外殼，只複製不修改
│       ├── rules.js          ← 純規則 + 電腦 AI（Node 可執行）
│       └── game.js           ← 畫面：render(ctx)
├── wiki/                     ← LLM Wiki（AI 維護的知識庫，見第 11 節）
│   ├── raw/                  ← 原始資料：只新增、不修改
│   ├── pages/<page-id>.md    ← 整理好的百科頁面（遊戲頁的 page-id = 遊戲 id）
│   ├── index.md              ← 目錄：每一頁都要列在這裡
│   ├── log.md                ← 更新紀錄（新的寫最上面）
│   └── wiki-data.js          ← 自動產生，不要手改（node tools/wiki.js）
├── templates/
│   └── game-template/        ← 新遊戲模板（可運作的「比大小」範例）
└── tools/
    ├── check.js              ← 結構檢查（也會跑百科檢查）
    ├── wiki.js               ← 百科檢查 + 產生 wiki/wiki-data.js
    └── simulate.js           ← 讓電腦互打 N 局，確認規則不會卡死
```

**命名規則**

- 遊戲 id：小寫 **kebab-case** 英文，例如 `big-two`、`old-maid`、`sevens`。
  資料夾名稱 = manifest 的 `id` = `CB.defineRules('<id>')` = `CB.Table.mount({ gameId: '<id>' })`，四者必須完全一致。
- 每個遊戲資料夾內只放 `index.html`、`rules.js`、`game.js` 三個檔案；真的需要額外檔案時用 `<id>-xxx.js` 命名並在 `index.html` 的 `game.js` 之前載入，同時更新 `tools/check.js` 的規則。
- CSS class 使用小寫 kebab-case；狀態用 `is-xxx`（`is-turn`、`is-selected`），變體用 `元件-變體`（`btn-primary`、`card-sm`）。

---

## 4. 網頁風格

**主題：溫暖的綠色牌桌 + 米白色紙牌 + 金色點綴。** 感覺像週末和朋友圍在一張木框牌桌旁，親切、不賭場化。

- **顏色**：只能使用 `assets/style.css` 中 `:root` 的變數（`--felt`、`--paper`、`--gold`、`--red`…），不要在 JS 或 HTML 裡寫死顏色。
- **字體**：標題 `--font-display`（Noto Serif TC），內文 `--font`（Noto Sans TC）。
- **紙牌**：一律用 `CB.Cards.el()` 繪製（CSS 牌面，不用圖片），尺寸只有 `sm / md / lg` 三種。
  需要鬼牌時用 `Cards.joker()`（`{ id:'JK', s:'X', r:0, joker:true }`），`Cards.el` / `Cards.label` 都認得它。
- **Emoji**：每個遊戲一個代表 emoji；玩家用 🙋（真人）/ 🤖（電腦）；開局設定的好友座位用 🌐；提示用 💡；規則用 📖。
- **元件重用**：新畫面優先使用既有 class，不要另外發明相似樣式：

| 用途 | class |
| --- | --- |
| 按鈕 | `.btn`、`.btn-primary`（主要動作，一個畫面最多一個）、`.btn-ghost` |
| 對手區 | `.opponents` > `.opp`（`.is-turn` 輪到他、`.is-danger` 快出完、`.is-done` 已下莊／出局） |
| 桌面中央出牌區 | `.pile`、`.pile-label`、`.pile-empty` |
| 自己的手牌 | `.my-hand` + `Cards.row(..., 'card-row-fan')` |
| 每人一格的座位 | `.seat-grid` > `.seat`（`.seat-head` / `.seat-foot`） |
| 操作列（放在最下面） | `.action-bar`，提示文字 `.turn-tip`，彈出提示 `.hint-pop` |
| 小標籤 | `.badge`、`.badge-warn` |
| 置中的訊息視窗 | `.modal.modal-center` + `.modal-icon` |
| 邀請連結框（開局設定） | `.invite-box` > `.invite-title`、`.invite-row` |
| 規則百科 | `.wiki-layout` > `.wiki-nav`（`.wiki-nav-item`、`.wiki-search`）＋ `.wiki-article`（`.wiki-head`、`.wiki-body`、`.wiki-sources`）；大廳入口 `.wiki-promo` |

- **文案**：使用**繁體中文（台灣用語）**，口吻輕鬆友善。例：「要牌」「停牌」「Pass」「蓋牌」「出牌」「輪到你」。
  牌的寫法統一為 `♠7`、`♥A`（用 `Cards.label()` 產生），花色順序與名稱：♣ 梅花、♦ 方塊、♥ 紅心、♠ 黑桃。
- **可及性**：可點的牌要能用鍵盤 Enter／空白鍵操作（`Cards.el` 已處理）；按鈕要有文字，不能只有圖示。
- **手機**：版面在 860px 以下會變成單欄，新增樣式必須在手機寬度（375px）下可用。

---

## 5. 頁面結構

### 5.1 大廳 `index.html`
固定區塊：Hero（扇形牌 + 標題）→「選一張牌桌」遊戲卡片 →「怎麼玩」三步驟 →「規則百科」入口 → Footer。
遊戲卡片由 `core/lobby.js` 依 `games/manifest.js` **自動產生**，新增遊戲時**不要手動改 `index.html`**。

### 5.2 牌桌頁 `games/<id>/index.html`
外殼完全相同（從 `templates/game-template/index.html` 複製），`<script>` 載入順序固定：

```
../../core/base.js → ../../core/rng.js → ../../core/cards.js → ../../core/net.js → ../../core/table.js
→ ../manifest.js → rules.js → game.js
```

`CB.Table.mount()` 會自動產生：頂部列（← 大廳／遊戲名稱／📖 規則／🔄 重新開局）、牌桌 `#stage`、
右側欄（玩家列表、牌局紀錄、牌局編號）、開局設定視窗（含邀請連結）、好友加入／等待視窗、結算視窗。

### 5.3 規則百科 `wiki.html`

`<script>` 載入順序：`core/base.js → core/rng.js → core/cards.js → core/markdown.js → games/manifest.js → wiki/wiki-data.js → core/wiki.js`。
網址用 hash 切換頁面：`wiki.html`（首頁）、`wiki.html#big-two`、`wiki.html#log`。左邊是搜尋＋分類目錄，右邊是米白紙張樣式的文章。
遊戲頁會自動顯示 manifest 的人數／時間／標籤與「開一桌」按鈕；牌桌頁的 📖 規則視窗會連到對應的百科頁。
新增百科內容**只改 `wiki/` 底下的 .md**，不需要改 `wiki.html` 或 `core/wiki.js`。

### 5.4 線上對戰架構

- **房主**（開局設定的那台）跑完整的 `rules.js`；每次狀態改變都把 `state` 整份同步給好友。
- **好友**（網址帶 `?join=<房號>`）只送出 `{ t:'move', move }`，房主檢查「是不是輪到他、動作合不合法」才套用。
- 好友端的 `ctx.legal()`、`ctx.hint()` 直接在同步過來的 `state` 上跑 `rules.js`，所以 **`state` 必須能被 JSON 序列化**（不要放 `Map`、`Set`、class 實例；函式會被丟掉，只能在房主端的 `play()` 使用，例如 `state.rng`）。
- `play()` 找牌一律用 **牌的 id**（`Cards.take(hand, ids)`），不可以用物件比對（好友送來的牌是 JSON 還原的新物件）。
- 好友斷線時，該座位自動改成電腦（普通）代打，牌局不會卡住。
- 因為同步的是整份 `state`，懂開發者工具的人看得到別人的牌；本站定位是朋友間娛樂，不做防作弊。
`game.js` 的 `render(ctx)` **只負責把內容畫進 `ctx.root`（#stage）**。

---

## 6. 核心介面

### 6.1 manifest 欄位（`games/manifest.js`）

```js
CB.registerGame({
  id: 'old-maid',               // 必填，kebab-case，與資料夾同名
  name: '抽鬼牌',                // 必填，中文名稱
  emoji: '👻',                  // 必填，一個 emoji
  tagline: '最後拿著鬼牌的人就輸了！', // 必填，28 字以內
  players: { min: 2, max: 6, default: 4 }, // 必填
  minutes: '5–10',              // 選填，一局大約幾分鐘
  difficulty: 1,                // 選填，1–3（顯示成 ★）
  tags: ['入門', '運氣'],        // 必填，1–3 個
  hiddenInfo: true,             // 選填，預設 true；所有牌都公開的遊戲設 false（每個人都看得到所有手牌）
  options: { rounds: 3 },       // 選填，會傳給 rules.create() 的第三個參數
  aiDelay: 800,                 // 選填，電腦出牌前等待毫秒數
  rules: ['規則 1', '規則 2', '規則 3'] // 必填，至少 3 條，每條一句話
});
```

### 6.2 規則模組介面（`rules.js`）

```js
CB.defineRules('<id>', {
  create(players, rng, options) → state   // players: [{name, type:'human'|'ai', level}]
  currentPlayer(state) → index | null     // 結束時回傳 null
  legalMoves(state) → move[]              // 目前玩家所有合法動作，不能是空陣列（除非已結束）
  play(state, move) → state               // 直接修改 state，並把事件 push 進 state.log
  isOver(state) → boolean
  result(state) → { title, ranking:[{index, score}], note? }  // ranking 第一名在最前面，長度 = 玩家數
  ai(state, index, level, rng) → move     // 必須回傳 legalMoves() 裡的其中一個
  summary?(state, index) → string         // 選填：側欄玩家名稱旁的小字，例如「剩 5 張」
});
```

規範：

- `state` 必須有 `players` 與 `log`（字串陣列）。`log` 文字格式：`玩家名 + 動作`，例如 `阿牌 出 對子：♥9 ♠9`。
- **動作（move）是純物件**：`{ type: 'pass' }`、`{ type: 'play', cards: [card, …] }`。
  有牌的動作一律放在 `cards`，控制器用 `type + 牌 id` 判斷是否合法（`CB.Table.moveKey`）。
- 電腦 AI 三種難度要有**可感受的差異**：
  - `easy`：大致隨機、偶爾失誤，讓新手贏得了。
  - `normal`：合理的基本策略。
  - `hard`：在 normal 之上加入「看對手剩幾張」「不拆好牌」等判斷。
  - 驗收標準：與 3 位 normal 對戰時，勝率應呈現 easy < normal ≤ hard。
- AI 只能看到「該玩家合理能知道的資訊」（自己的手牌、桌面、別人剩幾張），**不可偷看別人的手牌**。

### 6.3 畫面介面（`game.js`）

```js
CB.Table.mount({
  gameId: '<id>',
  render: function (ctx) { /* 把畫面 append 到 ctx.root */ }
});
```

`ctx` 提供：

| 屬性 | 說明 |
| --- | --- |
| `ctx.state` / `ctx.players` | 目前狀態與玩家設定 |
| `ctx.root` | 要畫進去的容器（每次 render 前會清空） |
| `ctx.cp` | 目前輪到誰（index 或 null） |
| `ctx.viewer` | 螢幕前的是誰（房主是 0，好友是自己的座位）；`-1` 代表觀戰（第 1 位設成電腦） |
| `ctx.canAct` | 現在是否可以按按鈕 |
| `ctx.seesHand(i)` | 第 i 位的手牌能不能翻開顯示（**畫別人手牌前一定要檢查**） |
| `ctx.legal()` | 目前合法動作 |
| `ctx.play(move)` | 送出動作（只有 `canAct` 時有效） |
| `ctx.hint()` | 取得 normal 難度 AI 的建議動作（給「💡 提示」按鈕） |
| `ctx.rerender()` | 只重畫，不推進遊戲（例如選牌時） |
| `ctx.waitText()` | 不是自己回合時操作列要顯示的文字（`🤖 阿牌 思考中…`／`🙋 小明 思考中…`） |
| `ctx.over` / `ctx.spectator` | 是否已結束 / 是否觀戰 |
| `ctx.h` / `ctx.Cards` | DOM 產生器與撲克牌工具 |

畫面規範：

1. 由上到下的順序：**對手 → 桌面中央 → 自己的手牌 → 操作列 `.action-bar`**。
2. 不是自己的回合時，操作列顯示 `ctx.waitText()`；`ctx.canAct` 為 true 時才出現按鈕。
3. 每個遊戲都要有 **💡 提示** 按鈕（用 `ctx.hint()`）。
4. 不要在 `game.js` 裡寫遊戲邏輯；判斷「能不能出」一律用 `ctx.legal()` 或 `rules.js` 匯出的工具函式。
5. 跨 render 的暫存 UI 狀態（例如選起來的牌）放在 `game.js` 的 IIFE 區域變數，並在換回合時清空（參考 `games/big-two/game.js`）。

---

## 7. 新增遊戲 SOP（最常見的任務）

1. **決定 id**（kebab-case），確認 `games/` 底下沒有重複。
2. **複製模板**：`cp -r templates/game-template games/<id>`
3. **登記 manifest**：在 `games/manifest.js` 最下方新增一筆 `CB.registerGame({...})`（欄位見 6.1）。
4. **寫規則**：改寫 `games/<id>/rules.js`，把 `'my-game'` 換成 `<id>`，實作 6.2 的所有函式與三種 AI。
5. **寫畫面**：改寫 `games/<id>/game.js`，把 `gameId` 換成 `<id>`，依 6.3 畫面規範實作。
6. **不要改** `games/<id>/index.html`（外殼固定）。
7. **驗證**（三個都要通過）：
   ```bash
   node tools/check.js                 # 結構檢查
   node tools/simulate.js <id> 300     # 電腦互打 300 局，不可卡死、不可出不合法的牌
   python3 -m http.server 8000         # 打開 http://localhost:8000 實際玩一局：
                                       #   ① 1 真人 + 電腦  ② 1 個座位設成好友，用另一個分頁打開邀請連結加入（確認看不到別人的牌）  ③ 第 1 位設成電腦觀戰
   ```
8. 大廳會自動出現新卡片，**不需要修改 `index.html` 或 `core/lobby.js`**。
9. 更新 `README.md` 的遊戲列表。
10. **寫百科頁**：新增 `wiki/pages/<id>.md`（`game: <id>`，內文用 `{{rules}}` 帶出本站規則，再寫新手攻略），把規則選擇存進 `wiki/raw/`，更新 `wiki/index.md` 與 `wiki/log.md`，最後跑 `node tools/wiki.js`（流程見第 11 節）。少了這頁 `check.js` 會報錯。

### 其他常見任務

- **調整 AI**：只改該遊戲 `rules.js` 的 `ai()`，改完跑 `simulate.js` 確認難度排序沒有亂掉。
- **修改共用樣式**：改 `assets/style.css`，並檢查**所有遊戲頁面**與大廳都沒有跑版。
- **修改 `core/`**：屬於高風險修改。必須確認不破壞第 6 節的介面；改完要對所有遊戲跑 `simulate.js` 並各實際開一局。
- **更新百科**：照第 11 節的 Ingest／Query／Lint 流程。
- **新增新的頁面類型**（例如「戰績頁」）：放在根目錄（`<name>.html`），沿用 `assets/style.css` 與 `CB.h`，並在大廳 Footer 或 Hero 加入連結；在本文件第 3、5 節補上說明。

---

## 8. AI 修改專案時必須遵守的規則

1. **先讀再改**：修改前先讀相關檔案與本文件；不確定介面時參考既有的 `games/big-two/`（最完整的範例）。
2. **一次只做一件事**：新增遊戲時不要順手改其他遊戲或 `core/`；真的需要改共用部分，在回覆中明確說明原因。
3. **不要破壞既有遊戲**：任何修改後都要對所有遊戲跑 `node tools/simulate.js`。
4. **遵守第 2 節技術限制**，尤其是：不用框架、不用 ES modules、不用 `Math.random()`、`rules.js` 不碰 DOM。
5. **不要加入真錢、下注儲值、廣告、追蹤碼**。籌碼只是遊戲內的計分。
6. **不要使用有版權的圖片或角色**；牌面一律 CSS 繪製。
7. **遊戲規則以台灣常見玩法為準**，有地區差異時寫進 manifest 的 `rules`，讓玩家知道本站採用哪一種。
8. **文件同步**：新增檔案類型、新增共用 class、改變介面時，必須同時更新本文件。
9. **commit 訊息**使用繁體中文、動詞開頭，例如：`新增遊戲：抽鬼牌`、`修正：大老二順子判斷`、`調整：排七困難 AI`。

---

## 9. 部署

- 推到 GitHub 的 `main` 分支 → Settings → Pages → Source 選 `Deploy from a branch`、`main` / `(root)`。
- 網址：`https://<帳號>.github.io/<repo>/`
- 根目錄的 `.nojekyll` 不可刪除。

## 10. 待辦想法（歡迎依本文件規則實作）

- 🃏 心臟病、撿紅點、十三支
- 📊 本機戰績頁（用 `CB.store` 記錄勝場）
- 🌐 線上對戰：斷線重連、觀戰席、好友端只同步自己看得到的資訊（防作弊）

---

## 11. LLM Wiki（規則百科）

本專案用 **LLM Wiki** 的方式維護知識庫：人類只負責提供原始資料和提問，**由 AI 負責整理、交叉連結、維持一致**，網頁 `wiki.html` 把結果呈現出來。

### 11.1 三層結構

| 層 | 位置 | 誰寫 | 規則 |
| --- | --- | --- | --- |
| 原始資料 | `wiki/raw/*.md` | 人類提供，AI 可以代為記錄 | **只新增、不修改**。檔名 `YYYY-MM-DD-<主題>.md`，第一行 `# 原始資料：標題`，開頭寫來源 |
| 百科頁面 | `wiki/pages/<page-id>.md` | AI | 由原始資料整理而成，可以隨時改寫 |
| 規則（schema） | 本節 | 人類＋AI | 規定格式與流程 |

### 11.2 頁面格式

```markdown
---
title: 99                         # 必填
emoji: 💯                         # 必填，一個 emoji
category: 遊戲攻略                 # 必填：遊戲攻略／基礎知識／網站說明
game: ninety-nine                 # 遊戲頁才寫，必須是 manifest 裡的 id
sources: [2026-11-10-rule-decisions.md]   # 這頁根據哪些 raw/ 檔案
updated: 2026-11-10               # 必填，最後更新日期
---
內文（Markdown）
```

可用語法：`##`／`###` 標題、段落、`-`／`1.` 清單、表格、`>` 引言、`**粗體**`、`` `程式碼` ``、`[文字](網址)`，以及本站專用：

- `[[page-id]]` 或 `[[page-id|顯示文字]]`：百科內部連結。
- `{{♠A ♥10 🃏}}`：畫出撲克牌（用 `Cards.el`）。
- `{{rules}}`：帶出 manifest 的 `rules`（本站規則只寫在 manifest 一個地方，百科不要重抄）。
- 不可以寫原生 HTML（會被跳脫成文字）。

### 11.3 三種操作

1. **Ingest（匯入）**：有新資料時（使用者確認的規則、模擬勝率、玩家回饋…）
   ① 存成 `wiki/raw/` 新檔 → ② 更新或新增相關頁面、補上 `[[連結]]` 與 `sources` → ③ 更新 `wiki/index.md` → ④ 在 `wiki/log.md` 最上面加 `## [YYYY-MM-DD] ingest | 標題`。
2. **Query（查詢）**：回答使用者關於規則或網站的問題時，**先讀 `wiki/index.md` 和相關頁面**再回答；答案有保存價值就整理成新頁面，並記一筆 `query`。
3. **Lint（健康檢查）**：跑 `node tools/wiki.js`（會檢查 frontmatter、斷掉的連結、孤兒頁面、牌的寫法、每個遊戲都有攻略頁），
   再由 AI 檢查頁面之間有沒有互相矛盾、和 manifest 的規則或實際程式是否一致，記一筆 `lint`。

### 11.4 注意事項

- 改完任何 `wiki/` 檔案都要執行 `node tools/wiki.js` 重新產生 `wiki/wiki-data.js`（網站要能用 `file://` 開，瀏覽器不能直接讀 .md）；`check.js` 會檢查它是不是最新的。
- 百科寫的是**本站實際行為**：寫按鈕名稱、規則、勝率前先對照程式碼或 raw 資料，不要憑印象。
- 文案沿用第 4 節（繁體中文、台灣用語、牌寫成 `♠7`）。
