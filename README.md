# 专注风暴 — 注意力训练小游戏

一款基于 Canvas 绘制的微信小游戏，8 种注意力训练模式，支持深色/浅色主题、成就系统、排行榜、每日挑战和训练计划。

## 快速开始

使用 **微信开发者工具** 打开项目根目录即可运行。

```
AppID: wx16490bb8f5ee8ba1
云环境: cloud1-d3g8g2icn594133d1
```

启动本地服务（内容安全后端）：
```bash
cd server && node server.js
```

---

## 项目结构

```
adhd-game/
├── game.js                   # 入口：渲染循环、触摸分发、全局初始化
├── js/
│   ├── app.js                # 全局状态：用户数据、登录、段位、云同步
│   ├── config/
│   │   ├── theme.js          # 深色/浅色主题颜色常量
│   │   └── modes.js          # 8 种游戏模式的共享定义
│   ├── base/
│   │   ├── scene.js          # 场景基类：滚动、动画、弹窗、结算
│   │   ├── scene-manager.js  # 场景栈导航管理器
│   │   ├── draw-utils.js     # Canvas 绘制原语
│   │   ├── animation.js      # Tween 动画引擎
│   │   └── ui/
│   │       ├── tab-bar.js    # 底部 Tab 导航栏
│   │       ├── toast.js      # 轻提示
│   │       └── grid.js       # 网格坐标计算
│   ├── scenes/               # 13 个场景文件（8 种游戏模式 + 5 个界面）
│   │   ├── home-scene.js     # 首页：模式入口、每日挑战、训练计划
│   │   ├── rank-scene.js     # 排行榜
│   │   ├── profile-scene.js  # 个人中心：成就、数据统计、皮肤
│   │   ├── about-scene.js    # 关于/隐私政策
│   │   ├── training-scene.js # 训练计划详情
│   │   ├── schulte-scene.js  # 舒尔特方格
│   │   ├── memory-scene.js   # 记忆翻牌
│   │   ├── scan-scene.js     # 闪电扫视
│   │   ├── stroop-scene.js   # 斯特鲁普效应
│   │   ├── react-scene.js    # 反应速度
│   │   ├── match-scene.js    # 配对消除
│   │   ├── sort-scene.js     # 排序挑战
│   │   └── dual-scene.js     # 双线操作
│   └── utils/
│       ├── audio.js          # Web Audio API 音效生成器
│       ├── scoring.js        # 评分计算（分模式/分难度）
│       ├── daily.js          # 每日挑战生成与连续打卡
│       ├── achievements.js   # 成就系统
│       ├── training.js       # 训练计划
│       ├── skins.js          # 皮肤系统
│       ├── util.js           # 通用工具函数
│       ├── ads.js            # 广告管理
│       ├── avatar-loader.js  # 头像加载与缓存
│       └── sensitive-filter.js # 内容安全检测
├── server/
│   ├── server.js             # Node.js HTTP 服务（内容安全/排行榜/登录）
│   └── clean-data.js         # 敏感数据定时清除脚本
└── cloudfunctions/           # 微信云函数
    ├── login/                # 获取 openid
    ├── contentCheck/         # 文本/图片安全检测
    └── leaderboard/          # 排行榜同步
```

---

## 架构

### 入口与游戏循环

`game.js` 是单入口文件，负责：

1. 创建 Canvas 并适配 DPR（支持 120Hz 高刷屏）
2. 初始化全局对象（app, sceneManager, toast, audio, ads）
3. 注册触摸事件 → 分发给 SceneManager
4. 启动 `requestAnimationFrame` 主循环

```
game.js → SceneManager → Scene 基类 → 各游戏场景
```

### 场景系统

基于**场景栈**架构，替代微信原生 `wx.navigateTo/navigateBack`。

| 方法 | 作用 |
|------|------|
| `push(sceneId)` | 推入场景（进入子页面） |
| `pop()` | 弹出场景（返回上一页） |
| `switchTab(sceneId)` | 切换 Tab（首页/排行/个人中心） |

Tab 场景（home/rank/profile）常驻栈底。每个场景继承 `Scene` 基类，生命周期：

```
onEnter → onShow → onUpdate/dt / onRender/ctx → onHide → onExit
```

### 游戏模式

| 模式 | 场景文件 | 训练维度 | 简介 |
|------|----------|----------|------|
| 数字风暴 | schulte-scene | 注意力 | 快速按序点击数字 |
| 记忆还原 | memory-scene | 工作记忆 | 记住数字序列并还原 |
| 闪电扫视 | scan-scene | 视觉搜索 | 按序找全所有数字 |
| 斯特鲁普 | stroop-scene | 抑制控制 | 排除文字干扰判断颜色 |
| 极速反应 | react-scene | 反应速度 | 快速点击随机出现的目标 |
| 色彩消除 | match-scene | 模式识别 | 点击同色色块配对消除 |
| 序列排序 | sort-scene | 序列加工 | 将打乱的数字升序排列 |
| 双线任务 | dual-scene | 注意力分配 | 同时处理上下两区的任务 |

