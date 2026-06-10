/**
 * Scene 基类 - 所有页面/场景的基础
 */
const { AnimationManager } = require('./animation')
const THEME = require('../config/theme')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../utils/guide')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, drawGlowArc, fillShadowRoundedRect, wrapText, drawNoiseOverlay } = require('./draw-utils')
const { getGameSkin, getAllSkins } = require('../utils/skins')
const app = require('../app')

class Scene {
  constructor(params) {
    this.params = params || {}
    this.animMgr = new AnimationManager()
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
    // 每日挑战
    if (this._isDaily && ud.dailyChallenge) {
      ud.dailyChallenge.completed = true
      app.saveUserData()
    }
    // 训练计划
    if (this.params && this.params.training && ud.trainingPlan) {
      const today = new Date().toISOString().slice(0, 10)
      if (!ud.trainingPlan.completed) ud.trainingPlan.completed = []
      if (!ud.trainingPlan.completed.includes(today)) {
        ud.trainingPlan.completed.push(today)
        app.saveUserData()
      }
    }
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

    // 纸质噪点纹理
    drawNoiseOverlay(ctx, w, h)
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
      if (this.gameState === 'playing') {
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
      if (this._hit(x, sy, expanded)) { console.log('[结算页] 返回首页按钮命中，执行 switchTab'); GameGlobal.sceneManager.switchTab('home'); return true }
      // 调试日志：触摸未命中时输出坐标信息
      console.log(`[结算页] 触摸(${Math.round(x)},${Math.round(y)}) sy=${Math.round(sy)} scrollY=${Math.round(this.scrollY)} 按钮区域(${Math.round(r.x)},${Math.round(r.y)},${Math.round(r.w)},${Math.round(r.h)})`)
    }
    return false
  }
}

module.exports = Scene
