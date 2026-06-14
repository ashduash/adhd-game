/**
 * 关于页面场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, fillShadowRoundedRect } = require('../base/draw-utils')

const FEATURES = [
  { icon: '⚡', name: '数字风暴', desc: '舒尔特方格训练，提升注意力集中能力' },
  { icon: '🧠', name: '记忆还原', desc: '数字记忆训练，锻炼短期记忆能力' },
  { icon: '👁️', name: '闪电扫视', desc: '视觉搜索训练，提升信息捕捉速度' },
  { icon: '🎭', name: '斯特鲁普', desc: '抗干扰训练，增强认知控制能力' },
  { icon: '🎯', name: '极速反应', desc: '反应速度训练，提高响应敏捷度' },
  { icon: '🌈', name: '色彩消除', desc: '颜色匹配训练，锻炼视觉辨别能力' },
  { icon: '📊', name: '序列排序', desc: '逻辑排序训练，提升工作记忆能力' },
  { icon: '🔀', name: '双线任务', desc: '多任务处理训练，增强注意力分配能力' }
]

const PRIVACY_POLICY = '本应用（专注风暴）重视用户隐私保护，以下为相关信息：\n\n' +
  '一、数据收集\n' +
  '我们收集以下信息用于提供排行榜功能：微信昵称、头像（仅用于排行榜展示）、游戏成绩数据（用于排名计算）。\n\n' +
  '二、数据使用\n' +
  '所收集的数据仅用于游戏内排行榜展示和排名计算，不会用于其他目的。\n\n' +
  '三、数据存储\n' +
  '数据存储在微信云开发环境或开发者自有服务器中，不会向任何第三方分享。\n\n' +
  '四、用户权利\n' +
  '您可在「个人中心」随时修改昵称、更换头像，或选择「清除数据」删除所有个人数据。'

const USER_AGREEMENT = '使用本应用即表示您同意以下条款：\n\n' +
  '一、本应用为专注力训练工具，游戏成绩仅供参考，不构成医疗或专业诊断建议。\n' +
  '二、本应用不对训练效果做出任何保证。\n' +
  '三、用户应遵守微信平台规范，文明使用，不得发布违规内容。\n' +
  '四、如发现违规内容，管理员有权清理相关数据。\n' +
  '五、本应用保留对用户协议进行更新的权利。'

class AboutScene extends Scene {
  constructor(params) {
    super(params)
    this._contentHeight = 0
    this._backBtnRect = null
    this._reportRect = null
    this._privacyRect = null
    this._agreementRect = null
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
    if (this._reportRect && this._hit(x, y + this.scrollY, this._reportRect)) {
      this._openReport()
      return
    }
    if (this._privacyRect && this._hit(x, y + this.scrollY, this._privacyRect)) {
      wx.showModal({ title: '隐私政策', content: PRIVACY_POLICY, showCancel: false })
      return
    }
    if (this._agreementRect && this._hit(x, y + this.scrollY, this._agreementRect)) {
      wx.showModal({ title: '用户协议', content: USER_AGREEMENT, showCancel: false })
      return
    }
  }


  _openReport() {
    if (typeof wx !== 'undefined' && wx.openCustomerServiceChat) {
      wx.openCustomerServiceChat({
        extInfo: { url: '' },
        corpId: '',
        success: () => {},
        fail: () => {
          GameGlobal.toast.show('违规内容请邮件举报: support@brainstorm.app', 3)
        }
      })
    } else {
      GameGlobal.toast.show('违规内容请邮件举报: support@brainstorm.app', 3)
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

    // 应用图标
    const iconSize = 100 * THEME.rpx
    fillGradientRoundedRect(ctx, (sw - iconSize) / 2, y, iconSize, iconSize, iconSize / 4, 135, [
      [0, THEME.primaryStart], [1, THEME.primaryEnd]
    ])
    ctx.font = `${64 * THEME.rpx}px ${THEME.fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText('🧠', sw / 2, y + iconSize / 2)
    y += iconSize + sp.md

    drawCenteredText(ctx, '专注风暴', sw / 2, y, { fontSize: fs.title, fontWeight: '700', color: THEME.textPrimary })
    y += fs.title + sp.xs
    drawCenteredText(ctx, 'v1.0.2', sw / 2, y, { fontSize: fs.sm, color: THEME.textSecondary })
    y += fs.sm + sp.xs
    drawCenteredText(ctx, '专注力训练 · 思维挑战游戏', sw / 2, y, { fontSize: fs.sm, color: THEME.textSecondary })
    y += fs.sm + sp.xl

    // 详情列表
    const cardW = sw - pad * 2
    const infoItems = [
      { label: '版本号', value: '1.0.2' },
      { label: '更新日期', value: '2026年6月14日' },
      { label: '开发者', value: '专注风暴团队' },
      { label: '客服邮箱', value: 'support@brainstorm.app' }
    ]
    fillShadowRoundedRect(ctx, pad, y, cardW, infoItems.length * 70 * THEME.rpx, THEME.cardRadius, THEME.cardBg, 'rgba(0,0,0,0.15)', 10, 0, 2)
    strokeRoundedRect(ctx, pad, y, cardW, infoItems.length * 70 * THEME.rpx, THEME.cardRadius, THEME.cardBorder, 1)
    for (let i = 0; i < infoItems.length; i++) {
      const item = infoItems[i]
      const iy = y + i * 70 * THEME.rpx
      drawText(ctx, item.label, pad + sp.lg, iy + (70 * THEME.rpx - fs.sm) / 2, {
        fontSize: fs.sm, color: THEME.textSecondary
      })
      drawText(ctx, item.value, pad + cardW - sp.lg, iy + (70 * THEME.rpx - fs.sm) / 2, {
        fontSize: fs.sm, color: THEME.textPrimary, align: 'right'
      })
      if (i < infoItems.length - 1) {
        ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(pad + sp.lg, iy + 70 * THEME.rpx); ctx.lineTo(pad + cardW - sp.lg, iy + 70 * THEME.rpx); ctx.stroke()
      }
    }
    y += infoItems.length * 70 * THEME.rpx + sp.lg

    // 内容举报入口
    this._reportRect = { x: pad, y, w: cardW, h: 70 * THEME.rpx }
    fillRoundedRect(ctx, pad, y, cardW, 70 * THEME.rpx, THEME.btnRadius, 'rgba(255,107,107,0.1)')
    strokeRoundedRect(ctx, pad, y, cardW, 70 * THEME.rpx, THEME.btnRadius, 'rgba(255,107,107,0.2)', 1)
    drawText(ctx, '⚠️', pad + sp.lg, y + (70 * THEME.rpx - fs.sm) / 2, { fontSize: fs.sm })
    drawText(ctx, '内容举报', pad + sp.lg + fs.sm + sp.sm, y + (70 * THEME.rpx - fs.sm) / 2, {
      fontSize: fs.sm, fontWeight: '600', color: '#FF6B6B'
    })
    ctx.font = `${fs.md}px ${THEME.fontFamily}`; ctx.fillStyle = THEME.textSecondary; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('›', pad + cardW - sp.lg, y + 70 * THEME.rpx / 2); ctx.textAlign = 'left'
    y += 70 * THEME.rpx + sp.lg

    // 隐私政策入口
    this._privacyRect = { x: pad, y, w: cardW, h: 70 * THEME.rpx }
    fillRoundedRect(ctx, pad, y, cardW, 70 * THEME.rpx, THEME.btnRadius, THEME.cardBg)
    strokeRoundedRect(ctx, pad, y, cardW, 70 * THEME.rpx, THEME.btnRadius, THEME.cardBorder, 1)
    drawText(ctx, '🔒', pad + sp.lg, y + (70 * THEME.rpx - fs.sm) / 2, { fontSize: fs.sm })
    drawText(ctx, '隐私政策', pad + sp.lg + fs.sm + sp.sm, y + (70 * THEME.rpx - fs.sm) / 2, {
      fontSize: fs.sm, fontWeight: '600', color: THEME.textPrimary
    })
    ctx.font = `${fs.md}px ${THEME.fontFamily}`; ctx.fillStyle = THEME.textSecondary; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('›', pad + cardW - sp.lg, y + 70 * THEME.rpx / 2); ctx.textAlign = 'left'
    y += 70 * THEME.rpx + sp.sm

    // 用户协议入口
    this._agreementRect = { x: pad, y, w: cardW, h: 70 * THEME.rpx }
    fillRoundedRect(ctx, pad, y, cardW, 70 * THEME.rpx, THEME.btnRadius, THEME.cardBg)
    strokeRoundedRect(ctx, pad, y, cardW, 70 * THEME.rpx, THEME.btnRadius, THEME.cardBorder, 1)
    drawText(ctx, '📜', pad + sp.lg, y + (70 * THEME.rpx - fs.sm) / 2, { fontSize: fs.sm })
    drawText(ctx, '用户协议', pad + sp.lg + fs.sm + sp.sm, y + (70 * THEME.rpx - fs.sm) / 2, {
      fontSize: fs.sm, fontWeight: '600', color: THEME.textPrimary
    })
    ctx.font = `${fs.md}px ${THEME.fontFamily}`; ctx.fillStyle = THEME.textSecondary; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('›', pad + cardW - sp.lg, y + 70 * THEME.rpx / 2); ctx.textAlign = 'left'
    y += 70 * THEME.rpx + sp.lg

    // 功能介绍
    drawText(ctx, '功能介绍', pad, y, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary })
    y += fs.lg + sp.md

    for (const feat of FEATURES) {
      const fh = 90 * THEME.rpx
      fillRoundedRect(ctx, pad, y, cardW, fh, THEME.btnRadius, THEME.cardBg)
      // 图标
      ctx.font = `${THEME.fontSize.xl}px ${THEME.fontFamily}`; ctx.textAlign = 'left'; ctx.textBaseline = 'top'
      ctx.fillText(feat.icon, pad + sp.lg, y + (fh - THEME.fontSize.xl) / 2)
      // 名称和描述
      drawText(ctx, feat.name, pad + sp.lg + THEME.fontSize.xl + sp.md, y + sp.md, {
        fontSize: fs.sm, fontWeight: '600', color: THEME.textPrimary
      })
      drawText(ctx, feat.desc, pad + sp.lg + THEME.fontSize.xl + sp.md, y + sp.md + fs.sm + sp.xs, {
        fontSize: fs.xs, color: THEME.textSecondary
      })
      y += fh + sp.sm
    }

    // 版权信息
    y += sp.lg
    drawCenteredText(ctx, 'Copyright © 2026 专注风暴团队', sw / 2, y, { fontSize: fs.xs, color: THEME.textSecondary })
    y += fs.xs + sp.xs
    drawCenteredText(ctx, 'All Rights Reserved', sw / 2, y, { fontSize: fs.xs, color: THEME.textSecondary })
    y += fs.xs + sp.xxl

    this._contentHeight = y
    this.setMaxScroll(this._contentHeight)
  }
}

module.exports = AboutScene
