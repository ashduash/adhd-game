/**
 * 训练计划场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { TRAINING_DAYS, getCurrentDayIndex, isTodayCompleted } = require('../utils/training')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, fillShadowRoundedRect } = require('../base/draw-utils')
const app = require('../app')

class TrainingScene extends Scene {
  constructor(params) {
    super(params)
    this.dayIndex = 0
    this.currentDay = null
    this.isCompleted = false
    this.completedDays = 0
    this._contentHeight = 0
    this._backBtnRect = null
    this._gameRects = []
  }

  onEnter() { this._refresh() }
  onShow() { this._refresh() }

  _refresh() {
    const plan = app.globalData.userData.trainingPlan
    if (!plan || !plan.cycleStart) {
      const today = new Date().toISOString().slice(0, 10)
      app.globalData.userData.trainingPlan = { cycleStart: today, dayIndex: 0, completed: [] }
      app.saveUserData()
    }
    this.dayIndex = getCurrentDayIndex(app.globalData.userData.trainingPlan)
    this.currentDay = TRAINING_DAYS[this.dayIndex]
    this.isCompleted = isTodayCompleted(app.globalData.userData.trainingPlan)
    this.completedDays = (app.globalData.userData.trainingPlan.completed || []).length
  }

  onTouchStart(x, y) {
    this.handleScrollStart(y)
    this._touchStartX = x
    this._touchStartY = y
    this._touchMoved = false
  }

  onTouchMove(x, y) {
    this.handleScrollMove(y)
    if (Math.abs(y - this._touchStartY) > 10 || Math.abs(x - this._touchStartX) > 10) {
      this._touchMoved = true
    }
  }

  onTouchEnd(x, y) {
    this.handleScrollEnd()
    if (this._touchMoved) return
    if (this._backBtnRect && this._hit(x, y + this.scrollY, this._backBtnRect)) { GameGlobal.sceneManager.pop(); return }
    const sy = this.scrollY
    for (const gr of this._gameRects) {
      if (this._hit(x, y + sy, gr)) {
        GameGlobal.sceneManager.push(gr.mode, { level: gr.level, training: true })
        return
      }
    }
  }


  onRender(ctx) {
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize; const pad = sp.xl
    // 圆形返回按钮
    const btnSize = 72 * THEME.rpx
    const btnY = THEME.statusBarHeight + sp.md * 2 + THEME.contentTopPadding
    const btnX = sp.xl
    this._backBtnRect = { x: btnX, y: btnY, w: btnSize, h: btnSize }
    ctx.save(); ctx.globalAlpha = 0.9
    fillRoundedRect(ctx, btnX, btnY, btnSize, btnSize, btnSize / 2, THEME.btnSecondaryBg)
    strokeRoundedRect(ctx, btnX, btnY, btnSize, btnSize, btnSize / 2, THEME.btnSecondaryBorder, 1)
    ctx.restore()
    drawCenteredText(ctx, '←', btnX + btnSize / 2, btnY + btnSize / 2, { fontSize: fs.xl, color: THEME.textPrimary, baseline: 'middle' })

    let y = btnY + btnSize + sp.lg

    // 标题
    drawCenteredText(ctx, '训练计划', sw / 2, y, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary })
    y += fs.xl + sp.xs
    drawCenteredText(ctx, '5天周期 · 每日3关', sw / 2, y, { fontSize: fs.sm, color: THEME.textSecondary })
    y += fs.sm + sp.lg

    // 进度点
    const dotSize = 48 * THEME.rpx; const dotGap = sp.sm
    const totalDotW = 5 * dotSize + 4 * dotGap
    let dx = (sw - totalDotW) / 2
    for (let i = 0; i < 5; i++) {
      const isCurrent = i === this.dayIndex
      const isDone = i < this.completedDays
      const bgColor = isCurrent ? THEME.primary : isDone ? '#00B894' : THEME.cardBg
      fillRoundedRect(ctx, dx, y, dotSize, dotSize, dotSize / 2, bgColor)
      if (isDone) {
        strokeRoundedRect(ctx, dx, y, dotSize, dotSize, dotSize / 2, '#00B894', 2)
      }
      drawCenteredText(ctx, String(i + 1), dx + dotSize / 2, y + (dotSize - fs.md) / 2, {
        fontSize: fs.md, fontWeight: isCurrent || isDone ? '700' : '400', color: isCurrent || isDone ? '#ffffff' : THEME.textSecondary
      })
      dx += dotSize + dotGap
    }
    y += dotSize + sp.sm
    drawCenteredText(ctx, `第 ${this.dayIndex + 1} / 5 天`, sw / 2, y, { fontSize: fs.sm, color: THEME.textSecondary })
    y += fs.sm + sp.lg

    // 今日主题卡片
    if (this.currentDay) {
      const cardW = sw - pad * 2; const cardH = 140 * THEME.rpx
      fillShadowRoundedRect(ctx, pad, y, cardW, cardH, THEME.cardRadius, THEME.cardBg, 'rgba(0,0,0,0.15)', 10, 0, 2)
      strokeRoundedRect(ctx, pad, y, cardW, cardH, THEME.cardRadius, THEME.cardBorder, 1)

      // 图标
      ctx.font = `${THEME.fontSize.title}px ${THEME.fontFamily}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(this.currentDay.icon, pad + sp.lg, y + sp.lg)

      // 主题信息
      drawText(ctx, `今日主题：${this.currentDay.theme}`, pad + sp.lg + THEME.fontSize.title + sp.md, y + sp.lg, {
        fontSize: fs.lg, fontWeight: '700', color: THEME.textPrimary
      })
      drawText(ctx, this.currentDay.desc, pad + sp.lg + THEME.fontSize.title + sp.md, y + sp.lg + fs.lg + sp.sm, {
        fontSize: fs.sm, color: THEME.textSecondary
      })

      // 状态
      const statusText = this.isCompleted ? '已完成' : '未完成'
      const statusColor = this.isCompleted ? '#00B894' : '#FF6B6B'
      const statusW = 120 * THEME.rpx; const statusH = 36 * THEME.rpx
      const statusX = pad + cardW - sp.lg - statusW
      const statusY = y + cardH - sp.md - statusH
      fillRoundedRect(ctx, statusX, statusY, statusW, statusH, statusH / 2, this.isCompleted ? 'rgba(0,184,148,0.15)' : 'rgba(255,107,107,0.15)')
      drawCenteredText(ctx, statusText, statusX + statusW / 2, statusY + (statusH - fs.xs) / 2, {
        fontSize: fs.xs, fontWeight: '600', color: statusColor
      })

      y += cardH + sp.lg
    }

    // 今日训练标题
    drawText(ctx, '今日训练', pad, y, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary })
    y += fs.lg + sp.md

    // 游戏列表
    this._gameRects = []
    if (this.currentDay) {
      for (const game of this.currentDay.games) {
        const cardW = sw - pad * 2; const cardH = 100 * THEME.rpx
        fillRoundedRect(ctx, pad, y, cardW, cardH, THEME.cardRadius, THEME.cardBg)
        strokeRoundedRect(ctx, pad, y, cardW, cardH, THEME.cardRadius, THEME.cardBorder, 1)

        // 游戏名称
        drawText(ctx, game.name, pad + sp.lg, y + sp.md + sp.xs, {
          fontSize: fs.md, fontWeight: '600', color: THEME.textPrimary
        })
        // 技能标签
        drawText(ctx, game.skill, pad + sp.lg, y + sp.md + fs.md + sp.sm, {
          fontSize: fs.xs, color: THEME.textSecondary
        })

        // 箭头
        ctx.font = `${fs.lg}px ${THEME.fontFamily}`
        ctx.fillStyle = THEME.textSecondary
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
        ctx.fillText('→', pad + cardW - sp.lg, y + cardH / 2)
        ctx.textAlign = 'left'

        this._gameRects.push({ x: pad, y, w: cardW, h: cardH, mode: game.mode, level: game.level })
        y += cardH + sp.md
      }
    }

    // 提示
    if (!this.isCompleted) {
      y += sp.sm
      const tipW = sw - pad * 2; const tipH = 60 * THEME.rpx
      fillRoundedRect(ctx, pad, y, tipW, tipH, THEME.btnRadius, 'rgba(192,122,69,0.1)')
      drawCenteredText(ctx, '完成全部3个训练即可打卡成功', sw / 2, y + (tipH - fs.sm) / 2, {
        fontSize: fs.sm, color: THEME.textSecondary
      })
      y += tipH
    }

    y += sp.xxl
    this._contentHeight = y
    this.setMaxScroll(this._contentHeight)
  }
}

module.exports = TrainingScene
