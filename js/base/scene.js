/**
 * Scene 基类 - 所有页面/场景的基础
 */
const { AnimationManager } = require('./animation')
const THEME = require('../config/theme')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../utils/guide')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, drawGlowArc, fillShadowRoundedRect, wrapText } = require('./draw-utils')
const { getGameSkin, getAllSkins } = require('../utils/skins')
const share = require('../utils/share')
const app = require('../app')

// 打卡日期辅助（避免使用 wx 之外的时区问题，用本地时间）
function _todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function _yesterdayStr() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// 好友挑战比分判定
// 时间类模式（schulte/sort）用时越短越好，其余模式分数越高越好
const _TIME_MODES = { schulte: true, sort: true }
const _RATING_ORDER = { S: 4, A: 3, B: 2, C: 1, D: 0 }

function _formatChallengeScore(mode, score) {
  if (_TIME_MODES[mode]) {
    const sec = (typeof score === 'number' && isFinite(score)) ? score / 1000 : 0
    return sec.toFixed(1) + 's'
  }
  return String(Math.round(score == null ? 0 : score))
}

// challenge: { mode, score, rating, level }  cfg: { gameMode, level, score, rating }
// 同难度比分数，不同难度退化为比评级，保证公平性
function _compareChallenge(challenge, cfg) {
  const lowerIsBetter = !!_TIME_MODES[cfg.gameMode]
  const sameLevel = challenge.level === cfg.level
  let result
  if (sameLevel) {
    if (cfg.score === challenge.score) result = 'draw'
    else if (lowerIsBetter) result = cfg.score < challenge.score ? 'win' : 'lose'
    else result = cfg.score > challenge.score ? 'win' : 'lose'
  } else {
    const a = _RATING_ORDER[cfg.rating] || 0
    const b = _RATING_ORDER[challenge.rating] || 0
    result = a === b ? 'draw' : (a > b ? 'win' : 'lose')
  }
  return {
    result,
    myScore: cfg.score,
    friendScore: challenge.score,
    lowerIsBetter,
    sameLevel,
    mode: cfg.gameMode
  }
}

class Scene {
  constructor(params) {
    this.params = params || {}
    this.animMgr = new AnimationManager()
    // 每日挑战标记：首页会以 { daily: true } 方式进入，统一在此读取，覆盖所有模式
    this._isDaily = !!(params && params.daily)
    // 好友挑战上下文：首页「接受挑战」会携带 { mode, score, rating, level } 进入对应玩法
    this._challenge = (params && params.challenge) ? params.challenge : null
    this._challengeResult = null
    this._isTab = false
    this._active = false
    this._hasEntered = false
    this.children = []
    // 滚动相关
    this.scrollY = 0
    this.scrollVelocity = 0
    this._touchStartY = 0
    this._lastTouchY = 0
    this._isDragging = false
    this._maxScroll = 0
    // 游戏公共状态
    this._gameKey = ''
    this.gameState = 'ready'
    this.showGuide = false
    this.guideStep = 0
    this._guideNextRect = null
    this._guideSkipRect = null
    this.showRules = false
    this.showSkinPicker = false
    this.currentSkin = null
    this._backBtnRect = null
    this._rulesBtnRect = null
    this._skinBtnRect = null
    this._skinItemRects = []
    this._levelBtnRects = []
    this._startBtnRect = null
    this._restartBtnRect = null
    this._homeBtnRect = null
    this._doubleBtnRect = null
    this._nextLevelBtnRect = null
    this._challengeBtnRect = null
    this._contentTop = 0
    this.rating = ''
    this.ratingColor = ''
    this.ratingLabel = ''
    this.earnedPoints = 0
    this.isNewRecord = false
    this.doubleClaimed = false
    this._finishSoundPlayed = false
    this.showExitConfirm = false
  }

  // 生命周期钩子
  onEnter() {}
  onExit() {}
  onShow() {}
  onHide() {}
  onUpdate(dt) {}
  onRender(ctx) {}

  // 重置游戏状态（供子类 initGame 调用）
  resetGameState() {
    this.gameState = 'ready'
    this._finishSoundPlayed = false
    this._finishScreenScrolled = false
    this.isNewRecord = false
    this.rating = ''
  }

  // 完成每日挑战和训练计划标记（供子类 _gameFinished 调用）
  _completeDailyAndTraining() {
    const ud = app.globalData.userData
    const today = _todayStr()
    // 每日挑战
    if (this._isDaily && ud.dailyChallenge) {
      ud.dailyChallenge.completed = true
      // 累计完成次数（同一天重复挑战只计一次，避免刷成就）
      if (ud.dailyChallenge.lastCountedDate !== today) {
        ud.dailyChallenge.completedCount = (ud.dailyChallenge.completedCount || 0) + 1
        ud.dailyChallenge.lastCountedDate = today
      }
      app.saveUserData()
    }
    // 训练计划
    if (this.params && this.params.training && ud.trainingPlan) {
      if (!ud.trainingPlan.completed) ud.trainingPlan.completed = []
      if (!ud.trainingPlan.completed.includes(today)) {
        ud.trainingPlan.completed.push(today)
        app.saveUserData()
      }
    }
  }

