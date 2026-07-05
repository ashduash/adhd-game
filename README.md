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

5 套主题皮肤：

| 皮肤 ID | 风格 |
|---------|------|
| night | 深邃夜空（默认） |
| warm | 暖光 |
| sakura | 樱花 |
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

## 注意事项

- `serverUrl` 在 `app.js:14` 默认为空字符串，需要自行配置服务端地址
- 广告单元 ID 在 `ads.js` 中是占位符，发布前需要替换为真实的广告单元
- `project.config.json` 的 `packOptions` 已将 `pages/`（旧版小程序代码）排除打包