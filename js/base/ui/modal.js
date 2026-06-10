/**
 * 弹窗组件 - 引导、规则、确认等弹窗
 */
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, roundedRect } = require('../draw-utils')
const THEME = require('../../config/theme')

class Modal {
  constructor() {
    this.visible = false
    this.alpha = 0
    this._targetAlpha = 0
  }

  show() {
    this.visible = true
    this._targetAlpha = 1
  }

  hide() {
    this._targetAlpha = 0
  }

  update(dt) {
    if (this.alpha < this._targetAlpha) {
      this.alpha = Math.min(this._targetAlpha, this.alpha + dt * 5)
    } else if (this.alpha > this._targetAlpha) {
      this.alpha = Math.max(this._targetAlpha, this.alpha - dt * 5)
      if (this.alpha <= 0) this.visible = false
    }
  }

  drawOverlay(ctx) {
    if (!this.visible && this.alpha <= 0) return
    ctx.fillStyle = THEME.overlayBg
    ctx.globalAlpha = this.alpha
    ctx.fillRect(0, 0, THEME.screenWidth, THEME.screenHeight)
    ctx.globalAlpha = 1
  }

  // 绘制引导弹窗
  drawGuide(ctx, step) {
    if (!this.visible && this.alpha <= 0) return
    this.drawOverlay(ctx)

    const sw = THEME.screenWidth
    const sh = THEME.screenHeight
    const cardW = sw * 0.85
    const cardH = 380 * THEME.rpx
    const cardX = (sw - cardW) / 2
    const cardY = (sh - cardH) / 2

    ctx.save()
    ctx.globalAlpha = this.alpha

    // 卡片背景
    fillRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.modalBg)

    // 图标
    ctx.font = `${THEME.fontSize.title}px ${THEME.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillStyle = THEME.textPrimary
    ctx.fillText(step.icon, sw / 2, cardY + THEME.spacing.xl)

    // 标题
    ctx.font = `700 ${THEME.fontSize.xl}px ${THEME.fontFamily}`
    ctx.fillStyle = THEME.textPrimary
    ctx.fillText(step.title, sw / 2, cardY + THEME.spacing.xl + THEME.fontSize.title + THEME.spacing.md)

    // 描述
    ctx.font = `400 ${THEME.fontSize.md}px ${THEME.fontFamily}`
    ctx.fillStyle = THEME.textSecondary
    ctx.fillText(step.desc, sw / 2, cardY + THEME.spacing.xl + THEME.fontSize.title + THEME.fontSize.xl + THEME.spacing.xl)

    ctx.restore()
  }

  // 绘制规则弹窗
  drawRules(ctx, title, sections, scrollY) {
    if (!this.visible && this.alpha <= 0) return
    this.drawOverlay(ctx)

    const sw = THEME.screenWidth
    const sh = THEME.screenHeight
    const cardW = sw * 0.85
    const cardH = sh * 0.7
    const cardX = (sw - cardW) / 2
    const cardY = (sh - cardH) / 2

    ctx.save()
    ctx.globalAlpha = this.alpha

    // 卡片背景
    fillRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.modalBg)

    // 标题
    drawCenteredText(ctx, title, sw / 2, cardY + THEME.spacing.xl, {
      fontSize: THEME.fontSize.xl,
      fontWeight: '700',
      color: THEME.textPrimary
    })

    // 内容区域（可滚动）
    const contentY = cardY + THEME.spacing.xl + THEME.fontSize.xl + THEME.spacing.lg
    const contentH = cardH - THEME.spacing.xl * 2 - THEME.fontSize.xl - THEME.spacing.lg
    ctx.save()
    ctx.beginPath()
    ctx.rect(cardX, contentY, cardW, contentH)
    ctx.clip()

    let y = contentY - (scrollY || 0)
    sections.forEach(section => {
      // 段落标题
      drawText(ctx, section.title, cardX + THEME.spacing.lg, y, {
        fontSize: THEME.fontSize.md,
        fontWeight: '600',
        color: THEME.textAccent
      })
      y += THEME.fontSize.md + THEME.spacing.xs

      // 段落内容
      const lines = wrapText(ctx, section.text, cardW - THEME.spacing.lg * 2, THEME.fontSize.sm)
      lines.forEach(line => {
        drawText(ctx, line, cardX + THEME.spacing.lg, y, {
          fontSize: THEME.fontSize.sm,
          color: THEME.textSecondary
        })
        y += THEME.fontSize.sm * 1.6
      })
      y += THEME.spacing.lg
    })

    ctx.restore()

    // 关闭提示
    drawCenteredText(ctx, '点击任意位置关闭', sw / 2, cardY + cardH - THEME.spacing.xl - THEME.fontSize.sm, {
      fontSize: THEME.fontSize.sm,
      color: THEME.textSecondary
    })

    ctx.restore()
  }

  hitTest(x, y) {
    return this.visible
  }
}

// 文字自动换行
function wrapText(ctx, text, maxWidth, fontSize) {
  ctx.font = `400 ${fontSize}px ${THEME.fontFamily}`
  const lines = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const testLine = line + text[i]
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      lines.push(line)
      line = text[i]
    } else {
      line = testLine
    }
  }
  if (line) lines.push(line)
  return lines
}

module.exports = Modal
