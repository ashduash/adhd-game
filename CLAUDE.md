# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

微信小游戏「专注风暴」，一款注意力训练游戏。使用 Canvas 绘制全部 UI，不使用 WXML/WXSS。

- AppID: wx16490bb8f5ee8ba1
- 云环境: cloud1-d3g8g2icn594133d1

## 开发命令

```bash
# 启动后端服务（本地开发）
cd server && node server.js

# 运行内容安全测试
node test-content-security.js
```

使用微信开发者工具打开项目目录进行小游戏开发和调试。

## 架构

### 入口与游戏循环

`game.js` 是入口文件，负责：
- 创建 Canvas 并适配 DPR 和高刷屏（120Hz）
- 初始化全局对象（GameGlobal.app, sceneManager, toast, audio）
- 注册触摸事件分发到 SceneManager
- 运行 requestAnimationFrame 游戏主循环

### 场景系统

采用场景栈架构，`SceneManager` 管理导航和生命周期：

```
game.js → SceneManager → Scene 基类 → 各游戏场景
```

- `js/base/scene.js` — Scene 基类，处理滚动、动画、通用游戏状态
- `js/base/scene-manager.js` — 场景栈管理，替代 wx.navigateTo/navigateBack
- `js/scenes/` — 各场景实现

场景生命周期：`onEnter → onShow → onUpdate/onRender → onHide → onExit`

Tab 场景（home/rank/profile）常驻栈底，通过 `switchTab` 切换。

### 游戏模式

8 种训练模式，每种有多个难度等级：
- schulte — 舒尔特方格
- memory — 记忆翻牌
- scan — 扫描追踪
- stroop — 斯特鲁普效应
- react — 反应速度
- match — 配对消除
- sort — 排序挑战
- dual — 双线操作

场景注册在 `game.js` 的 sceneRegistry 中，延迟加载避免循环依赖。

### UI 组件

`js/base/ui/` 下的纯 Canvas 组件：
- `tab-bar.js` — 底部 Tab 栏
- `button.js` — 按钮
- `card.js` — 卡片容器
- `grid.js` — 网格布局（舒尔特方格用）
- `modal.js` — 弹窗
- `progress-bar.js` — 进度条
- `toast.js` — 轻提示

### 绘图工具

`js/base/draw-utils.js` 提供 Canvas 绘图原语：圆角矩形、渐变、阴影、文字绘制、噪点叠加等。

### 全局状态

`js/app.js` 管理用户数据、段位、成就、每日挑战、训练计划。数据通过 `wx.setStorageSync` 持久化。

### 工具模块

`js/utils/` 下：
- `audio.js` — Web Audio API 程序化生成音效，无需音频文件
- `ads.js` — 激励视频和插屏广告
- `scoring.js` — 积分计算
- `skins.js` — 皮肤系统
- `sensitive-filter.js` — 内容安全过滤（本地 + 云函数 + 服务端三重检测）
- `daily.js` — 每日挑战
- `achievements.js` — 成就系统
- `training.js` — 训练计划

### 主题系统

`js/config/theme.js` 支持深色/浅色主题切换，通过 `THEME` 对象导出颜色常量。所有场景使用 `THEME.xxx` 引用颜色。

### 后端

- `server/server.js` — Node.js HTTP 服务，处理登录、内容安全检测、排行榜。端口 3000
- `cloudfunctions/` — 微信云函数：login、contentCheck、leaderboard、cleanSensitiveData

内容安全采用三重防线：本地敏感词 → 云函数 msgSecCheck → 服务端 HTTP 接口。

### 旧代码

`pages/` 和 `app.miniprogram.*` 是原小程序版本的遗留文件，已被 Canvas 版本替代。`project.config.json` 的 packOptions 已将其排除打包。
