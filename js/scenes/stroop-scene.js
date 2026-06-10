/**
 * Stroop 测试游戏场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { vibrate } = require('../utils/util')
const { calcRankPoints } = require('../utils/scoring')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, fillCircle, fillShadowRoundedRect } = require('../base/draw-utils')
const app = require('../app')

const COLORS = [
  { name: '红', value: '#FF6B6B' },
  { name: '蓝', value: '#74B9FF' },
  { name: '绿', value: '#00B894' },
  { name: '黄', value: '#FDCB6E' },
  { name: '紫', value: '#A29BFE' },
  { name: '橙', value: '#E17055' }
]

class StroopScene extends Scene {
  constructor(params) {
    super(params)
    this._gameKey = 'stroop'
    this.level = (params && params.level) || 15
    this.currentQuestion = null
    this.questionIndex = 0
    this.correct = 0
    this.total = 0
    this.startTime = 0
    this.elapsedTime = 0
    this._timer = null
    this._pendingTimer = null
    this._optionRects = []
    this._selectedOption = -1
    this._selectedTime = 0
    this._selectedOk = false
  }

  onEnter() {
    this._initSkin()
    this.level = this.params.level || 15
    this.initGame()
    this._checkGuide()
  }

  onExit() { this._stopTimer(); if (this._pendingTimer) { clearTimeout(this._pendingTimer); this._pendingTimer = null } }

  onPause() {
    if (this.gameState === 'playing') { this._stopTimer(); this.gameState = 'paused' }
  }

  onResume() {
    if (this.gameState === 'paused') {
      this.gameState = 'playing'
      this._startTimer()
    }
  }

  initGame() {
    this.questionIndex = 0; this.correct = 0; this.total = 0; this.elapsedTime = 0
    this.resetGameState()
    this._generateQuestion()
  }

  _startGame() { this.gameState = 'playing'; this._startTimer(); this._generateQuestion() }

  _generateQuestion() {
    const colorCount = this.level >= 35 ? 6 : 4
    const available = COLORS.slice(0, colorCount)
    const word = available[Math.floor(Math.random() * available.length)]
    let display = available[Math.floor(Math.random() * available.length)]
    while (display.name === word.name && available.length > 1) {
      display = available[Math.floor(Math.random() * available.length)]
    }
    const options = this._shuffle(available.map(c => c.name))
    this.currentQuestion = { word: word.name, displayColor: display.value, displayName: display.name, options }
  }

  _shuffle(arr) { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]] } return a }

  _startTimer() { this.startTime = Date.now() - this.elapsedTime; this._timer = setInterval(() => { this.elapsedTime = Date.now() - this.startTime }, 10) }
  _stopTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null } }
  _stopAllTimers() { this._stopTimer(); if (this._pendingTimer) { clearTimeout(this._pendingTimer); this._pendingTimer = null } }

  onTouchStart(x, y) {
    if (this._handleOverlayTouch(x, y)) return
    if (this.gameState === 'ready') {
      if (this._handleReadyTouch(x, y, (lv) => { this.level = lv; this.initGame() })) return
    }
    if (this.gameState === 'playing') {
      for (let i = 0; i < this._optionRects.length; i++) {
        const r = this._optionRects[i]
        if (this._hit(x, y, r)) { this._selectOption(r.name, i); return }
      }
    }
    if (this.gameState === 'finished') {
      if (this._handleFinishedTouch(x, y)) return
    }
  }

  _selectOption(name, idx) {
    this.total++; this._selectedOption = idx; this._selectedTime = Date.now()
    if (name === this.currentQuestion.displayName) { this.correct++; vibrate('light'); this._selectedOk = true }
    else { vibrate('heavy'); this._selectedOk = false }
    this.questionIndex++
    if (this._pendingTimer) clearTimeout(this._pendingTimer)
    if (this.questionIndex >= this.level) {
      this._pendingTimer = setTimeout(() => this._gameFinished(), 100)
    } else {
      this._pendingTimer = setTimeout(() => this._generateQuestion(), 200)
    }
  }

  _gameFinished() {
    this._stopTimer()
    const accuracy = this.total > 0 ? (this.correct / this.total * 100) : 0
    const sec = this.elapsedTime / 1000
    const thresholds = { 15: [7,14,22,32], 25: [12,22,36,55], 35: [17,32,50,75], 45: [22,42,65,95], 60: [28,52,82,120] }
    const t = thresholds[this.level] || thresholds[15]
    if (accuracy >= 100 && sec <= t[0]) { this.rating = 'S'; this.ratingLabel = '完美' }
    else if (accuracy >= 97 && sec <= t[1]) { this.rating = 'A'; this.ratingLabel = '优秀' }
    else if (accuracy >= 90 && sec <= t[2]) { this.rating = 'B'; this.ratingLabel = '不错' }
    else if (accuracy >= 75 && sec <= t[3]) { this.rating = 'C'; this.ratingLabel = '继续加油' }
    else { this.rating = 'D'; this.ratingLabel = '继续加油' }
    this.ratingColor = THEME.ratingColors[this.rating]
    this.isNewRecord = app.updateBestScore('stroop', this.level, this.correct)
    this.earnedPoints = calcRankPoints('stroop', this.level, this.rating)
    const rankResult = app.addRankPoints(this.earnedPoints)
    app.globalData.userData.totalGames++; app.saveUserData(); app.syncScoreToCloud().catch(e => console.warn("分数同步失败:", e))
    this._completeDailyAndTraining(); this.gameState = 'finished'; this.doubleClaimed = false
    app.tryShowInterstitial()
    if (rankResult.promoted) { if (GameGlobal.audio) GameGlobal.audio.playSFX('rankUp'); setTimeout(() => GameGlobal.toast.show(`恭喜升段！你已晋升为${rankResult.newRank}段位！`, 3), 500) }
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
      icon: '🎭', title: '斯特鲁普测试', subtitle: '选择文字的显示颜色',
      levels: [15, 25, 35, 45, 60], currentLevel: this.level,
      levelBtnW: 100 * THEME.rpx, levelBtnH: 60 * THEME.rpx
    })
  }

  _renderPlaying(ctx) {
    const skin = this.currentSkin || {}
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize

    const infoBarY = this._contentTop; const infoBarH = 70 * THEME.rpx; const infoBarX = sp.lg; const infoBarW = sw - sp.lg * 2
    fillRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, THEME.cardBg)
    strokeRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, THEME.cardBorder, 1)
    drawText(ctx, `${this.questionIndex + 1} / ${this.level}`, infoBarX + sp.md, infoBarY + infoBarH / 2, { fontSize: fs.md, fontWeight: '600', color: THEME.textPrimary, baseline: 'middle' })
    drawText(ctx, `正确: ${this.correct}`, infoBarX + infoBarW / 2, infoBarY + infoBarH / 2, { fontSize: fs.sm, color: '#00B894', align: 'center', baseline: 'middle' })
    drawText(ctx, formatTime(this.elapsedTime), infoBarX + infoBarW - sp.md, infoBarY + infoBarH / 2, { fontSize: fs.sm, color: THEME.textSecondary, align: 'right', baseline: 'middle' })

    const gridPadX = sp.xl; const gridTopY = infoBarY + infoBarH + sp.lg; const gridBottomY = THEME.screenHeight - THEME.tabBarHeight - sp.md
    const availableHeight = gridBottomY - gridTopY
    const q = this.currentQuestion
    const centerY = gridTopY + availableHeight * 0.25
    const wordSize = Math.min(100 * THEME.rpx, sw * 0.2)
    ctx.font = `700 ${wordSize}px ${THEME.fontFamily}`; ctx.fillStyle = q.displayColor; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(q.word, sw / 2, centerY)

    const options = q.options; const cols = options.length <= 4 ? 2 : 3; const optGap = sp.md
    const optW = (sw - gridPadX * 2 - (cols - 1) * optGap) / cols; const optH = 90 * THEME.rpx
    const rows = Math.ceil(options.length / cols); const totalOptH = rows * optH + (rows - 1) * optGap
    const startX = gridPadX; const startY = centerY + wordSize / 2 + sp.xl
    const optAreaBottom = Math.min(startY + totalOptH, gridBottomY); const optAreaTop = optAreaBottom - totalOptH
    const now = Date.now()
    this._optionRects = []
    for (let i = 0; i < options.length; i++) {
      const row = Math.floor(i / cols); const col = i % cols
      const ox = startX + col * (optW + optGap); const oy = optAreaTop + row * (optH + optGap)
      const color = COLORS.find(c => c.name === options[i])
      const isSelected = this._selectedOption === i && now - this._selectedTime < 200
      let offsetX = 0
      if (isSelected && !this._selectedOk) offsetX = Math.sin((now - this._selectedTime) / 30 * Math.PI) * 5
      fillRoundedRect(ctx, ox + offsetX, oy, optW, optH, THEME.btnRadius, skin.option && skin.option.bg || THEME.cardBg)
      strokeRoundedRect(ctx, ox + offsetX, oy, optW, optH, THEME.btnRadius, skin.option && skin.option.border || THEME.cardBorder, 1)
      const dotR = Math.min(14 * THEME.rpx, optH * 0.15)
      fillCircle(ctx, ox + offsetX + dotR + sp.md, oy + optH / 2, dotR, color ? color.value : THEME.textPrimary)
      drawText(ctx, options[i], ox + offsetX + dotR * 2 + sp.lg, oy + optH / 2, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary, baseline: 'middle' })
      this._optionRects.push({ x: ox, y: oy, w: optW, h: optH, name: options[i] })
    }
    if (this._selectedOption >= 0 && now - this._selectedTime > 200) this._selectedOption = -1
  }

  _renderFinished(ctx) {
    const sp = THEME.spacing; const fs = THEME.fontSize
    this._renderFinishedScreen(ctx, {
      cardH: 180 * THEME.rpx,
      renderStats: (ctx, cx, y) => {
        drawCenteredText(ctx, `正确率: ${this.total > 0 ? Math.round(this.correct / this.total * 100) : 0}%`, cx, y + sp.lg, { fontSize: fs.lg, fontWeight: '700', color: THEME.textPrimary })
        drawCenteredText(ctx, `${this.correct}/${this.total}  |  用时: ${formatTime(this.elapsedTime)}`, cx, y + sp.lg + fs.lg + sp.md, { fontSize: fs.sm, color: THEME.textSecondary })
      }
    })
  }
}

function formatTime(ms) { const s = Math.floor(ms / 1000); const m = Math.floor(s / 60); return `${m}:${String(s % 60).padStart(2, '0')}.${String(Math.floor((ms % 1000) / 10)).padStart(2, '0')}` }

module.exports = StroopScene
