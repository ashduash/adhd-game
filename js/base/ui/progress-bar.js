/**
 * 进度条组件
 */
const { fillRoundedRect } = require('../draw-utils')
const THEME = require('../../config/theme')

class ProgressBar {
  constructor(opts) {
    this.x = opts.x || 0
    this.y = opts.y || 0
    this.width = opts.width || 200
    this.height = opts.height || 12
    this.progress = opts.progress || 0 // 0~1
    this.trackColor = opts.trackColor || 'rgba(255,255,255,0.1)'
    this.fillColor = opts.fillColor || THEME.primary
    this.fillGradient = opts.fillGradient || null // [color1, color2]
    this.borderRadius = opts.borderRadius || (this.height / 2)
    this.visible = true
  }

  draw(ctx) {
    if (!this.visible) return
    const { x, y, width, height } = this
    const r = this.borderRadius

    // 轨道
    fillRoundedRect(ctx, x, y, width, height, r, this.trackColor)

    // 填充
    const fillWidth = Math.max(0, width * Math.min(1, this.progress))
    if (fillWidth > 0) {
      if (this.fillGradient) {
        const gradient = ctx.createLinearGradient(x, y, x + fillWidth, y)
        gradient.addColorStop(0, this.fillGradient[0])
        gradient.addColorStop(1, this.fillGradient[1])
        fillRoundedRect(ctx, x, y, fillWidth, height, r, gradient)
      } else {
        fillRoundedRect(ctx, x, y, fillWidth, height, r, this.fillColor)
      }
    }
  }
}

module.exports = ProgressBar
