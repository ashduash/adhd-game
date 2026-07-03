/**
 * 反应力游戏场景（实时目标生成）
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { vibrate } = require('../utils/util')
const { getReactRating } = require('../utils/scoring')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, fillCircle } = require('../base/draw-utils')
const app = require('../app')

const DIFFICULTIES = {
  easy: { time: 30, spawn: 1500, expire: 2000, fakeRate: 0.15, label: '初级' },
  normal: { time: 40, spawn: 1200, expire: 1500, fakeRate: 0.2, label: '中级' },
  hard: { time: 50, spawn: 800, expire: 1000, fakeRate: 0.3, label: '高级' },
  expert: { time: 55, spawn: 600, expire: 800, fakeRate: 0.4, label: '专家' },
  master: { time: 60, spawn: 400, expire: 600, fakeRate: 0.5, label: '大师' }
}

class ReactScene extends Scene {
  constructor(params) {
    super(params)
    this._gameKey = 'react'
    this.difficulty = (params && params.level) || 'easy'
    this.targets = []
    this.hits = 0; this.misses = 0; this.falsePositives = 0
    this.combo = 0; this.maxCombo = 0
    this.remainingTime = 0
    this._spawnTimer = null; this._tickTimer = null; this._targetId = 0
    this._hitTargets = []
  }

  onEnter() {
    this._initSkin()
    this.difficulty = this.params.level || 'easy'
    this.initGame()
    this._checkGuide()
  }

  onExit() { this._stopTimers() }

  onPause() {
    if (this.gameState === 'playing') { this._stopTimers(); this.gameState = 'paused' }
  }

  onResume() {
    if (this.gameState === 'paused') {
      this.gameState = 'playing'
      const cfg = DIFFICULTIES[this.difficulty]
      const now = Date.now()
      // 重置所有存活目标的时间戳，防止暂停期间被误判为过期
      for (const t of this.targets) t.time = now
      this._spawnTimer = setInterval(() => this._spawnTarget(), cfg.spawn)
      this._tickTimer = setInterval(() => {
        this.remainingTime -= 0.1
        if (this.remainingTime <= 5 && this.remainingTime > 0 && Math.abs(this.remainingTime % 1) < 0.15 && GameGlobal.audio) GameGlobal.audio.playSFX('countdown')
        const now2 = Date.now()
        this.targets = this.targets.filter(t => { if (now2 - t.time > cfg.expire) { if (!t.fake) this.misses++; return false } return true })
        if (this.remainingTime <= 0) this._gameFinished()
      }, 100)
    }
  }

  initGame() {
    this.targets = []; this.hits = 0; this.misses = 0; this.falsePositives = 0
    this.combo = 0; this.maxCombo = 0; this._hitTargets = []; this.resetGameState()
    const cfg = DIFFICULTIES[this.difficulty]; this.remainingTime = cfg.time
  }

  _startGame() {
    this.gameState = 'playing'
    const cfg = DIFFICULTIES[this.difficulty]
    this._spawnTimer = setInterval(() => this._spawnTarget(), cfg.spawn)
    this._tickTimer = setInterval(() => {
      this.remainingTime -= 0.1
      const now = Date.now()
      this.targets = this.targets.filter(t => { if (now - t.time > cfg.expire) { if (!t.fake) this.misses++; return false } return true })
      if (this.remainingTime <= 0) this._gameFinished()
    }, 100)
  }

  _stopTimers() { if (this._spawnTimer) { clearInterval(this._spawnTimer); this._spawnTimer = null } if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null } }
  _stopAllTimers() { this._stopTimers() }

  _spawnTarget() {
    const cfg = DIFFICULTIES[this.difficulty]; const sw = THEME.screenWidth; const sh = THEME.screenHeight
    const topBound = this._contentTop || (THEME.statusBarHeight + 72 * THEME.rpx + THEME.spacing.lg)
    const size = (40 + Math.random() * 30) * THEME.rpx
    const x = size + Math.random() * (sw - size * 2)
    const y = topBound + size + Math.random() * (sh - topBound - THEME.tabBarHeight - size * 2)
    const fake = Math.random() < cfg.fakeRate
    this.targets.push({ id: this._targetId++, x, y, size, fake, time: Date.now() })
  }

  onTouchStart(x, y) {
    if (this._handleOverlayTouch(x, y)) return
    if (this.gameState === 'ready') {
      if (this._handleReadyTouch(x, y, (key) => { this.difficulty = key; this.initGame() })) return
    }
    if (this.gameState === 'playing') {
      for (let i = this.targets.length - 1; i >= 0; i--) {
        const t = this.targets[i]; const dx = x - t.x; const dy = y - t.y
        if (dx * dx + dy * dy <= t.size * t.size) {
          if (t.fake) { this.falsePositives++; this.combo = 0; vibrate('heavy') }
          else { this.hits++; this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo; vibrate('light'); if (this.combo >= 3 && GameGlobal.audio) GameGlobal.audio.playSFX('combo'); this._hitTargets.push({ x: t.x, y: t.y, time: Date.now() }) }
          this.targets.splice(i, 1); return
        }
      }
    }
    if (this.gameState === 'finished') {
      if (this._handleFinishedTouch(x, y)) return
    }
  }

  _gameFinished() {
    this._stopTimers()
    const rating = getReactRating(this.hits, this.hits + this.misses, this.falsePositives)
    this._finishGameWithRating({ rating, gameMode: 'react', level: this.difficulty, score: this.maxCombo })
  }

  onRender(ctx) {
    this.renderBackButton(ctx)
    if (this.showGuide || this.showRules || this.showSkinPicker) return
    if (this.gameState === 'ready') this._renderReady(ctx)
    else if (this.gameState === 'playing') this._renderPlaying(ctx)
    else if (this.gameState === 'finished') this._renderFinished(ctx)
  }

  _renderReady(ctx) {
    this._renderReadyScreen(ctx, {
      icon: '🎯', title: '极速反应', subtitle: '点击圆形 · 避开方形',
      levels: Object.keys(DIFFICULTIES), currentLevel: this.difficulty,
      levelFormatter: (key) => DIFFICULTIES[key].label,
      levelBtnW: 100 * THEME.rpx, levelBtnH: 60 * THEME.rpx
    })
  }

  _renderPlaying(ctx) {
    const skin = this.currentSkin || {}
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    const infoBarY = this._contentTop; const infoBarH = 60 * THEME.rpx; const infoBarX = sp.xl; const infoBarW = sw - sp.xl * 2
    fillRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, THEME.cardBg)
    strokeRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, THEME.cardBorder, 1)
    drawText(ctx, `${Math.ceil(this.remainingTime)}s`, infoBarX + sp.md, infoBarY + infoBarH / 2, { fontSize: fs.xl, fontWeight: '700', color: this.remainingTime <= 5 ? '#FF6B6B' : THEME.textPrimary, baseline: 'middle' })
    drawText(ctx, `命中: ${this.hits}`, infoBarX + infoBarW / 2, infoBarY + infoBarH / 2, { fontSize: fs.md, color: THEME.textPrimary, align: 'center', baseline: 'middle' })
    if (this.combo >= 3) drawText(ctx, `${this.combo}连击！`, infoBarX + infoBarW - sp.md, infoBarY + infoBarH / 2, { fontSize: fs.md, fontWeight: '600', color: '#FFD700', align: 'right', baseline: 'middle' })

    const now = Date.now()
    this._hitTargets = this._hitTargets.filter(h => now - h.time < 300)
    for (const t of this.targets) {
      const age = now - t.time; const cfg = DIFFICULTIES[this.difficulty]; const lifeRatio = 1 - age / cfg.expire
      if (t.fake) {
        const fakeBg = skin.fake && skin.fake.bg || 'rgba(255,107,107,0.5)'
        const baseColor = fakeBg.replace(/[\d.]+\)$/, '')
        fillRoundedRect(ctx, t.x - t.size, t.y - t.size, t.size * 2, t.size * 2, 4 * THEME.rpx, `${baseColor}${0.4 + lifeRatio * 0.3})`)
      } else {
        const targetBg = skin.target && skin.target.bg || 'rgba(192,122,69,0.55)'
        const targetGlow = skin.target && skin.target.glow || 'rgba(192,122,69,0.35)'
        const alpha = 0.4 + lifeRatio * 0.3; const baseColor = targetBg.replace(/[\d.]+\)$/, ''); const baseGlow = targetGlow.replace(/[\d.]+\)$/, '')
        ctx.save(); ctx.shadowColor = `${baseGlow}${alpha * 0.5})`; ctx.shadowBlur = 15
        fillCircle(ctx, t.x, t.y, t.size, `${baseColor}${alpha})`); ctx.restore()
      }
    }
    for (const h of this._hitTargets) {
      const age = now - h.time; const t = age / 300; const r = 30 * THEME.rpx * (1 + t)
      ctx.save(); ctx.globalAlpha = 1 - t; ctx.beginPath(); ctx.arc(h.x, h.y, r, 0, Math.PI * 2)
      ctx.strokeStyle = skin.hitColor || '#00B894'; ctx.lineWidth = 3; ctx.stroke(); ctx.restore()
    }
  }

  _renderFinished(ctx) {
    const sp = THEME.spacing; const fs = THEME.fontSize
    this._renderFinishedScreen(ctx, {
      cardH: 180 * THEME.rpx,
      renderStats: (ctx, cx, y) => {
        drawCenteredText(ctx, `命中: ${this.hits}`, cx, y + sp.lg, { fontSize: fs.lg, fontWeight: '700', color: THEME.textPrimary })
        drawCenteredText(ctx, `误点: ${this.falsePositives}  |  最大连击: ${this.maxCombo}`, cx, y + sp.lg + fs.lg + sp.md, { fontSize: fs.sm, color: THEME.textSecondary })
      }
    })
  }
}

module.exports = ReactScene
