/**
 * 闪电扫视游戏场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { vibrate } = require('../utils/util')
const { calcRankPoints } = require('../utils/scoring')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, fillShadowRoundedRect } = require('../base/draw-utils')
const { hitTestGrid } = require('../base/ui/grid')
const app = require('../app')

class ScanScene extends Scene {
  constructor(params) {
    super(params)
    this._gameKey = 'scan'
    this.level = (params && params.level) || 16
    this.timeLimit = 12
    this.grid = []
    this.targets = []
    this.currentTargetIndex = 0
    this.found = 0
    this.remainingTime = 0
    this.startTime = 0
    this._timer = null
    this._cellRects = []
    this._tappedIdx = -1
    this._tappedTime = 0
    this._tappedOk = false
  }

  onEnter() {
    this._initSkin()
    this.level = this.params.level || 16
    this._setTimeLimit()
    this.initGame()
    this._checkGuide()
  }

  onExit() { this._stopTimer() }

  onPause() {
    if (this.gameState === 'playing') {
      this._stopTimer()
      this.gameState = 'paused'
    }
  }

  onResume() {
    if (this.gameState === 'paused') {
      this.gameState = 'playing'
      this._startTimer()
    }
  }

  _setTimeLimit() {
    const limits = { 16: 12, 25: 15, 36: 20, 49: 28, 64: 40 }
    this.timeLimit = limits[this.level] || 15
  }

  initGame() {
    this.grid = []; this.targets = []; this.currentTargetIndex = 0; this.found = 0
    this.remainingTime = this.timeLimit; this.resetGameState()
    for (let i = 1; i <= this.level; i++) this.grid.push(i)
    for (let i = this.grid.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.grid[i], this.grid[j]] = [this.grid[j], this.grid[i]] }
    this.targets = []; for (let i = 1; i <= this.level; i++) this.targets.push(i)
    for (let i = this.targets.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [this.targets[i], this.targets[j]] = [this.targets[j], this.targets[i]] }
  }

  _startGame() { this.gameState = 'playing'; this._startTimer() }

  _startTimer() {
    this.startTime = Date.now() - (this.timeLimit - this.remainingTime) * 1000
    this._timer = setInterval(() => {
      const elapsed = (Date.now() - this.startTime) / 1000
      this.remainingTime = Math.max(0, this.timeLimit - elapsed)
      if (this.remainingTime <= 3 && this.remainingTime > 0 && Math.abs(this.remainingTime % 1) < 0.06 && GameGlobal.audio) GameGlobal.audio.playSFX('countdown')
      if (this.remainingTime <= 0) this._gameFinished()
    }, 50)
  }

  _stopTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null } }
  _stopAllTimers() { this._stopTimer() }

  onTouchStart(x, y) {
    if (this._handleOverlayTouch(x, y)) return
    if (this.gameState === 'ready') {
      if (this._handleReadyTouch(x, y, (lv) => { this.level = lv; this._setTimeLimit(); this.initGame() })) return
    }
    if (this.gameState === 'playing') {
      const idx = hitTestGrid(x, y, this._cellRects)
      if (idx >= 0) this._tapCell(idx)
    }
    if (this.gameState === 'finished') {
      if (this._handleFinishedTouch(x, y)) return
    }
  }

  _tapCell(idx) {
    const num = this.grid[idx]; const target = this.targets[this.currentTargetIndex]
    this._tappedIdx = idx; this._tappedTime = Date.now()
    if (num === target) {
      vibrate('light'); this._tappedOk = true
      this.grid[idx] = -num; this.found++; this.currentTargetIndex++
      if (this.found >= this.level) this._gameFinished()
    } else {
      vibrate('heavy'); this._tappedOk = false
    }
  }

  _gameFinished() {
    this._stopTimer()
    const accuracy = this.level > 0 ? (this.found / this.level * 100) : 0
    const completed = this.found >= this.level
    if (completed) {
      const elapsed = this.timeLimit - this.remainingTime
      const thresholds = { 16: [4, 7, 10, 14], 25: [5, 9, 14, 18], 36: [7, 12, 18, 25], 49: [11, 18, 26, 36], 64: [15, 24, 36, 48] }
      const t = thresholds[this.level] || thresholds[25]
      if (elapsed <= t[0]) { this.rating = 'S'; this.ratingLabel = '闪电速度' }
      else if (elapsed <= t[1]) { this.rating = 'A'; this.ratingLabel = '非常优秀' }
      else if (elapsed <= t[2]) { this.rating = 'B'; this.ratingLabel = '表现不错' }
      else if (elapsed <= t[3]) { this.rating = 'C'; this.ratingLabel = '继续加油' }
      else { this.rating = 'D'; this.ratingLabel = '继续努力' }
    } else {
      if (accuracy >= 90) { this.rating = 'B'; this.ratingLabel = '差一点点' }
      else if (accuracy >= 70) { this.rating = 'C'; this.ratingLabel = '继续加油' }
      else { this.rating = 'D'; this.ratingLabel = '继续努力' }
    }
    this.ratingColor = THEME.ratingColors[this.rating]
    this.isNewRecord = app.updateBestScore('scan', this.level, this.found)
    this.earnedPoints = calcRankPoints('scan', this.level, this.rating)
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
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    const gridInfo = { 16: '4×4', 25: '5×5', 36: '6×6', 49: '7×7', 64: '8×8' }
    this._renderReadyScreen(ctx, {
      icon: '👁️', title: '闪电扫视',
      subtitle: `${this.level}个数字 (${gridInfo[this.level]}) · ${this.timeLimit}秒`,
      levels: [16, 25, 36, 49, 64], currentLevel: this.level,
      levelBtnW: 80 * THEME.rpx, levelBtnH: 60 * THEME.rpx
    })
  }

  _renderPlaying(ctx) {
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    const skin = this.currentSkin || {}
    const timeColor = this.remainingTime <= 3 ? '#FF6B6B' : THEME.textPrimary
    drawCenteredText(ctx, `${Math.ceil(this.remainingTime)}`, sw / 2, this._contentTop + sp.sm, { fontSize: THEME.fontSize.xl, fontWeight: '700', color: timeColor })
    const target = this.targets[this.currentTargetIndex]
    const targetBaseY = this._contentTop + 55 * THEME.rpx
    if (target) {
      const targetW = 200 * THEME.rpx; const targetH = 60 * THEME.rpx
      fillRoundedRect(ctx, (sw - targetW) / 2, targetBaseY, targetW, targetH, THEME.btnRadius, 'rgba(192,122,69,0.18)')
      strokeRoundedRect(ctx, (sw - targetW) / 2, targetBaseY, targetW, targetH, THEME.btnRadius, 'rgba(192,122,69,0.35)', 1)
      drawCenteredText(ctx, `找: ${target}`, sw / 2, targetBaseY + targetH / 2, { fontSize: fs.lg, fontWeight: '700', color: THEME.textAccent, baseline: 'middle' })
    }
    drawText(ctx, `${this.found}/${this.level}`, sp.lg, targetBaseY + 70 * THEME.rpx, { fontSize: fs.sm, color: THEME.textSecondary })

    const cols = Math.sqrt(this.level)
    const gridPadX = sp.xl; const gridGap = 8 * THEME.rpx; const gridTopY = targetBaseY + 90 * THEME.rpx
    const cellSize = (sw - gridPadX * 2 - (cols - 1) * gridGap) / cols
    const totalGridH = cols * cellSize + (cols - 1) * gridGap
    const gridBottomY = THEME.screenHeight - THEME.tabBarHeight - sp.md
    const availableHeight = gridBottomY - gridTopY
    const gridStartY = gridTopY + Math.max(0, (availableHeight - totalGridH) / 2)

    this._cellRects = []
    for (let i = 0; i < this.level; i++) {
      const row = Math.floor(i / cols); const col = i % cols
      const x = gridPadX + col * (cellSize + gridGap); const y = gridStartY + row * (cellSize + gridGap)
      this._cellRects.push({ x, y, width: cellSize, height: cellSize })
    }

    const now = Date.now(); const cellColors = skin.cell || {}
    for (let i = 0; i < this._cellRects.length; i++) {
      const pos = this._cellRects[i]; const num = this.grid[i]; const found = num < 0; const absNum = Math.abs(num)
      let offsetX = 0
      if (this._tappedIdx === i && now - this._tappedTime < 200) {
        if (!this._tappedOk) offsetX = Math.sin((now - this._tappedTime) / 30 * Math.PI) * 5
      }
      const cc = found ? (cellColors.found || { bg: 'rgba(0,184,148,0.15)', border: 'rgba(0,184,148,0.3)', text: '#00B894' }) : (cellColors.default || { bg: THEME.cardBg, border: THEME.cardBorder, text: THEME.textPrimary })
      fillRoundedRect(ctx, pos.x + offsetX, pos.y, pos.width, pos.height, THEME.btnRadius, cc.bg)
      strokeRoundedRect(ctx, pos.x + offsetX, pos.y, pos.width, pos.height, THEME.btnRadius, cc.border, 1)
      const fontSize = Math.max(fs.sm, cellSize * 0.35)
      ctx.font = `600 ${fontSize}px ${THEME.fontFamily}`; ctx.fillStyle = cc.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(String(absNum), pos.x + offsetX + pos.width / 2, pos.y + pos.height / 2)
      if (found) {
        ctx.beginPath(); ctx.moveTo(pos.x + pos.width * 0.2, pos.y + pos.height / 2); ctx.lineTo(pos.x + pos.width * 0.8, pos.y + pos.height / 2)
        ctx.strokeStyle = (cellColors.found || {}).text || '#00B894'; ctx.lineWidth = 2; ctx.stroke()
      }
    }
    if (this._tappedIdx >= 0 && now - this._tappedTime > 200) this._tappedIdx = -1
  }

  _renderFinished(ctx) {
    const sp = THEME.spacing; const fs = THEME.fontSize
    this._renderFinishedScreen(ctx, {
      cardH: 140 * THEME.rpx,
      renderStats: (ctx, cx, y) => {
        drawCenteredText(ctx, `找到: ${this.found}/${this.level}`, cx, y + sp.lg, { fontSize: fs.lg, fontWeight: '700', color: THEME.textPrimary })
      }
    })
  }
}

module.exports = ScanScene
