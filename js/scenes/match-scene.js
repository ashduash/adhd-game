/**
 * 色彩消除游戏场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { vibrate } = require('../utils/util')
const { getMatchRating } = require('../utils/scoring')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, roundedRect, fillShadowRoundedRect } = require('../base/draw-utils')
const { getGameSkin } = require('../utils/skins')
const app = require('../app')

const COLORS = ['#C07A70', '#7BA5A0', '#7BAE7F', '#D4A574', '#9B8EC4', '#D4915C', '#9CC5C0']

class MatchScene extends Scene {
  constructor(params) {
    super(params)
    this._gameKey = 'match'
    this.gridSize = (params && params.level) || 5
    this.grid = []
    this.selected = null
    this.score = 0
    this.combo = 0
    this.maxCombo = 0
    this.remainingTime = 0
    this._timer = null
    this._cellRects = []
    this._matchedCells = []
    this._matchedTime = 0
    this._deadlock = false
    this._deadlockTimer = null
  }

  onEnter() {
    this._initSkin()
    this.gridSize = this.params.level || 5
    this.initGame()
    this._checkGuide()
  }

  onExit() { this._stopTimer(); if (this._deadlockTimer) { clearTimeout(this._deadlockTimer); this._deadlockTimer = null } }

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

  initGame() {
    this.grid = []; this.selected = null; this.score = 0; this.combo = 0; this.maxCombo = 0; this._deadlock = false; this._shuffleUsed = false; if (this._deadlockTimer) { clearTimeout(this._deadlockTimer); this._deadlockTimer = null }
    const timeMap = { 4: 60, 5: 80, 6: 100, 7: 130, 8: 180 }
    this.remainingTime = timeMap[this.gridSize] || 80
    this.resetGameState()
    for (let r = 0; r < this.gridSize; r++) {
      this.grid[r] = []
      for (let c = 0; c < this.gridSize; c++) {
        this.grid[r][c] = Math.floor(Math.random() * Math.min(7, COLORS.length))
      }
    }
  }

  _startGame() { this.gameState = 'playing'; this._startTimer() }
  _startTimer() { this._timer = setInterval(() => { this.remainingTime -= 0.1; if (this.remainingTime <= 0) this._gameFinished() }, 100) }
  _stopTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null } }
  _stopAllTimers() { this._stopTimer(); if (this._deadlockTimer) { clearTimeout(this._deadlockTimer); this._deadlockTimer = null } }

  onTouchStart(x, y) {
    if (this._handleOverlayTouch(x, y)) return
    if (this.gameState === 'ready') {
      if (this._handleReadyTouch(x, y, (lv) => { this.gridSize = lv; this.initGame() })) return
    }
    if (this.gameState === 'playing') {
      for (let i = 0; i < this._cellRects.length; i++) {
        const cr = this._cellRects[i]
        if (this._hit(x, y, cr)) { this._tapCell(cr.row, cr.col); return }
      }
    }
    if (this.gameState === 'finished') {
      if (this._handleFinishedTouch(x, y)) return
    }
  }

  _tapCell(row, col) {
    if (row < 0 || row >= this.gridSize || col < 0 || col >= this.gridSize) return
    if (this.grid[row][col] === -1) return

    if (!this.selected) {
      this.selected = { row, col }
    } else {
      const sr = this.selected.row; const sc = this.selected.col
      const isAdjacent = Math.abs(sr - row) + Math.abs(sc - col) === 1
      const sameColor = this.grid[sr][sc] === this.grid[row][col]
      if (isAdjacent && sameColor) {
        vibrate('light')
        this._matchedCells = [{ r: sr, c: sc }, { r: row, c: col }]
        this._matchedTime = Date.now()
        this.grid[sr][sc] = -1; this.grid[row][col] = -1
        this.score += 10 + this.combo * 2; this.combo++; if (this.combo > this.maxCombo) this.maxCombo = this.combo; if (this.combo >= 2 && GameGlobal.audio) GameGlobal.audio.playSFX('combo')
        this._applyGravity()
      } else {
        vibrate('heavy'); this.combo = 0
      }
      this.selected = null
    }
  }

  _applyGravity() {
    for (let c = 0; c < this.gridSize; c++) {
      let writeRow = this.gridSize - 1
      for (let r = this.gridSize - 1; r >= 0; r--) {
        if (this.grid[r][c] !== -1) {
          this.grid[writeRow][c] = this.grid[r][c]
          if (writeRow !== r) this.grid[r][c] = -1
          writeRow--
        }
      }
      for (let r = writeRow; r >= 0; r--) {
        this.grid[r][c] = Math.floor(Math.random() * Math.min(7, COLORS.length))
      }
    }
    if (!this._hasValidMoves()) {
      if (!this._shuffleUsed) {
        // 给一次免费洗牌机会
        this._shuffleUsed = true
        this._shuffleBoard()
        GameGlobal.toast.show('棋盘已重排')
        // 重排后再次检查（极小概率仍然无解）
        if (!this._hasValidMoves()) {
          this._deadlock = true
          this._deadlockTimer = setTimeout(() => this._gameFinished(), 500)
        }
      } else {
        this._deadlock = true
        GameGlobal.toast.show('没有可消除的方块了')
        this._deadlockTimer = setTimeout(() => this._gameFinished(), 500)
      }
    }
  }

  _hasValidMoves() {
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const val = this.grid[r][c]
        if (val === -1) continue
        if (r + 1 < this.gridSize && this.grid[r + 1][c] === val) return true
        if (c + 1 < this.gridSize && this.grid[r][c + 1] === val) return true
      }
    }
    return false
  }

  _shuffleBoard() {
    // 收集所有非空格子的颜色
    const colors = []
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c] !== -1) colors.push(this.grid[r][c])
      }
    }
    // Fisher-Yates 洗牌
    for (let i = colors.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));[colors[i], colors[j]] = [colors[j], colors[i]]
    }
    // 重新填入
    let idx = 0
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        if (this.grid[r][c] !== -1) this.grid[r][c] = colors[idx++]
      }
    }
  }

  _gameFinished() {
    if (this.gameState === 'finished') return
    this._stopTimer(); if (this._deadlockTimer) { clearTimeout(this._deadlockTimer); this._deadlockTimer = null }
    const rating = getMatchRating(this.score, this.gridSize)
    const ratingLabel = this._deadlock ? '无可用步数' : undefined
    this._finishGameWithRating({ rating, ratingLabel, gameMode: 'match', level: this.gridSize, score: this.score })
  }

  onRender(ctx) {
    this.renderBackButton(ctx)
    if (this.showGuide || this.showRules || this.showSkinPicker) return

    if (this.gameState === 'ready') {
      this._renderReady(ctx)
    } else if (this.gameState === 'playing') {
      this._renderPlaying(ctx)
    } else if (this.gameState === 'finished') {
      this._renderFinished(ctx)
    }
  }

  _renderReady(ctx) {
    const sw = THEME.screenWidth
    const self = this
    this._renderReadyScreen(ctx, {
      icon: '🌈', title: '色彩消除', subtitle: '消除相邻同色方块',
      levelLabel: '选择网格大小', levels: [4, 5, 6, 7, 8], currentLevel: this.gridSize,
      levelFormatter: (lv) => `${lv}×${lv}`,
      levelBtnW: 80 * THEME.rpx, levelBtnH: 60 * THEME.rpx,
      renderExtra: null
    })
  }

  _renderPlaying(ctx) {
    const skin = this.currentSkin || {}
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    const infoBarY = this._contentTop; const infoBarH = 60 * THEME.rpx; const infoBarX = sp.xl; const infoBarW = sw - sp.xl * 2
    fillRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, 'rgba(255,255,255,0.06)')
    strokeRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, 'rgba(255,255,255,0.1)', 1)
    drawText(ctx, `${Math.ceil(this.remainingTime)}s`, infoBarX + sp.md, infoBarY + infoBarH / 2, { fontSize: fs.xl, fontWeight: '700', color: this.remainingTime <= 10 ? '#FF6B6B' : THEME.textPrimary, baseline: 'middle' })
    drawText(ctx, `分数: ${this.score}`, infoBarX + infoBarW / 2, infoBarY + infoBarH / 2, { fontSize: fs.md, fontWeight: '600', color: THEME.textPrimary, align: 'center', baseline: 'middle' })
    if (this.combo >= 2) drawText(ctx, `${this.combo}连击！`, infoBarX + infoBarW - sp.md, infoBarY + infoBarH / 2, { fontSize: fs.md, fontWeight: '600', color: '#FFD700', align: 'right', baseline: 'middle' })
    const gridY = infoBarY + infoBarH + sp.md
    const pad = sp.xl; const gridW = sw - pad * 2
    const cellGap = 8 * THEME.rpx
    const cellSize = (gridW - cellGap * (this.gridSize - 1)) / this.gridSize
    this._cellRects = []
    for (let r = 0; r < this.gridSize; r++) {
      for (let c = 0; c < this.gridSize; c++) {
        const cx = pad + c * (cellSize + cellGap); const cy = gridY + r * (cellSize + cellGap)
        const colorIdx = this.grid[r][c]
        const isSelected = this.selected && this.selected.row === r && this.selected.col === c
        if (colorIdx >= 0) {
          const blockColors = skin.blocks || COLORS
          const color = blockColors[colorIdx] || COLORS[colorIdx % COLORS.length]
          fillRoundedRect(ctx, cx, cy, cellSize, cellSize, THEME.btnRadius, color)
          if (isSelected) {
            ctx.strokeStyle = skin.selectedBorder || THEME.textPrimary; ctx.lineWidth = 3
            roundedRect(ctx, cx, cy, cellSize, cellSize, THEME.btnRadius); ctx.stroke()
          }
        }
        this._cellRects.push({ x: cx, y: cy, w: cellSize, h: cellSize, row: r, col: c })
      }
    }
  }

  _renderFinished(ctx) {
    const fs = THEME.fontSize; const sp = THEME.spacing
    this._renderFinishedScreen(ctx, {
      cardH: 140 * THEME.rpx,
      renderStats: (ctx, cx, y) => {
        drawCenteredText(ctx, `分数: ${this.score}`, cx, y + sp.lg, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary })
        drawCenteredText(ctx, `最大连击: ${this.maxCombo}`, cx, y + sp.lg + fs.xl + sp.md, { fontSize: fs.sm, color: THEME.textSecondary })
      }
    })
  }
}

module.exports = MatchScene
