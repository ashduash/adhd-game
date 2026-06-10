/**
 * 按钮组件 - Canvas 绘制的可交互按钮
 */
const { fillRoundedRect, fillGradientRoundedRect, roundedRect } = require('../draw-utils')
const THEME = require('../../config/theme')

class Button {
  constructor(opts) {
    this.x = opts.x || 0
    this.y = opts.y || 0
    this.width = opts.width || 200
    this.height = opts.height || 80
    this.text = opts.text || ''
    this.textColor = opts.textColor || '#ffffff'
    this.fontSize = opts.fontSize || THEME.fontSize.md
    this.fontWeight = opts.fontWeight || '600'
    this.background = opts.background || THEME.cardBg
    this.borderRadius = opts.borderRadius || THEME.btnRadius
    this.borderColor = opts.borderColor || 'transparent'
    this.borderWidth = opts.borderWidth || 0
    this.gradient = opts.gradient || null // [color1, color2]
    this.gradientAngle = opts.gradientAngle || 135
    this.shadow = opts.shadow || null
    this.onTap = opts.onTap || null
    this.pressed = false
    this.visible = true
    this.interactive = true
    this._pressScale = 1
  }

  draw(ctx) {
    if (!this.visible) return
    const { x, y, width, height } = this
    const scale = this.pressed ? 0.95 : 1
    const cx = x + width / 2
    const cy = y + height / 2

    ctx.save()
    if (scale !== 1) {
      ctx.translate(cx, cy)
      ctx.scale(scale, scale)
      ctx.translate(-cx, -cy)
    }

    // 阴影
    if (this.shadow) {
      ctx.shadowColor = this.shadow.color || THEME.btnShadow
      ctx.shadowBlur = this.shadow.blur || 16
      ctx.shadowOffsetX = this.shadow.offsetX || 0
      ctx.shadowOffsetY = this.shadow.offsetY || 4
    }

    // 背景
    if (this.gradient) {
      fillGradientRoundedRect(ctx, x, y, width, height, this.borderRadius, this.gradientAngle, [
        [0, this.gradient[0]],
        [1, this.gradient[1]]
      ])
    } else {
      fillRoundedRect(ctx, x, y, width, height, this.borderRadius, this.background)
    }

    // 重置阴影
    ctx.shadowColor = 'transparent'
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0

    // 边框
    if (this.borderWidth > 0) {
      roundedRect(ctx, x, y, width, height, this.borderRadius)
      ctx.strokeStyle = this.borderColor
      ctx.lineWidth = this.borderWidth
      ctx.stroke()
    }

    // 文字
    ctx.font = `${this.fontWeight} ${this.fontSize}px ${THEME.fontFamily}`
    ctx.fillStyle = this.pressed ? 'rgba(255,255,255,0.7)' : this.textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.text, cx, cy)

    ctx.restore()
  }

  hitTest(px, py) {
    return this.visible && this.interactive &&
      px >= this.x && px <= this.x + this.width &&
      py >= this.y && py <= this.y + this.height
  }
}

module.exports = Button
