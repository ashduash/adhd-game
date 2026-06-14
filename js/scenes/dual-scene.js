/**
 * 双线任务游戏场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { vibrate } = require('../utils/util')
const { getDualRating } = require('../utils/scoring')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, drawGlowArc, fillCircle, fillShadowRoundedRect } = require('../base/draw-utils')
const app = require('../app')

const TASK_PAIRS = [
  { top: '点击偶数', bottom: '点击奇数', check: (num, zone) => zone === 'top' ? num % 2 === 0 : num % 2 !== 0 },
  { top: '点击 ≥5', bottom: '点击 <5', check: (num, zone) => zone === 'top' ? num >= 5 : num < 5 },
  { top: '点击红色', bottom: '点击蓝色', check: (num, zone, color) => zone === 'top' ? color === 'red' : color === 'blue' },
  { top: '点击3的倍数', bottom: '点击非3的倍数', check: (num, zone) => zone === 'top' ? num % 3 === 0 : num % 3 !== 0 },
  { top: '点击质数', bottom: '点击非质数', check: (num, zone) => { const p = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47]; return zone === 'top' ? p.includes(num) : !p.includes(num) } }
]

const DIFFICULTIES = {
  easy: { time: 30, spawn: 2000, expire: 2500, label: '初级' },
  normal: { time: 40, spawn: 1500, expire: 2000, label: '中级' },
  hard: { time: 50, spawn: 1000, expire: 1500, label: '高级' },
  expert: { time: 55, spawn: 700, expire: 1200, label: '专家' },
  master: { time: 60, spawn: 500, expire: 1000, label: '大师' }
}

class DualScene extends Scene {
  constructor(params) {
    super(params)
    this._gameKey = 'dual'
    this.difficulty = (params && params.level) || 'easy'
    this.taskPair = TASK_PAIRS[0]
    this.topTargets = []; this.bottomTargets = []
    this.topHits = 0; this.topMisses = 0; this.topTotal = 0
    this.bottomHits = 0; this.bottomMisses = 0; this.bottomTotal = 0
    this.remainingTime = 0
    this._spawnTimer = null; this._tickTimer = null; this._spawnDelayTimer = null; this._targetId = 0
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
      for (const t of this.topTargets) t.time = now
      for (const t of this.bottomTargets) t.time = now
      this._spawnTimer = setInterval(() => {
        this._spawnTarget('top')
        if (this._spawnDelayTimer) clearTimeout(this._spawnDelayTimer)
        this._spawnDelayTimer = setTimeout(() => this._spawnTarget('bottom'), cfg.spawn / 2)
      }, cfg.spawn)
      this._tickTimer = setInterval(() => {
        this.remainingTime -= 0.1; const now2 = Date.now()
        if (this.remainingTime <= 5 && this.remainingTime > 0 && Math.abs(this.remainingTime % 1) < 0.15 && GameGlobal.audio) GameGlobal.audio.playSFX('countdown')
        this.topTargets = this.topTargets.filter(t => { if (now2 - t.time > cfg.expire) { this.topTotal++; this.topMisses++; return false } return true })
        this.bottomTargets = this.bottomTargets.filter(t => { if (now2 - t.time > cfg.expire) { this.bottomTotal++; this.bottomMisses++; return false } return true })
        if (this.remainingTime <= 0) this._gameFinished()
      }, 100)
    }
  }

  initGame() {
    this.topTargets = []; this.bottomTargets = []
    this.topHits = 0; this.topMisses = 0; this.topTotal = 0
    this.bottomHits = 0; this.bottomMisses = 0; this.bottomTotal = 0
    this.resetGameState()
    const cfg = DIFFICULTIES[this.difficulty]; this.remainingTime = cfg.time
    this.taskPair = TASK_PAIRS[Math.floor(Math.random() * TASK_PAIRS.length)]
  }

  _startGame() {
    this.gameState = 'playing'
    const cfg = DIFFICULTIES[this.difficulty]
    this._spawnTimer = setInterval(() => {
      this._spawnTarget('top')
      if (this._spawnDelayTimer) clearTimeout(this._spawnDelayTimer)
      this._spawnDelayTimer = setTimeout(() => this._spawnTarget('bottom'), cfg.spawn / 2)
    }, cfg.spawn)
    this._tickTimer = setInterval(() => {
      this.remainingTime -= 0.1; const now = Date.now()
      this.topTargets = this.topTargets.filter(t => { if (now - t.time > cfg.expire) { this.topTotal++; this.topMisses++; return false } return true })
      this.bottomTargets = this.bottomTargets.filter(t => { if (now - t.time > cfg.expire) { this.bottomTotal++; this.bottomMisses++; return false } return true })
      if (this.remainingTime <= 0) this._gameFinished()
    }, 100)
  }

  _stopTimers() { if (this._spawnTimer) { clearInterval(this._spawnTimer); this._spawnTimer = null } if (this._tickTimer) { clearInterval(this._tickTimer); this._tickTimer = null } if (this._spawnDelayTimer) { clearTimeout(this._spawnDelayTimer); this._spawnDelayTimer = null } }
  _stopAllTimers() { this._stopTimers() }

  _spawnTarget(zone) {
    const sw = THEME.screenWidth; const halfH = (THEME.screenHeight - THEME.tabBarHeight - this._contentTop) / 2
    const size = 45 * THEME.rpx; const x = size + Math.random() * (sw - size * 2)
    const yBase = zone === 'top' ? this._contentTop : this._contentTop + halfH
    const y = yBase + size + Math.random() * (halfH - size * 2)
    const num = Math.floor(Math.random() * 20) + 1
    // 颜色任务对：随机分配红/蓝色
    const color = this.taskPair === TASK_PAIRS[2] ? (Math.random() < 0.5 ? 'red' : 'blue') : null
    const target = { id: this._targetId++, x, y, size, num, time: Date.now(), color }
    if (zone === 'top') { this.topTargets.push(target); this.topTotal++ }
    else { this.bottomTargets.push(target); this.bottomTotal++ }
  }

  onTouchStart(x, y) {
    if (this._handleOverlayTouch(x, y)) return
    if (this.gameState === 'ready') {
      if (this._handleReadyTouch(x, y, (key) => { this.difficulty = key; this.initGame() })) return
    }
    if (this.gameState === 'playing') {
      const zone = y < THEME.screenHeight / 2 ? 'top' : 'bottom'
      const targets = zone === 'top' ? this.topTargets : this.bottomTargets
      for (let i = targets.length - 1; i >= 0; i--) {
        const t = targets[i]; const dx = x - t.x; const dy = y - t.y
        if (dx * dx + dy * dy <= t.size * t.size) {
          const correct = this.taskPair.check(t.num, zone, t.color)
          if (correct) { if (zone === 'top') this.topHits++; else this.bottomHits++; vibrate('light') }
          else { if (zone === 'top') this.topMisses++; else this.bottomMisses++; vibrate('heavy') }
          targets.splice(i, 1); return
        }
      }
    }
    if (this.gameState === 'finished') {
      if (this._handleFinishedTouch(x, y)) return
    }
  }

  _gameFinished() {
    this._stopTimers()
    const topAcc = this.topTotal > 0 ? (this.topHits / this.topTotal * 100) : 0
    const bottomAcc = this.bottomTotal > 0 ? (this.bottomHits / this.bottomTotal * 100) : 0
    const rating = getDualRating(topAcc, bottomAcc)
    this._finishGameWithRating({ rating, gameMode: 'dual', level: this.difficulty, score: this.topHits + this.bottomHits })
  }

  onRender(ctx) {
    this.renderBackButton(ctx)
    if (this.showGuide || this.showRules || this.showSkinPicker) return
    if (this.gameState === 'ready') this._renderReady(ctx)
    else if (this.gameState === 'playing') this._renderPlaying(ctx)
    else if (this.gameState === 'finished') this._renderFinished(ctx)
  }

  _renderReady(ctx) {
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    this._renderReadyScreen(ctx, {
      icon: '🔀', title: '双线任务', subtitle: '上下区域不同规则',
      levels: Object.keys(DIFFICULTIES), currentLevel: this.difficulty,
      levelFormatter: (key) => DIFFICULTIES[key].label,
      levelBtnW: 100 * THEME.rpx, levelBtnH: 60 * THEME.rpx
    })
  }

  _renderPlaying(ctx) {
    const skin = this.currentSkin || {}
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    const baseY = this._contentTop; const halfH = (THEME.screenHeight - THEME.tabBarHeight - baseY) / 2
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'; ctx.lineWidth = 1; ctx.beginPath()
    ctx.moveTo(0, baseY + halfH); ctx.lineTo(sw, baseY + halfH); ctx.stroke()
    const taskLabelW = sw - sp.xl * 2; const taskLabelH = 40 * THEME.rpx
    fillRoundedRect(ctx, sp.xl, baseY + sp.xs, taskLabelW, taskLabelH, THEME.btnRadius, 'rgba(116,185,255,0.15)')
    drawCenteredText(ctx, `上方: ${this.taskPair.top}`, sw / 2, baseY + sp.xs + taskLabelH / 2, { fontSize: fs.sm, fontWeight: '600', color: '#74B9FF', baseline: 'middle' })
    fillRoundedRect(ctx, sp.xl, baseY + halfH + sp.xs, taskLabelW, taskLabelH, THEME.btnRadius, 'rgba(255,107,107,0.15)')
    drawCenteredText(ctx, `下方: ${this.taskPair.bottom}`, sw / 2, baseY + halfH + sp.xs + taskLabelH / 2, { fontSize: fs.sm, fontWeight: '600', color: '#FF6B6B', baseline: 'middle' })
    drawText(ctx, `${Math.ceil(this.remainingTime)}s`, sp.xl, baseY + sp.sm, { fontSize: fs.xl, fontWeight: '700', color: this.remainingTime <= 5 ? '#FF6B6B' : THEME.textPrimary })
    for (const t of this.topTargets) {
      const bg = t.color === 'red' ? '#E74C3C' : t.color === 'blue' ? '#3498DB' : (skin.top && skin.top.bg || 'rgba(116,185,255,0.7)')
      const glow = t.color === 'red' ? 'rgba(231,76,60,0.4)' : t.color === 'blue' ? 'rgba(52,152,219,0.4)' : (skin.top && skin.top.glow || 'rgba(116,185,255,0.4)')
      ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 10
      fillCircle(ctx, t.x, t.y, t.size, bg); ctx.restore()
      ctx.font = `700 ${fs.lg}px ${THEME.fontFamily}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(t.num), t.x, t.y)
    }
    for (const t of this.bottomTargets) {
      const bg = t.color === 'red' ? '#E74C3C' : t.color === 'blue' ? '#3498DB' : (skin.bottom && skin.bottom.bg || 'rgba(255,107,107,0.7)')
      const glow = t.color === 'red' ? 'rgba(231,76,60,0.4)' : t.color === 'blue' ? 'rgba(52,152,219,0.4)' : (skin.bottom && skin.bottom.glow || 'rgba(255,107,107,0.4)')
      ctx.save(); ctx.shadowColor = glow; ctx.shadowBlur = 10
      fillCircle(ctx, t.x, t.y, t.size, bg); ctx.restore()
      ctx.font = `700 ${fs.lg}px ${THEME.fontFamily}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(t.num), t.x, t.y)
    }
  }

  _renderFinished(ctx) {
    const sp = THEME.spacing; const fs = THEME.fontSize
    this._renderFinishedScreen(ctx, {
      cardH: 180 * THEME.rpx,
      renderStats: (ctx, cx, y) => {
        const topAcc = this.topTotal > 0 ? Math.round(this.topHits / this.topTotal * 100) : 0
        const bottomAcc = this.bottomTotal > 0 ? Math.round(this.bottomHits / this.bottomTotal * 100) : 0
        drawCenteredText(ctx, `上方: ${this.topHits}/${this.topTotal} (${topAcc}%)`, cx, y + sp.lg, { fontSize: fs.md, fontWeight: '600', color: '#74B9FF' })
        drawCenteredText(ctx, `下方: ${this.bottomHits}/${this.bottomTotal} (${bottomAcc}%)`, cx, y + sp.lg + fs.md + sp.sm, { fontSize: fs.md, fontWeight: '600', color: '#FF6B6B' })
      }
    })
  }
}

module.exports = DualScene
