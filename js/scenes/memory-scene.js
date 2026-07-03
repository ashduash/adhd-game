/**
 * 记忆还原游戏场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { vibrate } = require('../utils/util')
const { getMemoryRating } = require('../utils/scoring')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect } = require('../base/draw-utils')
const app = require('../app')

class MemoryScene extends Scene {
  constructor(params) {
    super(params)
    this._gameKey = 'memory'
    this.level = (params && params.level) || 6
    this.sequence = []
    this.showIndex = 0
    this.showTimer = null
    this.userInput = []
    this.currentInputSlot = 0
    this.inputStartTime = 0
    this.correct = 0
    this.total = 0
    this._inputRects = []
    this._checkAnswerTimer = null
    this._showDigit = ''
    this._showDigitAlpha = 0
    this._keyboardVisible = false
  }

  onEnter() {
    this._initSkin()
    this.level = this.params.level || 6
    this.initGame()
    this._checkGuide()
    this._bindKeyboardEvents()
  }

  onExit() { this._stopShow(); if (this._checkAnswerTimer) { clearTimeout(this._checkAnswerTimer); this._checkAnswerTimer = null } this._hideKeyboard(); this._unbindKeyboardEvents() }

  onPause() {
    if (this.gameState === 'showing') { this._stopShow(); this.gameState = 'paused_showing' }
    else if (this.gameState === 'input') { this.gameState = 'paused_input' }
  }

  onResume() {
    if (this.gameState === 'paused_showing') {
      this.gameState = 'showing'
      this._showNextDigit()
    } else if (this.gameState === 'paused_input') {
      this.gameState = 'input'
    }
  }

  initGame() {
    this.sequence = []; for (let i = 0; i < this.level; i++) this.sequence.push(Math.floor(Math.random() * 100))
    this.userInput = []; this.currentInputSlot = 0; this.correct = 0; this.total = 0
    this.resetGameState(); this._showDigit = ''; this._showDigitAlpha = 0
  }

  _startGame() { this._startShow() }
  _startShow() { this.gameState = 'showing'; this.showIndex = 0; this._showNextDigit() }

  _showNextDigit() {
    if (this.showIndex >= this.level) { this.gameState = 'input'; this.inputStartTime = Date.now(); this.userInput = new Array(this.level).fill(''); this.currentInputSlot = 0; return }
    this._showDigit = String(this.sequence[this.showIndex]).padStart(2, '0'); this._showDigitAlpha = 1
    this.showTimer = setTimeout(() => {
      this._showDigitAlpha = 0
      this.showTimer = setTimeout(() => { this.showIndex++; this._showNextDigit() }, 200)
    }, 600)
  }

  _stopShow() { if (this.showTimer) { clearTimeout(this.showTimer); this.showTimer = null } }
  _stopAllTimers() { this._stopShow() }

  _bindKeyboardEvents() {
    this._onKeyboardInput = (res) => {
      if (this.gameState !== 'input') return
      const value = res.value || ''
      if (this.currentInputSlot < this.level) {
        const digits = value.replace(/\D/g, '')
        if (digits.length > 0) this.userInput[this.currentInputSlot] = digits.slice(-2).padStart(2, '0')
      }
    }
    this._onKeyboardConfirm = (res) => {
      if (this.gameState !== 'input') return
      const value = res.value || ''
      if (this.currentInputSlot < this.level) {
        const digits = value.replace(/\D/g, '')
        if (digits.length > 0) this.userInput[this.currentInputSlot] = digits.slice(-2).padStart(2, '0')
        this.currentInputSlot++
        if (this.currentInputSlot >= this.level) {
          this._hideKeyboard()
          if (this._checkAnswerTimer) clearTimeout(this._checkAnswerTimer)
          this._checkAnswerTimer = setTimeout(() => { this._checkAnswerTimer = null; this._checkAnswer() }, 300)
        } else {
          wx.showKeyboard({ defaultValue: '', maxLength: 2, multiple: false, confirmHold: true, confirmType: 'next' })
        }
      }
    }
    this._onKeyboardComplete = () => { this._keyboardVisible = false }
    wx.onKeyboardInput(this._onKeyboardInput)
    wx.onKeyboardConfirm(this._onKeyboardConfirm)
    wx.onKeyboardComplete(this._onKeyboardComplete)
  }

  _unbindKeyboardEvents() {
    if (this._onKeyboardInput) wx.offKeyboardInput(this._onKeyboardInput)
    if (this._onKeyboardConfirm) wx.offKeyboardConfirm(this._onKeyboardConfirm)
    if (this._onKeyboardComplete) wx.offKeyboardComplete(this._onKeyboardComplete)
  }

  _showKeyboard() {
    if (this._keyboardVisible) return
    this._keyboardVisible = true
    wx.showKeyboard({ defaultValue: '', maxLength: 2, multiple: false, confirmHold: true, confirmType: 'done' })
  }

  _hideKeyboard() { if (!this._keyboardVisible) return; this._keyboardVisible = false; wx.hideKeyboard() }

  onTouchStart(x, y) {
    if (this._handleOverlayTouch(x, y)) return
    if (this.gameState === 'ready') {
      if (this._handleReadyTouch(x, y, (lv) => { this.level = lv; this.initGame() })) return
    }
    if (this.gameState === 'input') {
      for (let i = 0; i < this._inputRects.length; i++) {
        const r = this._inputRects[i]
        if (this._hit(x, y, r)) { this.currentInputSlot = i; this._showKeyboard(); return }
      }
      this._hideKeyboard()
    }
    if (this.gameState === 'finished') {
      const nextLevelMap = { 4: 6, 6: 8, 8: 10 }
      if (this._handleFinishedTouch(x, y, () => { this.level = nextLevelMap[this.level] || this.level; this.initGame() })) return
    }
  }

  _checkAnswer() {
    const inputTime = (Date.now() - this.inputStartTime) / 1000
    let correct = 0; let perfect = true
    for (let i = 0; i < this.level; i++) {
      const expected = String(this.sequence[i]).padStart(2, '0')
      const actual = this.userInput[i] || ''
      if (expected === actual) correct++; else perfect = false
    }
    this.correct = correct; this.total = this.level
    const accuracy = correct / this.level
    const rating = getMemoryRating(accuracy, perfect, inputTime, this.level)
    this._finishGameWithRating({ rating, gameMode: 'memory', level: this.level, score: correct })
  }

  onRender(ctx) {
    this.renderBackButton(ctx)
    if (this.showGuide || this.showRules || this.showSkinPicker) return
    if (this.gameState === 'ready') this._renderReady(ctx)
    else if (this.gameState === 'showing') this._renderShowing(ctx)
    else if (this.gameState === 'input') this._renderInput(ctx)
    else if (this.gameState === 'finished') this._renderFinished(ctx)
  }

  _renderReady(ctx) {
    this._renderReadyScreen(ctx, {
      icon: '🧠', title: '记忆还原', subtitle: `${this.level}个两位数字记忆`,
      levels: [4, 6, 8, 10], currentLevel: this.level,
      levelBtnW: 100 * THEME.rpx, levelBtnH: 60 * THEME.rpx
    })
  }

  _renderShowing(ctx) {
    const skin = this.currentSkin || {}
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    const infoBarY = this._contentTop; const infoBarH = 60 * THEME.rpx; const infoBarX = sp.lg; const infoBarW = sw - sp.lg * 2
    fillRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, THEME.cardBg)
    strokeRoundedRect(ctx, infoBarX, infoBarY, infoBarW, infoBarH, THEME.cardRadius, THEME.cardBorder, 1)
    drawCenteredText(ctx, `记忆中 ${this.showIndex + 1}/${this.level}`, sw / 2, infoBarY + infoBarH / 2, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary, baseline: 'middle' })
    if (this._showDigitAlpha > 0) {
      const digitY = infoBarY + infoBarH + (THEME.screenHeight - THEME.tabBarHeight - infoBarY - infoBarH) / 2
      const digitCardW = 200 * THEME.rpx; const digitCardH = 140 * THEME.rpx
      ctx.save(); ctx.globalAlpha = this._showDigitAlpha
      fillRoundedRect(ctx, sw / 2 - digitCardW / 2, digitY - digitCardH / 2, digitCardW, digitCardH, THEME.cardRadius, skin.digitBg || 'rgba(255,255,255,0.08)')
      ctx.font = `700 ${100 * THEME.rpx}px ${THEME.fontFamily}`; ctx.fillStyle = THEME.textPrimary; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(this._showDigit, sw / 2, digitY); ctx.restore()
    }
    const dotY = (THEME.screenHeight - THEME.tabBarHeight + infoBarY + infoBarH) / 2 + 80 * THEME.rpx; const dotGap = 16 * THEME.rpx; const dotW = this.level * dotGap
    let dx = (sw - dotW) / 2
    for (let i = 0; i < this.level; i++) {
      const done = i < this.showIndex; const active = i === this.showIndex
      fillRoundedRect(ctx, dx, dotY, 12 * THEME.rpx, 12 * THEME.rpx, 6 * THEME.rpx, done ? '#00B894' : active ? THEME.primaryLight : 'rgba(255,255,255,0.2)')
      dx += dotGap
    }
  }

  _renderInput(ctx) {
    const skin = this.currentSkin || {}
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize
    drawCenteredText(ctx, '点击输入框输入数字', sw / 2, this._contentTop + sp.md, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary })
    drawCenteredText(ctx, '共 ' + this.level + ' 个两位数', sw / 2, this._contentTop + sp.md + fs.lg + sp.xs, { fontSize: fs.sm, color: THEME.textSecondary })
    const slotW = 120 * THEME.rpx; const slotH = 100 * THEME.rpx; const slotGap = sp.md
    const maxSlotsPerRow = Math.floor((sw - sp.xl * 2 + slotGap) / (slotW + slotGap))
    const rows = Math.ceil(this.level / maxSlotsPerRow)
    const sy = this._contentTop + fs.lg + fs.sm + sp.xl
    this._inputRects = []
    for (let i = 0; i < this.level; i++) {
      const row = Math.floor(i / maxSlotsPerRow); const col = i % maxSlotsPerRow
      const slotsInRow = row < rows - 1 ? maxSlotsPerRow : this.level - row * maxSlotsPerRow
      const rowW = slotsInRow * slotW + (slotsInRow - 1) * slotGap
      const sx = (sw - rowW) / 2; const dx = sx + col * (slotW + slotGap); const dy = sy + row * (slotH + slotGap)
      const val = this.userInput[i] || ''; const active = i === this.currentInputSlot; const filled = val.length >= 2
      fillRoundedRect(ctx, dx, dy, slotW, slotH, THEME.cardRadius, active ? skin.slotActive || 'rgba(192,122,69,0.18)' : filled ? 'rgba(123,174,127,0.1)' : skin.slotBg || THEME.cardBg)
      strokeRoundedRect(ctx, dx, dy, slotW, slotH, THEME.cardRadius, active ? skin.slotActiveBorder || THEME.primary : filled ? '#00B894' : skin.slotBorder || THEME.cardBorder, active ? 2 : 1)
      drawCenteredText(ctx, String(i + 1), dx + slotW / 2, dy + sp.sm, { fontSize: fs.xs, color: THEME.textSecondary })
      if (val.length > 0) {
        drawCenteredText(ctx, val.padStart(2, '0'), dx + slotW / 2, dy + slotH / 2 + sp.sm, { fontSize: fs.title, fontWeight: '700', color: skin.slotFilledText || THEME.textPrimary, baseline: 'middle' })
      } else {
        drawCenteredText(ctx, '__', dx + slotW / 2, dy + slotH / 2 + sp.sm, { fontSize: fs.xxl, color: skin.slotText || 'rgba(255,255,255,0.2)', baseline: 'middle' })
      }
      this._inputRects.push({ x: dx, y: dy, w: slotW, h: slotH })
    }
    const progressY = sy + rows * (slotH + slotGap) + sp.xl
    const filledCount = this.userInput.filter(v => v && v.length >= 2).length
    drawCenteredText(ctx, `已输入 ${filledCount}/${this.level}`, sw / 2, progressY, { fontSize: fs.sm, color: THEME.textSecondary })
  }

  _renderFinished(ctx) {
    const sp = THEME.spacing; const fs = THEME.fontSize
    const nextLevelMap = { 4: 6, 6: 8, 8: 10 }
    const nextLv = nextLevelMap[this.level]
    this._renderFinishedScreen(ctx, {
      cardH: 160 * THEME.rpx,
      hasNextLevel: !!nextLv,
      nextLevelLabel: nextLv ? `下一难度 (${nextLv}个)` : '',
      renderStats: (ctx, cx, y) => {
        drawCenteredText(ctx, `正确: ${this.correct}/${this.total}`, cx, y + sp.lg, { fontSize: fs.lg, fontWeight: '700', color: THEME.textPrimary })
        drawCenteredText(ctx, `准确率: ${Math.round(this.correct / this.total * 100)}%`, cx, y + sp.lg + fs.lg + sp.md, { fontSize: fs.sm, color: THEME.textSecondary })
      }
    })
  }
}

module.exports = MemoryScene
