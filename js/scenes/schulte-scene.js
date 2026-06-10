/**
 * 舒尔特方格游戏场景 - Canvas 绘制版本
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { formatTime, shuffleArray, calculateRating, vibrate } = require('../utils/util')
const { getCellColors } = require('../utils/skins')
const { calcRankPoints } = require('../utils/scoring')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, drawGlowArc, fillShadowRoundedRect } = require('../base/draw-utils')
const { calculateGridPositions, hitTestGrid } = require('../base/ui/grid')
const app = require('../app')

class SchulteScene extends Scene {
  constructor(params) {
    super(params)
    this._gameKey = 'schulte'
    this.level = (params && params.level) || 4
    this.grid = []
    this.nextNumber = 1
    this.totalNumbers = 16
    this.startTime = 0
    this.elapsedTime = 0
    this.hintMode = false
    this._cellRects = []
    this._tappedIndex = -1
    this._tappedTime = 0
    this._timer = null
    this._finishTimer = null
    this._hintBtnRect = null
    this._isDaily = params && params.daily
  }

  onEnter() {
    this._initSkin()
    this.level = this.params.level || 4
    this.initGame()
    this._checkGuide()
  }

  onExit() {
    this._stopTimer()
    if (this._finishTimer) { clearTimeout(this._finishTimer); this._finishTimer = null }
  }

  onPause() {
    if (this.gameState === 'playing') {
      this._stopTimer()
      this._savePausedState()
      this.gameState = 'paused'
    }
  }

  onResume() {
    if (this.gameState === 'paused') {
      wx.removeStorageSync('schulte_paused')
      this.gameState = 'playing'
      this._startTimer()
    }
  }

  initGame() {
    const totalNumbers = this.level * this.level
    const numbers = shuffleArray(totalNumbers)
    this.grid = numbers.map(num => ({ number: num, tapped: false, isNext: num === 1 }))
    this.totalNumbers = totalNumbers
    this.nextNumber = 1
    this.resetGameState()
    this.elapsedTime = 0
    this.rating = ''
    this.isNewRecord = false
    this._tappedIndex = -1
  }

  _startGame() { this.gameState = 'playing'; this._startTimer() }

  _startTimer() {
    this.startTime = Date.now() - this.elapsedTime
    this._timer = setInterval(() => { this.elapsedTime = Date.now() - this.startTime }, 10)
  }

  _stopTimer() { if (this._timer) { clearInterval(this._timer); this._timer = null } }
  _stopAllTimers() { this._stopTimer(); if (this._finishTimer) { clearTimeout(this._finishTimer); this._finishTimer = null } }

  _savePausedState() {
    wx.setStorageSync('schulte_paused', {
      level: this.level, grid: this.grid, nextNumber: this.nextNumber,
      totalNumbers: this.totalNumbers, elapsedTime: this.elapsedTime, hintMode: this.hintMode
    })
  }

  restart() { wx.removeStorageSync('schulte_paused'); this.initGame() }

  onTouchStart(x, y) {
    if (this._handleOverlayTouch(x, y)) return

    if (this.gameState === 'finished') {
      console.log('[Schulte] 结算页触摸:', Math.round(x), Math.round(y), 'scrollY:', Math.round(this.scrollY))
    }

    if (this.gameState === 'ready') {
      // 提示按钮
      if (this._hintBtnRect && this._hit(x, y, this._hintBtnRect)) { this.hintMode = !this.hintMode; return }
      if (this._handleReadyTouch(x, y, (lv) => { this.level = lv; this.initGame() })) return
    }

    if (this.gameState === 'playing') {
      const idx = hitTestGrid(x, y, this._cellRects)
      if (idx >= 0) this._tapCell(idx)
    }

    if (this.gameState === 'finished') {
      if (this._handleFinishedTouch(x, y, () => { this.level = Math.min(10, this.level + 1); this.initGame() })) return
    }
  }

  _tapCell(idx) {
    const cell = this.grid[idx]
    if (cell.tapped) return
    this._tappedIndex = idx
    this._tappedTime = Date.now()
    if (cell.number === this.nextNumber) {
      vibrate('light')
      cell.tapped = true
      this.grid.forEach(c => { if (c.number === this.nextNumber + 1) c.isNext = true })
      this.nextNumber++
      if (this.nextNumber > this.totalNumbers) {
        this._finishTimer = setTimeout(() => this._gameFinished(), 100)
      }
    } else {
      vibrate('heavy')
    }
  }

  _gameFinished() {
    this._stopTimer()
    wx.removeStorageSync('schulte_paused')
    const elapsedSeconds = this.elapsedTime / 1000
    const thresholds = {
      3: [6, 12, 20, 35], 4: [12, 24, 42, 70], 5: [24, 48, 78, 110],
      6: [42, 80, 130, 180], 7: [72, 144, 220, 320], 8: [108, 208, 340, 460],
      9: [150, 288, 450, 650], 10: [210, 400, 630, 900]
    }
    this.rating = calculateRating(elapsedSeconds, thresholds[this.level] || thresholds[4])
    this.ratingColor = THEME.ratingColors[this.rating] || '#ffffff'
    if (this.rating === 'S') this.ratingLabel = '完美'
    else if (this.rating === 'A') this.ratingLabel = '优秀'
    else if (this.rating === 'B') this.ratingLabel = '不错'
    else this.ratingLabel = '继续加油'
    this.isNewRecord = app.updateBestScore('schulte', this.level, this.elapsedTime)
    this.earnedPoints = calcRankPoints('schulte', this.level, this.rating)
    const rankResult = app.addRankPoints(this.earnedPoints)
    app.globalData.userData.totalGames++
    app.saveUserData(); app.syncScoreToCloud().catch(e => console.warn('分数同步失败:', e))
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
    const self = this
    this._renderReadyScreen(ctx, {
      icon: '⚡', title: '数字风暴', subtitle: `${this.level}×${this.level} 舒尔特方格`,
      levels: [3, 4, 5, 6, 7, 8, 9, 10], currentLevel: this.level,
      levelBtnW: 70 * THEME.rpx, levelBtnH: 70 * THEME.rpx,
      extraHeight: 50 * THEME.rpx + sp.lg,
      renderExtra: (ctx, y) => {
        const hintW = 200 * THEME.rpx; const hintH = 50 * THEME.rpx
        self._hintBtnRect = { x: (sw - hintW) / 2, y, w: hintW, h: hintH }
        fillRoundedRect(ctx, self._hintBtnRect.x, y, hintW, hintH, THEME.btnRadius, self.hintMode ? THEME.primary : THEME.btnSecondaryBg)
        drawCenteredText(ctx, self.hintMode ? '提示: 开' : '提示: 关', sw / 2, y + (hintH - fs.sm) / 2, { fontSize: fs.sm, fontWeight: '600', color: self.hintMode ? '#ffffff' : THEME.textSecondary })
        return y + hintH + sp.lg
      }
    })
  }

  _renderPlaying(ctx) {
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    const skin = this.currentSkin

    const infoBarY = this._contentTop; const infoBarH = 70 * THEME.rpx; const infoBarX = sp.lg; const infoBarW = sw - sp.lg * 2
    fillRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, THEME.cardBg)
    strokeRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, THEME.cardBorder, 1)
    drawText(ctx, `${this.level}×${this.level}`, infoBarX + sp.md, infoBarY + sp.md, { fontSize: fs.sm, color: THEME.textSecondary })

    const infoY = infoBarY + infoBarH + sp.md
    drawText(ctx, formatTime(this.elapsedTime), sp.lg, infoY, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary })
    drawText(ctx, `${this.nextNumber - 1}/${this.totalNumbers}`, sw - sp.lg, infoY, { fontSize: fs.md, color: THEME.textSecondary, align: 'right' })
    if (this.nextNumber <= this.totalNumbers) {
      drawText(ctx, `下一个: ${this.nextNumber}`, sp.lg, infoY + fs.xl + sp.xs, { fontSize: fs.sm, color: THEME.textAccent })
    }

    const gridPadX = sp.xl; const gridGap = 8 * THEME.rpx
    const gridTopY = infoY + fs.xl + fs.sm + sp.lg
    const cellSize = (sw - gridPadX * 2 - (this.level - 1) * gridGap) / this.level
    const totalGridH = this.level * cellSize + (this.level - 1) * gridGap
    const gridBottomY = THEME.screenHeight - THEME.tabBarHeight - sp.md
    const availableHeight = gridBottomY - gridTopY
    const gridStartY = gridTopY + Math.max(0, (availableHeight - totalGridH) / 2)
    const { positions } = calculateGridPositions(this.level, gridPadX, gridStartY, sw - gridPadX * 2, gridGap)
    this._cellRects = positions

    const now = Date.now()
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i]; const cell = this.grid[i]
      if (!cell) continue
      let state = 'default'
      if (cell.tapped) state = 'success'
      else if (this.hintMode && cell.isNext) state = 'active'
      let offsetX = 0
      if (this._tappedIndex === i && now - this._tappedTime < 200 && !cell.tapped) {
        offsetX = Math.sin((now - this._tappedTime) / 30 * Math.PI) * 5
      }
      const colors = getCellColors(skin, state)
      const cx = pos.x + offsetX; const cy = pos.y; const cr = THEME.btnRadius
      if (colors.bgGradient) {
        const g = ctx.createLinearGradient(cx, cy, cx, cy + pos.height)
        g.addColorStop(0, colors.bgGradient[0]); g.addColorStop(1, colors.bgGradient[1])
        fillRoundedRect(ctx, cx, cy, pos.width, pos.height, cr, g)
      } else {
        fillRoundedRect(ctx, cx, cy, pos.width, pos.height, cr, colors.bg)
      }
      strokeRoundedRect(ctx, cx, cy, pos.width, pos.height, cr, colors.border, 1)
      const fontSize = Math.max(fs.sm, pos.width * 0.35)
      ctx.font = `700 ${fontSize}px ${THEME.fontFamily}`; ctx.fillStyle = colors.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(cell.tapped ? '✓' : String(cell.number), cx + pos.width / 2, cy + pos.height / 2)
    }
    if (this._tappedIndex >= 0 && now - this._tappedTime > 200) this._tappedIndex = -1
  }

  _renderFinished(ctx) {
    const sp = THEME.spacing; const fs = THEME.fontSize
    this._renderFinishedScreen(ctx, {
      cardH: 200 * THEME.rpx,
      hasNextLevel: this.level < 10,
      nextLevelLabel: `下一难度 (${this.level + 1}×${this.level + 1})`,
      renderStats: (ctx, cx, y) => {
        drawCenteredText(ctx, '用时', cx, y + sp.lg, { fontSize: fs.sm, color: THEME.textSecondary })
        drawCenteredText(ctx, formatTime(this.elapsedTime), cx, y + sp.lg + fs.sm + sp.xs, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary })
      }
    })
  }
}

module.exports = SchulteScene
