/**
 * 卡片组件 - 毛玻璃效果面板
 */
const { fillRoundedRect, strokeRoundedRect, roundedRect } = require('../draw-utils')
const THEME = require('../../config/theme')

class Card {
  constructor(opts) {
    this.x = opts.x || 0
    this.y = opts.y || 0
    this.width = opts.width || THEME.screenWidth - THEME.spacing.xl * 2
    this.height = opts.height || 200
    this.background = opts.background || THEME.cardBg
    this.borderRadius = opts.borderRadius || THEME.cardRadius
    this.borderColor = opts.borderColor || THEME.cardBorder
    this.borderWidth = opts.borderWidth || 1
    this.padding = opts.padding != null ? opts.padding : THEME.cardPadding
    this.visible = true
    this.children = []
  }

  addChild(child) {
    this.children.push(child)
    return child
  }

  draw(ctx) {
    if (!this.visible) return
    const { x, y, width, height } = this

    // 背景
    fillRoundedRect(ctx, x, y, width, height, this.borderRadius, this.background)

    // 边框
    if (this.borderWidth > 0) {
      strokeRoundedRect(ctx, x, y, width, height, this.borderRadius, this.borderColor, this.borderWidth)
    }

    // 子元素
    this.children.forEach(child => {
      if (child.draw) child.draw(ctx)
    })
  }

  hitTest(px, py) {
    return this.visible &&
      px >= this.x && px <= this.x + this.width &&
      py >= this.y && py <= this.y + this.height
  }
}

module.exports = Card
