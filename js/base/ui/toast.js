/**
 * Toast 通知组件
 */
const { fillRoundedRect, drawCenteredText } = require('../draw-utils')
const THEME = require('../../config/theme')

class Toast {
  constructor() {
    this.text = ''
    this.alpha = 0
    this.timer = 0
    this.visible = false
  }

  show(text, duration) {
    this.text = text
    this.alpha = 1
    this.timer = (duration || 1.5)
    this.visible = true
  }

  update(dt) {
    if (!this.visible) return
    this.timer -= dt
    if (this.timer < 0.3) {
      this.alpha = Math.max(0, this.timer / 0.3)
    }
    if (this.timer <= 0) {
      this.visible = false
      this.alpha = 0
    }
  }

  draw(ctx) {
    if (!this.visible) return
    const sw = THEME.screenWidth
    const padding = THEME.spacing.lg
    const fontSize = THEME.fontSize.sm

    ctx.save()
    ctx.globalAlpha = this.alpha

    ctx.font = `500 ${fontSize}px ${THEME.fontFamily}`
    const textW = ctx.measureText(this.text).width
    const boxW = textW + padding * 2
    const boxH = fontSize + padding * 2
    const boxX = (sw - boxW) / 2
    const boxY = THEME.screenHeight * 0.45

    fillRoundedRect(ctx, boxX, boxY, boxW, boxH, THEME.btnRadius, 'rgba(0,0,0,0.8)')
    drawCenteredText(ctx, this.text, sw / 2, boxY + padding, {
      fontSize,
      fontWeight: '500',
      color: '#ffffff'
    })

    ctx.restore()
  }
}

module.exports = Toast