  // 连续打卡天数更新：每天首次完成一局时累加（断签则重置）
  _updateStreak() {
    const ud = app.globalData.userData
    const today = _todayStr()
    if (ud.lastPlayDate === today) return // 当天已计过
    if (ud.lastPlayDate === _yesterdayStr()) {
      ud.streak = (ud.streak || 0) + 1
    } else {
      ud.streak = 1 // 首次游玩或断签后重新开始
    }
    ud.lastPlayDate = today
  }

  // 触摸事件（子类重写）
  onTouchStart(x, y) {}
  onTouchMove(x, y) {}
  onTouchEnd(x, y) {}

  // 更新（由 SceneManager 调用）
  update(dt) {
    this.animMgr.update(dt)
    // 惯性滚动
    if (Math.abs(this.scrollVelocity) > 0.5) {
      this.scrollY += this.scrollVelocity * dt
      this.scrollVelocity *= Math.pow(0.92, dt * 60)
      if (this.scrollY < 0) { this.scrollY = 0; this.scrollVelocity = 0 }
      if (this.scrollY > this._maxScroll) { this.scrollY = this._maxScroll; this.scrollVelocity = 0 }
    } else {
      this.scrollVelocity = 0
    }
    this.onUpdate(dt)
  }

  // 渲染（由 SceneManager 调用）
  render(ctx) {
    this.drawBackground(ctx)
    ctx.save()
    ctx.translate(0, -this.scrollY)
    this.onRender(ctx)
    ctx.restore()
  }