每种模式有 3-5 个难度等级（easy/normal/hard/expert/master），评分标准在 `scoring.js` 中定义。

### UI 渲染

全部界面使用 Canvas API 绘制，不依赖 WXML/WXSS。

- `draw-utils.js` — 圆角矩形、渐变、阴影、文字绘制等原语
- 每个 Scene 的 `onRender(ctx)` 方法中完成绘制
- 主题颜色通过 `THEME.xxx` 引用，支持深色/浅色即时切换

### 数据流

```
app.js (全局状态)
  ├── 用户数据 (userData) → wx.setStorageSync 持久化
  ├── 段位系统 (rankPoints + RANKS)
  ├── 云同步 → 云函数优先 / server HTTP 兜底
  ├── 每日挑战 → daily.js
  ├── 训练计划 → training.js
  └── 成就系统 → achievements.js
```

---

## 功能详解

### 段位系统

7 个段位，根据累计积分 `rankPoints` 晋升：

| 段位 | 所需积分 |
|------|----------|
| 青铜 | 0 |
| 白银 | 100 |
| 黄金 | 300 |
| 铂金 | 600 |
| 钻石 | 1000 |
| 大师 | 1500 |
| 王者 | 2000 |

每局游戏根据难度和评级获取积分：`calcRankPoints(gameMode, level, rating)`。

### 评分体系

5 级评分：S/A/B/C/D，不同模式有不同的计算逻辑：

- **计时模式**（schulte/sort/scan）：用时越短评级越高
- **准确率模式**（stroop/react/match）：正确率越高评级越高
- **混合模式**（memory）：准确率 + 完美通关 + 用时
- **双线模式**（dual）：上下两区综合准确率

### 每日挑战

每天生成一个随机挑战目标，需要完成特定难度和模式。连续打卡天数影响积分加成：

- 7 天：2 倍
- 14 天：3 倍
- 30 天：5 倍

补签卡可在断签后恢复连续打卡。

### 训练计划

5 天一个循环，每天 3 个训练项目组合（专注力/记忆力/反应力/规划力/多任务），覆盖不同认知维度。完成每日训练可挑战并解锁成就。

### 成就系统

20 个成就，分 4 类：

| 类别 | 举例 |
|------|------|
| 坚持 | 完成 100 局、连续 30 天打卡 |
| 速度 | 5 秒内完成 4×4、10 连击 |
| 技巧 | 完美记忆 10 位、全模式通关 |
| 段位 | 达到白银/黄金/.../王者 |

### 皮肤系统

5 套主题皮肤（与代码 `skins.js` 中的 ID 一致）：

| 皮肤 ID | 风格 |
|---------|------|
| night | 夜空（默认） |
| piano | 钢琴键 |
| neon | 霓虹灯 |
| forest | 森林 |
| ocean | 海洋 |

每套皮肤在主页（背景渐变）和游戏中（格子颜色）分别适配。

### 内容安全

三重防线：

1. **本地敏感词** — `sensitive-words.js` 200+ 词库快速过滤
2. **云函数** — `contentCheck` 调用微信 `msgSecCheck/imgSecCheck`
3. **服务端 HTTP** — `server.js` 兜底

---

## 全局对象

挂载在 `GameGlobal` 上的运行时对象：

```
GameGlobal
  ├── canvas      → Canvas 实例
  ├── ctx         → Canvas 2D 上下文
  ├── app         → app.js 导出的全局状态对象
  ├── sceneManager → SceneManager 实例
  ├── toast       → Toast 实例
  ├── audio       → AudioManager 实例
  ├── _cloudReady → 云开发是否就绪
  └── DPR         → 设备像素比
```

---

## 开发命令

```bash
# 启动后端服务
cd server && node server.js

# 内容安全测试
node test-content-security.js
```

## 构建与发布

微信开发者工具 → 上传 → 微信公众平台提交审核。

游戏版本号管理：`project.config.json` 中的 `version` 字段。

---

## 更新日志

### v1.2.3

- **修复（头像上传瘫痪）**：此前 `checkImage()` 采用严格 fail-closed，当项目未部署安全后端（无 `serverUrl`、未开云函数）时，所有头像上传都会被拦截，表现为「选完图无反应 / 一直失败」。现已改为双后端均不可达时 fail-open（仅本地保存），安全语义保持——任一后端可达且明确拒绝仍会拦截。
- **新增（本地兜底）**：无云端、无服务端时，头像改为本地保存 `base64 data URL`，profile 立即可见；`avatar-loader.js` 新增 `data:` URL 加载分支，使个人中心与排行页均可正确渲染本地头像。游客 / 纯本地模式也能正常换头像。
- **修复（昵称同步瘫痪）**：`checkContent()` 此前同样严格 fail-closed，无后端时改昵称也会被拦截。一并改为双后端不可达时 fail-open，与头像检测保持一致；个人中心在纯本地模式下头像与昵称均可正常修改。
- **文案**：本地保存提示「头像已更新（本地保存）」，与云端 / 服务端上传区分；检测不可达时提示「…已跳过」。

### v1.2.2

