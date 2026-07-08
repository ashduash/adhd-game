/**
 * 序列排序游戏场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { generateRandomSequence, vibrate, formatTime } = require('../utils/util')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect } = require('../base/draw-utils')
const { hitTestGrid } = require('../base/ui/grid')
const app = require('../app')

class SortScene extends Scene {
  constructor(params) {
    super(params)
    this._gameKey = 'sort'
    this.level = (params && params.level) || 6
    this.numbers = []
    this.nextNumber = 0
    this.errors = 0
    this.startTime = 0
    this.elapsedTime = 0
    this._cellRects = []
    this._tappedIndex = -1
    this._tappedTime = 0
    this._tappedOk = false
    this._timer = null
    this._finishTimer = null
  }

  onEnter() {
    this._initSkin()
    this.level = this.params.level || 9
    // 防御：sort 仅支持完全平方数网格，非合法档时收敛到最近合法档
    const SORT_LEVELS = [9, 16, 25, 36]
    if (!SORT_LEVELS.includes(this.level)) {
      this.level = SORT_LEVELS.reduce((p, c) => Math.abs(c - this.level) < Math.abs(p - this.level) ? c : p, SORT_LEVELS[0])
    }
    this.initGame()
    this._checkGuide()
  }

  onExit() { this._stopTimer(); if (this._finishTimer) { clearTimeout(this._finishTimer); this._finishTimer = null } }

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
    const max = this.level >= 25 ? 200 : 99
    this.numbers = generateRandomSequence(this.level, max)
    const sorted = [...this.numbers].sort((a, b) => a - b)
    this.nextNumber = sorted[0]; this.sortedNumbers = sorted; this.currentIndex = 0
    this.errors = 0; this.elapsedTime = 0; this.resetGameState(); this._tappedIndex = -1
  }

  _startGame() { this.gameState = 'playing'; this._startTimer() }

  _startTimer() { this.startTime = Date.now() - this.elapsedTime; this._timer = setInterval(() => { this.elapsedTime = Date.now() - this.startTime }, 10) }
  _stopTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null } }
  _stopAllTimers() { this._stopTimer(); if (this._finishTimer) { clearTimeout(this._finishTimer); this._finishTimer = null } }

  onTouchStart(x, y) {
    if (this._handleOverlayTouch(x, y)) return
    if (this.gameState === 'ready') {
      if (this._handleReadyTouch(x, y, (lv) => { this.level = lv; this.initGame() })) return
    }
    if (this.gameState === 'playing') {
      const idx = hitTestGrid(x, y, this._cellRects)
      if (idx >= 0) this._tapCell(idx)
    }
    if (this.gameState === 'finished') {
      const nextLevelMap = { 9: 16, 16: 25, 25: 36 }
      if (this._handleFinishedTouch(x, y, () => { this.level = nextLevelMap[this.level] || this.level; this.initGame() })) return
    }
  }

  _tapCell(idx) {
    const num = this.numbers[idx]
    if (num === undefined) return
    this._tappedIndex = idx; this._tappedTime = Date.now()
    if (num === this.sortedNumbers[this.currentIndex]) {
      vibrate('light'); this._tappedOk = true
      this.numbers[idx] = null; this.currentIndex++
      if (this.currentIndex >= this.sortedNumbers.length) {
        this._finishTimer = setTimeout(() => this._gameFinished(), 100)
      }
    } else {
      vibrate('heavy'); this._tappedOk = false; this.errors++
    }
  }

  _gameFinished() {
    this._stopTimer()
    // 每次失误加 2 秒惩罚时间
    const penaltyMs = this.errors * 2000
    const effectiveTime = this.elapsedTime + penaltyMs
    const sec = effectiveTime / 1000
    const thresholds = { 9: [4, 8, 15, 26], 16: [7, 15, 28, 48], 25: [13, 26, 45, 75], 36: [21, 42, 72, 115] }
    const t = thresholds[this.level] || thresholds[9]
    let rating
    if (sec <= t[0]) rating = 'S'
    else if (sec <= t[1]) rating = 'A'
    else if (sec <= t[2]) rating = 'B'
    else if (sec <= t[3]) rating = 'C'
    else rating = 'D'
    this._finishGameWithRating({ rating, gameMode: 'sort', level: this.level, score: this.elapsedTime })
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
    const gridInfo = { 9: '3×3', 16: '4×4', 25: '5×5', 36: '6×6' }
    this._renderReadyScreen(ctx, {
      icon: '📊', title: '序列排序',
      subtitle: `${this.level}项排序 (${gridInfo[this.level]})`,
      levels: [9, 16, 25, 36], currentLevel: this.level,
      levelBtnW: 80 * THEME.rpx, levelBtnH: 70 * THEME.rpx
    })
  }

  _renderPlaying(ctx) {
    const skin = this.currentSkin || {}
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize

    const timeColor = this.elapsedTime / 1000 > 60 ? '#FF6B6B' : THEME.textPrimary
    drawCenteredText(ctx, formatTime(this.elapsedTime), sw / 2, this._contentTop + sp.sm, { fontSize: THEME.fontSize.xl, fontWeight: '700', color: timeColor })

    const nextNum = this.sortedNumbers[this.currentIndex]
    const targetBaseY = this._contentTop + 55 * THEME.rpx
    if (nextNum !== undefined) {
      const targetW = 200 * THEME.rpx; const targetH = 60 * THEME.rpx
      fillRoundedRect(ctx, (sw - targetW) / 2, targetBaseY, targetW, targetH, THEME.btnRadius, 'rgba(192,122,69,0.18)')
      strokeRoundedRect(ctx, (sw - targetW) / 2, targetBaseY, targetW, targetH, THEME.btnRadius, 'rgba(192,122,69,0.35)', 1)
      drawCenteredText(ctx, `找: ${nextNum}`, sw / 2, targetBaseY + targetH / 2, { fontSize: fs.lg, fontWeight: '700', color: THEME.textAccent, baseline: 'middle' })
    }
    drawText(ctx, `${this.currentIndex}/${this.level}`, sp.lg, targetBaseY + 70 * THEME.rpx, { fontSize: fs.sm, color: THEME.textSecondary })

    const cols = Math.sqrt(this.level); const gridPadX = sp.xl; const gridGap = 8 * THEME.rpx; const gridTopY = targetBaseY + 90 * THEME.rpx
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
      const pos = this._cellRects[i]; const num = this.numbers[i]
      let offsetX = 0; let scale = 1
      if (this._tappedIndex === i && now - this._tappedTime < 200) {
        if (this._tappedOk) { const t = (now - this._tappedTime) / 200; scale = 0.85 + 0.3 * Math.sin(t * Math.PI) }
        else { offsetX = Math.sin((now - this._tappedTime) / 30 * Math.PI) * 6 }
      }
      const cellCx = pos.x + pos.width / 2 + offsetX; const cellCy = pos.y + pos.height / 2
      ctx.save(); ctx.translate(cellCx, cellCy); ctx.scale(scale, scale); ctx.translate(-cellCx, -cellCy)
      if (num === null) {
        const doneColors = cellColors.done || { bg: 'rgba(0,184,148,0.15)', border: 'rgba(0,184,148,0.3)', text: '#00B894' }
        fillRoundedRect(ctx, pos.x + offsetX, pos.y, pos.width, pos.height, THEME.btnRadius, doneColors.bg)
        strokeRoundedRect(ctx, pos.x + offsetX, pos.y, pos.width, pos.height, THEME.btnRadius, doneColors.border, 1)
        drawCenteredText(ctx, '✓', pos.x + offsetX + pos.width / 2, pos.y + pos.height / 2, { fontSize: fs.lg, color: doneColors.text, baseline: 'middle' })
      } else {
        const defaultColors = cellColors.default || { bg: THEME.cardBg, border: THEME.cardBorder, text: THEME.textPrimary }
        fillRoundedRect(ctx, pos.x + offsetX, pos.y, pos.width, pos.height, THEME.btnRadius, defaultColors.bg)
        strokeRoundedRect(ctx, pos.x + offsetX, pos.y, pos.width, pos.height, THEME.btnRadius, defaultColors.border, 1)
        const fontSize = Math.max(fs.sm, cellSize * 0.35)
        ctx.font = `600 ${fontSize}px ${THEME.fontFamily}`; ctx.fillStyle = defaultColors.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText(String(num), pos.x + offsetX + pos.width / 2, pos.y + pos.height / 2)
      }
      ctx.restore()
    }
    if (this._tappedIndex >= 0 && now - this._tappedTime > 200) this._tappedIndex = -1
  }

  _renderFinished(ctx) {
    const sp = THEME.spacing; const fs = THEME.fontSize
    const nextLevelMap = { 9: 16, 16: 25, 25: 36 }
    const nextLevel = nextLevelMap[this.level]
    this._renderFinishedScreen(ctx, {
      cardH: 160 * THEME.rpx,
      hasNextLevel: !!nextLevel,
      nextLevelLabel: nextLevel ? `下一难度 (${nextLevel}项)` : '',
      renderStats: (ctx, cx, y) => {
        drawCenteredText(ctx, '用时', cx, y + sp.lg, { fontSize: fs.sm, color: THEME.textSecondary })
        drawCenteredText(ctx, formatTime(this.elapsedTime), cx, y + sp.lg + fs.sm + sp.xs, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary })
      }
    })
  }
}

module.exports = SortScene