  // 绘制渐变背景 + 纸质纹理
  drawBackground(ctx) {
    const w = THEME.screenWidth
    const h = THEME.screenHeight
    const gradient = ctx.createLinearGradient(0, 0, 0, h)
    gradient.addColorStop(0, THEME.bgGradient[0])
    gradient.addColorStop(1, THEME.bgGradient[1])
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    // 柔和暖光点（左上角微弱光晕，增加层次感）
    ctx.save()
    ctx.globalAlpha = THEME.currentTheme === 'white' ? 0.06 : 0.04
    const glow = ctx.createRadialGradient(w * 0.2, h * 0.15, 0, w * 0.2, h * 0.15, w * 0.6)
    glow.addColorStop(0, THEME.primaryEnd)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, w, h)
    ctx.restore()
  }

  // 滚动处理（子类在 onTouchStart/Move/End 中调用）
  handleScrollStart(y) {
    this._touchStartY = y
    this._lastTouchY = y
    this._isDragging = true
    this.scrollVelocity = 0
  }

  handleScrollMove(y) {
    if (!this._isDragging) return
    const dy = this._lastTouchY - y
    this.scrollY += dy
    this.scrollVelocity = dy * 60
    this._lastTouchY = y
    if (this.scrollY < 0) this.scrollY = 0
    if (this.scrollY > this._maxScroll) this.scrollY = this._maxScroll
  }

  handleScrollEnd() {
    this._isDragging = false
  }

  // 设置最大滚动距离
  setMaxScroll(contentHeight) {
    this._maxScroll = Math.max(0, contentHeight - THEME.screenHeight + THEME.tabBarHeight)
  }

  // ========== 游戏公共方法 ==========

  // 碰撞检测
  _hit(px, py, r) {
    return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h
  }

  // 皮肤初始化
  _initSkin() {
    this.currentSkin = getGameSkin(this._gameKey, wx.getStorageSync('skin') || 'night')
  }

  // 引导检查
  _checkGuide() {
    if (!checkGuided(this._gameKey)) {
      setTimeout(() => { this.showGuide = true }, 300)
    }
  }

  // 通用皮肤选择
  async _selectSkin(id) {
    if (!app.isSkinUnlocked(id)) {
      const watched = await app.showRewardedAd()
      if (watched) {
        app.unlockSkin(id)
        const skin = getAllSkins().find(s => s.id === id)
        if (GameGlobal.toast) GameGlobal.toast.show(`解锁「${skin ? skin.name : id}」`)
      }
      return
    }
    wx.setStorageSync('skin', id)
    this.currentSkin = getGameSkin(this._gameKey, id)
    this.showSkinPicker = false
  }

  // 广告双倍积分
  async _watchAdDouble() {
    if (this.doubleClaimed) return
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.earnedPoints)
      this.doubleClaimed = true
      if (GameGlobal.toast) GameGlobal.toast.show(`+${this.earnedPoints} 积分`)
    }
  }

  // 渲染返回按钮 + overlay 分发 + 设置 _contentTop
  renderBackButton(ctx) {
    const sp = THEME.spacing
    const btnSize = 72 * THEME.rpx
    const btnY = THEME.statusBarHeight + sp.md * 2 + THEME.contentTopPadding
    const btnX = sp.xl
    this._backBtnRect = { x: btnX, y: btnY, w: btnSize, h: btnSize }

    if (this.showGuide) { this._renderGuide(ctx); return }
    if (this.showRules) { this._renderRules(ctx); return }
    if (this.showSkinPicker) { this._renderSkinPicker(ctx); return }
    if (this.showExitConfirm) { this._renderExitConfirm(ctx); return }

    ctx.save(); ctx.globalAlpha = 0.9
    fillRoundedRect(ctx, btnX, btnY, btnSize, btnSize, btnSize / 2, THEME.btnSecondaryBg)
    strokeRoundedRect(ctx, btnX, btnY, btnSize, btnSize, btnSize / 2, THEME.btnSecondaryBorder, 1)
    ctx.restore()
    drawCenteredText(ctx, '←', btnX + btnSize / 2, btnY + btnSize / 2, { fontSize: THEME.fontSize.xl, color: THEME.textPrimary, baseline: 'middle' })
    this._contentTop = btnY + btnSize + sp.lg
  }

  // 渲染引导层
  _renderGuide(ctx) {
    const steps = GUIDE_STEPS[this._gameKey] || []
    const step = steps[this.guideStep] || {}
    const sw = THEME.screenWidth; const sh = THEME.screenHeight
    ctx.fillStyle = THEME.overlayBg; ctx.fillRect(0, 0, sw, sh)
    const cardW = sw * 0.85; const cardH = 400 * THEME.rpx; const cardX = (sw - cardW) / 2; const cardY = (sh - cardH) / 2
    fillRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.modalBg)
    strokeRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.cardBorder, 1)
    ctx.font = `${THEME.fontSize.title}px ${THEME.fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'top'; ctx.fillText(step.icon || '📖', sw / 2, cardY + THEME.spacing.xl)
    drawCenteredText(ctx, step.title || '', sw / 2, cardY + THEME.spacing.xl + THEME.fontSize.title + THEME.spacing.md, { fontSize: THEME.fontSize.xl, fontWeight: '700', color: THEME.textPrimary })
    drawCenteredText(ctx, step.desc || '', sw / 2, cardY + THEME.spacing.xl + THEME.fontSize.title + THEME.fontSize.xl + THEME.spacing.xl, { fontSize: THEME.fontSize.md, color: THEME.textSecondary })
    const dotsY = cardY + cardH - 140 * THEME.rpx; const dotGap = 20 * THEME.rpx; let dx = (sw - steps.length * dotGap) / 2
    for (let i = 0; i < steps.length; i++) {
      const isActive = i === this.guideStep
      fillRoundedRect(ctx, dx, dotsY, isActive ? 24 * THEME.rpx : 12 * THEME.rpx, 12 * THEME.rpx, 6 * THEME.rpx, isActive ? THEME.primary : THEME.cardBorder)
      dx += dotGap
    }
    const btnY = cardY + cardH - 80 * THEME.rpx; const btnH = 60 * THEME.rpx; const skipW = 160 * THEME.rpx; const nextW = 160 * THEME.rpx
    this._guideSkipRect = { x: cardX + THEME.spacing.xl, y: btnY, w: skipW, h: btnH }
    fillRoundedRect(ctx, cardX + THEME.spacing.xl, btnY, skipW, btnH, THEME.btnRadius, THEME.btnSecondaryBg)
    drawCenteredText(ctx, '跳过', cardX + THEME.spacing.xl + skipW / 2, btnY + btnH / 2, { fontSize: THEME.fontSize.sm, color: THEME.textSecondary, baseline: 'middle' })
    const isLast = this.guideStep >= steps.length - 1
    this._guideNextRect = { x: cardX + cardW - THEME.spacing.xl - nextW, y: btnY, w: nextW, h: btnH }
    fillGradientRoundedRect(ctx, cardX + cardW - THEME.spacing.xl - nextW, btnY, nextW, btnH, THEME.btnRadius, 135, [[0, THEME.primaryLight], [1, THEME.primaryStart]])
    drawCenteredText(ctx, isLast ? '开始' : '下一步', cardX + cardW - THEME.spacing.xl - nextW / 2, btnY + btnH / 2, { fontSize: THEME.fontSize.sm, fontWeight: '600', color: '#ffffff', baseline: 'middle' })
  }

  // 渲染规则弹窗
  _renderRules(ctx) {
    const sw = THEME.screenWidth; const sh = THEME.screenHeight
    ctx.fillStyle = THEME.overlayBg; ctx.fillRect(0, 0, sw, sh)
    const sections = RULES_TEXT[this._gameKey] || []
    const cardW = sw * 0.85; const cardH = sh * 0.7; const cardX = (sw - cardW) / 2; const cardY = (sh - cardH) / 2
    fillRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.modalBg)
    drawCenteredText(ctx, '玩法说明', sw / 2, cardY + THEME.spacing.xl, { fontSize: THEME.fontSize.xl, fontWeight: '700', color: THEME.textPrimary })
    let y = cardY + THEME.spacing.xl + THEME.fontSize.xl + THEME.spacing.lg
    ctx.save(); ctx.beginPath(); ctx.rect(cardX, y, cardW, cardH - (y - cardY) - THEME.spacing.xl); ctx.clip()
    for (const section of sections) {
      drawText(ctx, section.title, cardX + THEME.spacing.lg, y, { fontSize: THEME.fontSize.md, fontWeight: '600', color: THEME.textAccent })
      y += THEME.fontSize.md + THEME.spacing.xs
      const lines = wrapText(ctx, section.text, cardW - THEME.spacing.lg * 2, THEME.fontSize.sm)
      for (const line of lines) { drawText(ctx, line, cardX + THEME.spacing.lg, y, { fontSize: THEME.fontSize.sm, color: THEME.textSecondary }); y += THEME.fontSize.sm * 1.6 }
      y += THEME.spacing.lg
    }
    ctx.restore()
    drawCenteredText(ctx, '点击任意位置关闭', sw / 2, cardY + cardH - THEME.spacing.xl - THEME.fontSize.sm, { fontSize: THEME.fontSize.sm, color: THEME.textSecondary })
  }

  // 渲染退出确认弹窗（Canvas 版，替代 wx.showModal）
  _renderExitConfirm(ctx) {
    const sw = THEME.screenWidth; const sh = THEME.screenHeight
    const sp = THEME.spacing; const fs = THEME.fontSize
    ctx.fillStyle = THEME.overlayBg; ctx.fillRect(0, 0, sw, sh)
    const cardW = sw * 0.75; const cardH = 200 * THEME.rpx
    const cardX = (sw - cardW) / 2; const cardY = (sh - cardH) / 2
    fillRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.modalBg)
    strokeRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.cardBorder, 1)
    drawCenteredText(ctx, '退出游戏', sw / 2, cardY + sp.xl, { fontSize: fs.lg, fontWeight: '700', color: THEME.textPrimary })
    drawCenteredText(ctx, '确定要退出吗？', sw / 2, cardY + sp.xl + fs.lg + sp.md, { fontSize: fs.md, color: THEME.textSecondary })
    const btnH = 60 * THEME.rpx; const btnY = cardY + cardH - btnH - sp.lg
    const btnW = (cardW - sp.xl * 2 - sp.md) / 2
    this._exitCancelRect = { x: cardX + sp.xl, y: btnY, w: btnW, h: btnH }
    this._exitConfirmRect = { x: cardX + sp.xl + btnW + sp.md, y: btnY, w: btnW, h: btnH }
    fillRoundedRect(ctx, cardX + sp.xl, btnY, btnW, btnH, THEME.btnRadius, THEME.cardBg)
    strokeRoundedRect(ctx, cardX + sp.xl, btnY, btnW, btnH, THEME.btnRadius, THEME.cardBorder, 1)
    drawCenteredText(ctx, '取消', cardX + sp.xl + btnW / 2, btnY + btnH / 2, { fontSize: fs.md, color: THEME.textSecondary, baseline: 'middle' })
    fillGradientRoundedRect(ctx, cardX + sp.xl + btnW + sp.md, btnY, btnW, btnH, THEME.btnRadius, 135, [[0, THEME.primaryStart], [1, THEME.primaryEnd]])
    drawCenteredText(ctx, '退出', cardX + sp.xl + btnW + sp.md + btnW / 2, btnY + btnH / 2, { fontSize: fs.md, fontWeight: '600', color: '#ffffff', baseline: 'middle' })
  }

  // 渲染皮肤选择器
  _renderSkinPicker(ctx) {
    const sw = THEME.screenWidth; const sh = THEME.screenHeight
    ctx.fillStyle = THEME.overlayBg; ctx.fillRect(0, 0, sw, sh)
    const skins = getAllSkins(); const cardW = sw * 0.85; const itemH = 90 * THEME.rpx
    const cardH = THEME.spacing.xl * 2 + THEME.fontSize.xl + THEME.spacing.lg + skins.length * (itemH + THEME.spacing.md)
    const cardX = (sw - cardW) / 2; const cardY = (sh - cardH) / 2
    fillRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.modalBg)
    drawCenteredText(ctx, '选择皮肤', sw / 2, cardY + THEME.spacing.xl, { fontSize: THEME.fontSize.xl, fontWeight: '700', color: THEME.textPrimary })
    let y = cardY + THEME.spacing.xl + THEME.fontSize.xl + THEME.spacing.lg
    this._skinItemRects = []
    const savedSkin = wx.getStorageSync('skin') || 'night'
    for (const skin of skins) {
      const locked = !app.isSkinUnlocked(skin.id); const isActive = savedSkin === skin.id
      const ix = cardX + THEME.spacing.lg; const iw = cardW - THEME.spacing.lg * 2
      fillRoundedRect(ctx, ix, y, iw, itemH, THEME.btnRadius, isActive ? 'rgba(192,122,69,0.18)' : THEME.cardBg)
      if (isActive) strokeRoundedRect(ctx, ix, y, iw, itemH, THEME.btnRadius, THEME.primary, 2)
      ctx.font = `${THEME.fontSize.xl}px ${THEME.fontFamily}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(skin.icon, ix + THEME.spacing.md, y + (itemH - THEME.fontSize.xl) / 2)
      ctx.globalAlpha = locked ? 0.5 : 1
      drawText(ctx, skin.name, ix + THEME.spacing.md + THEME.fontSize.xl + THEME.spacing.md, y + THEME.spacing.md, { fontSize: THEME.fontSize.md, fontWeight: '600', color: THEME.textPrimary })
      drawText(ctx, skin.description, ix + THEME.spacing.md + THEME.fontSize.xl + THEME.spacing.md, y + THEME.spacing.md + THEME.fontSize.md + THEME.spacing.xs, { fontSize: THEME.fontSize.xs, color: THEME.textSecondary })
      ctx.globalAlpha = 1
      if (locked) drawText(ctx, '🔒 看视频解锁', ix + iw - 180 * THEME.rpx, y + (itemH - THEME.fontSize.sm) / 2, { fontSize: THEME.fontSize.sm, color: THEME.textAccent })
      this._skinItemRects.push({ x: ix, y, w: iw, h: itemH, id: skin.id }); y += itemH + THEME.spacing.md
    }
  }

  // 渲染通用准备页
  _renderReadyScreen(ctx, cfg) {
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    const extraH = cfg.extraHeight || 0
    const btnHForLayout = cfg.levelBtnH || 60 * THEME.rpx
    const contentH = 64 * THEME.rpx + 80 * THEME.rpx + fs.xl + sp.xs + fs.md + sp.xl + fs.md + sp.md + btnHForLayout + sp.xl + 90 * THEME.rpx + sp.lg + 50 * THEME.rpx + extraH
    const availTop = this._contentTop; const availBottom = THEME.screenHeight - THEME.tabBarHeight
    let y = availTop + (availBottom - availTop - contentH) / 2
    drawCenteredText(ctx, cfg.icon, sw / 2, y, { fontSize: 64 * THEME.rpx }); y += 80 * THEME.rpx
    drawCenteredText(ctx, cfg.title, sw / 2, y, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary }); y += fs.xl + sp.xs
    drawCenteredText(ctx, cfg.subtitle, sw / 2, y, { fontSize: fs.md, color: THEME.textSecondary }); y += fs.md + sp.xl

    // 可选的自定义区域（如提示模式按钮）
    if (cfg.renderExtra) y = cfg.renderExtra(ctx, y)

    drawCenteredText(ctx, cfg.levelLabel || '选择难度', sw / 2, y, { fontSize: fs.md, fontWeight: '600', color: THEME.textPrimary }); y += fs.md + sp.md
    const levels = cfg.levels; const btnW = cfg.levelBtnW || 80 * THEME.rpx; const btnH = cfg.levelBtnH || 60 * THEME.rpx; const btnGap = sp.sm
    const totalW = levels.length * btnW + (levels.length - 1) * btnGap; let lx = (sw - totalW) / 2
    this._levelBtnRects = []
    for (const lv of levels) {
      const a = lv === cfg.currentLevel
      if (a) { fillGradientRoundedRect(ctx, lx, y, btnW, btnH, THEME.btnRadius, 135, [[0, THEME.primaryStart], [1, THEME.primaryEnd]]) }
      else { fillRoundedRect(ctx, lx, y, btnW, btnH, THEME.btnRadius, THEME.cardBg); strokeRoundedRect(ctx, lx, y, btnW, btnH, THEME.btnRadius, THEME.cardBorder, 1) }
      const label = cfg.levelFormatter ? cfg.levelFormatter(lv) : `${lv}`
      drawCenteredText(ctx, label, lx + btnW / 2, y + btnH / 2, { fontSize: fs.sm, fontWeight: a ? '700' : '400', color: a ? '#ffffff' : THEME.textPrimary, baseline: 'middle' })
      this._levelBtnRects.push({ x: lx, y, w: btnW, h: btnH, level: lv, key: lv }); lx += btnW + btnGap
    }
    y += btnH + sp.xl
    const pad = sp.xl; const startW = sw - pad * 2; const startH = 90 * THEME.rpx
    this._startBtnRect = { x: pad, y, w: startW, h: startH }
    fillShadowRoundedRect(ctx, pad, y, startW, startH, THEME.btnRadius, THEME.primary, THEME.btnShadow, 20, 0, 4)
    fillGradientRoundedRect(ctx, pad, y, startW, startH, THEME.btnRadius, 135, [[0, THEME.primaryStart], [1, THEME.primaryEnd]])
    drawCenteredText(ctx, '开始挑战', sw / 2, y + startH / 2, { fontSize: fs.lg, fontWeight: '700', color: '#ffffff', baseline: 'middle' })
    y += startH + sp.lg
    const btnRuleW = 160 * THEME.rpx; const btnRuleH = 50 * THEME.rpx
    this._rulesBtnRect = { x: pad, y, w: btnRuleW, h: btnRuleH }
    fillRoundedRect(ctx, pad, y, btnRuleW, btnRuleH, THEME.btnRadius, THEME.btnSecondaryBg)
    drawCenteredText(ctx, '📖 玩法说明', pad + btnRuleW / 2, y + (btnRuleH - fs.sm) / 2, { fontSize: fs.sm, color: THEME.textSecondary })
    this._skinBtnRect = { x: sw - pad - btnRuleW, y, w: btnRuleW, h: btnRuleH }
    fillRoundedRect(ctx, sw - pad - btnRuleW, y, btnRuleW, btnRuleH, THEME.btnRadius, THEME.btnSecondaryBg)
    drawCenteredText(ctx, '🎨 皮肤', sw - pad - btnRuleW / 2, y + (btnRuleH - fs.sm) / 2, { fontSize: fs.sm, color: THEME.textSecondary })
  }

  // 渲染通用结算页
  _renderFinishedScreen(ctx, cfg) {
    // 首次进入结算页时重置滚动位置，确保按钮可见
    if (!this._finishScreenScrolled) {
      this._finishScreenScrolled = true
      this.scrollY = 0
      this.scrollVelocity = 0
    }
    // 结算音效（仅播放一次）
    if (!this._finishSoundPlayed) {
      this._finishSoundPlayed = true
      if (GameGlobal.audio) GameGlobal.audio.playSFX('finish')
      if (this.isNewRecord && GameGlobal.audio) {
        setTimeout(() => GameGlobal.audio.playSFX('newRecord'), 300)
      }
    }
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize; const cx = sw / 2; let y = this._contentTop
    const r = 70 * THEME.rpx; const cy = y + 80 * THEME.rpx
    drawGlowArc(ctx, cx, cy, r, 0, Math.PI * 2, 'rgba(255,255,255,0.1)', 8 * THEME.rpx, 0)
    drawGlowArc(ctx, cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2, this.ratingColor, 8 * THEME.rpx, 20)
    ctx.font = `700 ${THEME.fontSize.title}px ${THEME.fontFamily}`; ctx.fillStyle = this.ratingColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(this.rating, cx, cy)
    if (this.ratingLabel) drawCenteredText(ctx, this.ratingLabel, cx, cy + r + sp.sm, { fontSize: fs.sm, color: this.ratingColor })
    y = cy + r + sp.lg + (this.ratingLabel ? fs.sm : 0)
    const cardW = sw - sp.xl * 2; const cardX = sp.xl; const cardH = cfg.cardH || 160 * THEME.rpx
    fillShadowRoundedRect(ctx, cardX, y, cardW, cardH, THEME.cardRadius, 'rgba(255,255,255,0.06)', 'rgba(0,0,0,0.2)', 15, 0, 4)
    strokeRoundedRect(ctx, cardX, y, cardW, cardH, THEME.cardRadius, 'rgba(255,255,255,0.1)', 1)
    // 好友挑战结果横幅（应战好友后显示比分胜负）
    if (this._challengeResult) {
      const cr = this._challengeResult
      const bannerH = 96 * THEME.rpx
      const bg = cr.result === 'win' ? 'rgba(76,175,80,0.18)' : cr.result === 'lose' ? 'rgba(244,67,54,0.16)' : 'rgba(255,193,7,0.16)'
      const bd = cr.result === 'win' ? 'rgba(76,175,80,0.45)' : cr.result === 'lose' ? 'rgba(244,67,54,0.45)' : 'rgba(255,193,7,0.45)'
      const tc = cr.result === 'win' ? '#7ED957' : cr.result === 'lose' ? '#FF8A80' : '#FFD54F'
      const title = cr.result === 'win' ? '挑战成功' : cr.result === 'lose' ? '惜败一筹' : '势均力敌'
      fillRoundedRect(ctx, cardX, y, cardW, bannerH, THEME.cardRadius, bg)
      strokeRoundedRect(ctx, cardX, y, cardW, bannerH, THEME.cardRadius, bd, 1)
      drawCenteredText(ctx, title, cx, y + 30 * THEME.rpx, { fontSize: fs.md, fontWeight: '700', color: tc, baseline: 'middle' })
      const myTxt = _formatChallengeScore(cr.mode, cr.myScore)
      const frTxt = _formatChallengeScore(cr.mode, cr.friendScore)
      const cmp = cr.lowerIsBetter
        ? `你的 ${myTxt} · 好友 ${frTxt}（越短越好）`
        : `你的 ${myTxt} · 好友 ${frTxt}`
      drawCenteredText(ctx, cmp, cx, y + 62 * THEME.rpx, { fontSize: fs.sm, color: THEME.textSecondary, baseline: 'middle' })
      if (!cr.sameLevel) {
        drawCenteredText(ctx, '（难度不同，按评级比较）', cx, y + 82 * THEME.rpx, { fontSize: fs.xs, color: THEME.textSecondary, baseline: 'middle' })
      }
      y += bannerH + sp.md
    }
    // 渲染统计内容
    if (cfg.renderStats) cfg.renderStats(ctx, cx, y)
    // 新纪录
    if (this.isNewRecord) {
      const nrY = y + cardH - 50 * THEME.rpx
      const now = Date.now(); const pulse = (Math.sin(now / 300 * Math.PI) + 1) / 2
      fillRoundedRect(ctx, cx - 70 * THEME.rpx, nrY, 140 * THEME.rpx, 36 * THEME.rpx, 18 * THEME.rpx, `rgba(255,215,0,${0.15 + pulse * 0.15})`)
      strokeRoundedRect(ctx, cx - 70 * THEME.rpx, nrY, 140 * THEME.rpx, 36 * THEME.rpx, 18 * THEME.rpx, 'rgba(255,215,0,0.4)', 1)
      drawCenteredText(ctx, '🏆 新纪录！', cx, nrY + 18 * THEME.rpx, { fontSize: fs.sm, fontWeight: '600', color: '#FFD700', baseline: 'middle' })
    }
    drawCenteredText(ctx, `+${this.earnedPoints} 段位积分`, cx, y + cardH - 20 * THEME.rpx, { fontSize: fs.md, color: THEME.textAccent })
    y += cardH + sp.lg
    const btnW = cardW; const btnH = 80 * THEME.rpx; const pad = sp.xl
    // 看广告双倍
    if (!this.doubleClaimed) {
      this._doubleBtnRect = { x: pad, y, w: btnW, h: btnH }
      fillShadowRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, '#FFD700', 'rgba(255,215,0,0.3)', 15, 0, 3)
      fillGradientRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, 135, [[0, '#FFD700'], [1, '#FFA500']])
      drawCenteredText(ctx, '📺 看视频双倍积分', cx, y + btnH / 2, { fontSize: fs.md, fontWeight: '600', color: '#ffffff', baseline: 'middle' })
      y += btnH + sp.md
    } else {
      this._doubleBtnRect = null
    }
    // 重新开始
    this._restartBtnRect = { x: pad, y, w: btnW, h: btnH }
    fillGradientRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, 135, [[0, THEME.primaryStart], [1, THEME.primaryEnd]])
    drawCenteredText(ctx, '重新挑战', cx, y + btnH / 2, { fontSize: fs.md, fontWeight: '600', color: '#ffffff', baseline: 'middle' })
    y += btnH + sp.md
    // 下一难度
    if (cfg.hasNextLevel) {
      const nextLabel = cfg.nextLevelLabel || '下一难度'
      this._nextLevelBtnRect = { x: pad, y, w: btnW, h: btnH }
      fillRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, THEME.btnSecondaryBg)
      strokeRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, THEME.cardBorder, 1)
      drawCenteredText(ctx, nextLabel, cx, y + btnH / 2, { fontSize: fs.md, color: THEME.textPrimary, baseline: 'middle' })
      y += btnH + sp.md
    } else {
      this._nextLevelBtnRect = null
    }
    // 返回首页
    this._homeBtnRect = { x: pad, y, w: btnW, h: btnH }
    fillRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, THEME.btnSecondaryBg)
    strokeRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, THEME.cardBorder, 1)
    drawCenteredText(ctx, '返回首页', cx, y + btnH / 2, { fontSize: fs.md, color: THEME.textSecondary, baseline: 'middle' })
    y += btnH + sp.md
    // 挑战好友（带深链分享）
    this._challengeBtnRect = { x: pad, y, w: btnW, h: btnH }
    fillRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, 'rgba(123,165,160,0.16)')
    strokeRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, 'rgba(123,165,160,0.3)', 1)
    drawCenteredText(ctx, '挑战好友', cx, y + btnH / 2, { fontSize: fs.md, fontWeight: '600', color: '#9CC5C0', baseline: 'middle' })
  }

  // 举报入口
  _openReport() {
    if (typeof wx !== 'undefined' && wx.openCustomerServiceChat) {
      wx.openCustomerServiceChat({
        extInfo: { url: '' },
        corpId: '',
        success: () => {},
        fail: () => {
          GameGlobal.toast.show('违规内容请邮件举报: support@brainstorm.app', 3)
        }
      })
    } else {
      GameGlobal.toast.show('违规内容请邮件举报: support@brainstorm.app', 3)
    }
  }

  // Overlay 触控处理（返回/引导/规则/皮肤/退出确认），返回 true 表示已处理
  _handleOverlayTouch(x, y) {
    // overlay 元素在 scroll-translated 坐标系中渲染，触摸坐标需转换
    const sy = y + this.scrollY
    // 退出确认弹窗
    if (this.showExitConfirm) {
      if (this._exitCancelRect && this._hit(x, sy, this._exitCancelRect)) {
        this.showExitConfirm = false
        if (this.onResume) this.onResume()
        return true
      }
      if (this._exitConfirmRect && this._hit(x, sy, this._exitConfirmRect)) {
        this.showExitConfirm = false
        if (this._stopAllTimers) this._stopAllTimers()
        GameGlobal.sceneManager.switchTab('home')
        return true
      }
      return true // 点击其他区域忽略
    }
    if (this._backBtnRect && this._hit(x, sy, this._backBtnRect)) {
      if (this.showGuide) { markGuided(this._gameKey); this.showGuide = false; this.guideStep = 0; return true }
      if (this.showRules) { this.showRules = false; return true }
      if (this.showSkinPicker) { this.showSkinPicker = false; return true }
      if (['playing', 'showing', 'input', 'paused', 'paused_showing', 'paused_input'].includes(this.gameState)) {
        if (this.onPause) this.onPause()
        this.showExitConfirm = true
      } else {
        GameGlobal.sceneManager.switchTab('home')
      }
      return true
    }
    if (this.showGuide) {
      if (this._guideNextRect && this._hit(x, sy, this._guideNextRect)) {
        const steps = GUIDE_STEPS[this._gameKey] || []
        if (this.guideStep < steps.length - 1) { this.guideStep++ }
        else { markGuided(this._gameKey); this.showGuide = false; this.guideStep = 0 }
        return true
      }
      if (this._guideSkipRect && this._hit(x, sy, this._guideSkipRect)) {
        markGuided(this._gameKey); this.showGuide = false; this.guideStep = 0
        return true
      }
      return true
    }
    if (this.showRules) { this.showRules = false; return true }
    if (this.showSkinPicker) {
      for (let i = 0; i < this._skinItemRects.length; i++) {
        const rect = this._skinItemRects[i]
        if (this._hit(x, sy, rect)) { this._selectSkin(rect.id); return true }
      }
      this.showSkinPicker = false
      return true
    }
    return false
  }

  // 通用结算流程：子类算好评级后调用此方法完成后续操作
  // cfg: { rating, ratingLabel, gameMode, level, score, stats, extra }
  //   extra: 需要写入 bestScores[mode] 的成就派生字段（如 _maxCombo / _perfect / _cleared / _expertRating）
  _finishGameWithRating(cfg) {
    const { calcRankPoints } = require('../utils/scoring')
    this.rating = cfg.rating
    this.ratingColor = THEME.ratingColors[this.rating] || '#ffffff'
    if (this.rating === 'S') this.ratingLabel = '完美'
    else if (this.rating === 'A') this.ratingLabel = '优秀'
    else if (this.rating === 'B') this.ratingLabel = '不错'
    else this.ratingLabel = '继续加油'
    if (cfg.ratingLabel) this.ratingLabel = cfg.ratingLabel

    // 1) 连续打卡天数更新（每天首次完成计一次）
    this._updateStreak()

    // 2) 打卡积分加成：连续天数越多，积分倍率越高（详见 README）
    const streak = app.globalData.userData.streak || 0
    let multiplier = 1
    let multLabel = ''
    if (streak >= 30) { multiplier = 5; multLabel = '连续30天 · 积分×5' }
    else if (streak >= 14) { multiplier = 3; multLabel = '连续14天 · 积分×3' }
    else if (streak >= 7) { multiplier = 2; multLabel = '连续7天 · 积分×2' }

    this.isNewRecord = app.updateBestScore(cfg.gameMode, cfg.level, cfg.score)
    this.earnedPoints = calcRankPoints(cfg.gameMode, cfg.level, this.rating)
    this.earnedPoints = Math.max(1, Math.round(this.earnedPoints * multiplier))
    const rankResult = app.addRankPoints(this.earnedPoints)
    app.globalData.userData.totalGames++
    app.saveUserData()
    app.syncScoreToCloud().catch(e => console.warn('分数同步失败:', e))

    // 3) 合并成就派生字段（如 _maxCombo / _perfect / _cleared / _expertRating）
    if (cfg.extra) app.mergeModeMeta(cfg.gameMode, cfg.extra)

    // 4) 好友挑战比分判定（若本局是应战好友）
    if (this._challenge && this._challenge.mode === cfg.gameMode) {
      this._challengeResult = _compareChallenge(this._challenge, cfg)
    } else {
      this._challengeResult = null
    }

    // 5) 记录「挑战好友」深链上下文，并同步胶囊菜单分享内容
    this._challengeCtx = { mode: cfg.gameMode, score: cfg.score, rating: this.rating, level: cfg.level }
    const modeName = (require('../config/modes').MODES.find(m => m.id === cfg.gameMode) || {}).name || '专注力'
    let shareTitle = `我在「${modeName}」拿了 ${_formatChallengeScore(cfg.gameMode, cfg.score)}，敢来挑战我吗？`
    if (this._challengeResult) {
      const r = this._challengeResult.result
      if (r === 'win') shareTitle = `我在「${modeName}」赢了你，敢来扳回一城吗？`
      else if (r === 'lose') shareTitle = `我在「${modeName}」惜败，再战一局！`
      else shareTitle = `我在「${modeName}」和你打平，来分胜负！`
    }
    share.setSharePayload({
      title: shareTitle,
      imageUrl: '',
      query: share.buildChallengeQuery(this._challengeCtx)
    })

    this._completeDailyAndTraining()
    this.gameState = 'finished'
    this.doubleClaimed = false
    // 插屏延迟弹出，避免打断结算动画与新纪录提示
    setTimeout(() => app.tryShowInterstitial(), 1200)
    if (rankResult.promoted) {
      if (GameGlobal.audio) GameGlobal.audio.playSFX('rankUp')
      setTimeout(() => GameGlobal.toast.show(`恭喜升段！你已晋升为${rankResult.newRank}段位！`, 3), 500)
    }
    if (multLabel) {
      setTimeout(() => GameGlobal.toast.show(multLabel, 2), 600)
    }
  }

  // 准备页触控处理（难度/开始/规则/皮肤），返回 true 表示已处理
  _handleReadyTouch(x, y, onLevelChange) {
    const sy = y + this.scrollY
    for (const r of this._levelBtnRects) {
      if (this._hit(x, sy, r)) {
        if (onLevelChange) onLevelChange(r.level || r.key)
        return true
      }
    }
    if (this._startBtnRect && this._hit(x, sy, this._startBtnRect)) {
      if (GameGlobal.audio) GameGlobal.audio.playSFX('start')
      if (this._startGame) this._startGame()
      return true
    }
    if (this._rulesBtnRect && this._hit(x, sy, this._rulesBtnRect)) { this.showRules = true; return true }
    if (this._skinBtnRect && this._hit(x, sy, this._skinBtnRect)) { this.showSkinPicker = true; return true }
    return false
  }

  // 结算页触控处理（双倍/重开/下一难度/首页），返回 true 表示已处理
  _handleFinishedTouch(x, y, onNextLevel) {
    // 按钮 rect 是在 content 坐标系中（含 scrollY 偏移），触摸坐标是屏幕坐标系
    // 需要将 y 转换到 content 坐标系再做碰撞检测
    const sy = y + this.scrollY
    if (this._doubleBtnRect && this._hit(x, sy, this._doubleBtnRect)) { this._watchAdDouble(); return true }
    if (this._restartBtnRect && this._hit(x, sy, this._restartBtnRect)) { if (this.initGame) this.initGame(); return true }
    if (this._nextLevelBtnRect && this._hit(x, sy, this._nextLevelBtnRect)) { if (onNextLevel) onNextLevel(); return true }
    if (this._homeBtnRect) {
      // 扩大点击区域：上下各增加 20px 容错
      const r = this._homeBtnRect
      const expanded = { x: r.x - 10, y: r.y - 20, w: r.w + 20, h: r.h + 40 }
      if (this._hit(x, sy, expanded)) { GameGlobal.sceneManager.switchTab('home'); return true }
    }
    if (this._challengeBtnRect && this._hit(x, sy, this._challengeBtnRect)) {
      if (this._challengeCtx) {
        const ok = share.shareChallenge(this._challengeCtx)
        if (ok && GameGlobal.toast) GameGlobal.toast.show('已发起挑战，等好友来战！', 2)
      }
      return true
    }
    return false
  }
}

module.exports = Scene