- **UI 去AI味重构（视觉打磨）**：社交区从"三按钮卡片"改为"细分割线+文字链接"的轻量行内操作栏——去掉 emoji 主视觉（📤👥🔔）、去掉圆角卡片容器、去掉营销腔标题「邀请好友·一起专注」；改为「分享给好友 / 群内排行 / 每日提醒」三等分纯文字链接。
- **挑战横幅优化**：去掉 ⚔️ emoji 前缀，高度从 112rpx 收紧至 96rpx，背景从渐变改为极淡单色，「接受挑战」按钮移至右侧紧凑布局，关闭按钮改为极简 × 符号。
- **群排行弹层优化**：去掉 👥 emoji 前缀和「（预览）」后缀，标题简化为「群内排行」，技术性说明文案精简为一句人话；列表加行间分割线，按钮文案「知道了」→「关闭」。
- **结算屏去emoji**：「⚔️ 挑战好友」→「挑战好友」；胜负横幅标题去掉 🎉😤🤝 emoji 前缀。

### v1.2.1

- **新增（挑战比分胜负判定）**：应战好友后结算屏顶部展示胜负横幅——「🎉 挑战成功 / 😤 惜败一筹 / 🤝 势均力敌」，并显示「你的 X · 好友 Y」对比。
- **修复**：此前首页「接受挑战」只传了难度、未携带好友成绩上下文，导致结算屏无法比出胜负。现已将挑战上下文（`{ mode, score, rating, level }`）完整带入对应玩法场景，由基类 `_finishGameWithRating` 统一判定。
- **公平性**：计分方向按模式区分——舒尔特（schulte）/ 排序（sort）为计时类「越短越好」，其余 6 种玩法为「越高越好」；同难度比分数，不同难度退化为比评级（S>A>B>C>D），避免跨难度误判。
- **优化**：应战后的「挑战好友」分享文案随结果变化（赢/输/平各有不同话术）。

### v1.2.0

- **新增（社交裂变 / 增长）**：`js/utils/share.js` 社交分享模块，统一封装 `wx.shareAppMessage` / `wx.showShareMenu` / `wx.onShareTimeline` / `wx.requestSubscribeMessage`，并沿用广告模块的"占位优雅降级"风格（无 wx 环境 / 占位模板 ID / 异常均安全返回，不抛错）。
- **新增**：结算页「⚔️ 挑战好友」按钮——将本局成绩（mode + score + rating + level）打包为深链分享，好友打开即自动跳转到对应模式应战。好友打开时在首页顶部展示「收到好友挑战」横幅，点击「接受挑战」直达该模式。
- **新增**：首页社交卡片——「📤 分享游戏」（胶囊菜单 + 朋友圈转发同步开启）、「👥 群排行」（占位预览弹层，展示个人各模式最佳成绩；真实好友群排行需后端解密 `openGId`，已留 TODO）、「🔔 订阅提醒」（调起订阅消息授权，模板 ID 为占位时给出友好提示）。
- **接入**：`game.js` 启动即注册全局分享并与好友挑战深链（解析 `wx.getLaunchOptionsSync` / `wx.onShow` 的 query，存入 `app.incomingChallenge`）；`app.js` 新增 `incomingChallenge` 状态与存取方法。

### v1.1.1

- **修复（P0）**：每日挑战 / 训练计划对扫视（scan）、排序（sort）引用了非完全平方数难度档导致网格崩坏的问题，统一收敛到各模式真实支持的完全平方数网格，并在场景入口增加防御性收敛。
- **修复（P0）**：成就系统长期不可达的缺陷——`反应连击`、`斯特鲁普零错误`、`记忆完美还原`、`色彩消除连击/清盘`、`双线/反应专家 S 评级`、`挑战达人（完成7次每日挑战）` 等约 9 个成就的判定依赖从未写入的字段；现已在结算流程统一写入 `_maxCombo / _perfect / _perfect6 / _perfect10 / _cleared / _expertRating` 等派生数据，并补上每日挑战累计完成次数。
- **新增**：连续打卡天数（`streak`）此前从未累加，现已在每日首次完成一局时正确统计；并落地 README 承诺的打卡积分加成（连续 7/14/30 天分别 ×2 / ×3 / ×5 段位积分）。
- **优化（P1）**：广告单元 ID 仍为占位符时，激励视频改为"模拟成功"以保证看视频奖励链路可用；游客模式——首页登录遮罩新增"游客体验"，未登录也可直接试玩，排行/个人等社交功能引导登录。
- **优化（P2）**：扫视结算增加 finished 守卫防双计；插屏广告延迟 1.2s 弹出避免打断结算；记忆游戏返回增加退出确认；反应游戏假目标命中区与方形视觉统一；清除数据时复位内存已解锁皮肤。

## 注意事项

- `serverUrl` 在 `app.js:14` 默认为空字符串，需要自行配置服务端地址
- 广告单元 ID 在 `ads.js` 中是占位符，发布前需要替换为真实的广告单元
- `project.config.json` 的 `packOptions` 已将 `pages/`（旧版小程序代码）排除打包