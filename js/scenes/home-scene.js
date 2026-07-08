/**
 * 首页场景 - Canvas 绘制版本（打磨版）
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { RANKS, getRankProgress } = require('../utils/util')
const { generateDailyChallenge, getTodayString, canUseStreakFreeze, useStreakFreeze } = require('../utils/daily')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, drawCenteredGradientText, fillGradientRoundedRect, fillShadowRoundedRect } = require('../base/draw-utils')
const { MODES } = require('../config/modes')
const app = require('../app')
const share = require('../utils/share')

const EASING = { easeOut: t => 1 - Math.pow(1 - t, 3) }

class HomeScene extends Scene {
  constructor(params) {
    super(params)
    this._isTab = true
    this.rankInfo = {}
    this.rankProgress = 0
    this.nextRank = null
    this.pointsNeeded = 0
    this.dailyChallenge = null
    this.streak = 0
    this.streakFreeze = 0
    this.canFreeze = false
    this.totalGames = 0
    this.bestScores = {}
    this.nickName = ''
    this._contentHeight = 0
    this._touchMoved = true
    this._modeCardRects = []
    this._dailyRect = null
    this._trainingRect = null
    this._rankCardRect = null
    this._freezeBtnRect = null
    this._freezeWatchRect = null
    // 入场动画
    this._enterTime = 0
    this._entered = false
    // 登录遮罩
    this.showLogin = false
    this._loginLoading = false
    this._loginError = ''
    this._loginBtnRect = null
    this._guestBtnRect = null
    // 社交入口
    this._shareBtnRect = null
    this._groupRankBtnRect = null
    this._subscribeBtnRect = null
    // 好友挑战横幅
    this._challengeBannerRect = null
    this._challengeAcceptRect = null
    this._challengeCloseRect = null
    // 群排行占位弹层
    this.showGroupRank = false
  }

  onEnter() {
    this._refresh()
    this._enterTime = Date.now()
    this._entered = true
    this._checkLoginState()
  }

  onShow() {
    console.log('[HomeScene] onShow, isLoggedIn:', app.isLoggedIn(), 'showLogin:', this.showLogin)
    this._refresh()
    this._enterTime = Date.now()
    this._entered = true
    this._touchMoved = true // 防止场景切换时的触摸穿透触发点击
    this._checkLoginState()
  }

  _refresh() {
    const userData = app.globalData.userData
    this.rankInfo = RANKS[userData.rank] || RANKS.bronze
    const { progress, nextRank, pointsNeeded } = getRankProgress(userData.rank, userData.rankPoints)
    this.rankProgress = progress
    this.nextRank = nextRank ? RANKS[nextRank] : null
    this.pointsNeeded = pointsNeeded
    this.totalGames = userData.totalGames
    this.bestScores = userData.bestScores
    this.streak = userData.streak || 0
    this.streakFreeze = userData.streakFreeze || 0
    this.canFreeze = canUseStreakFreeze(userData.lastPlayDate)
    this.nickName = wx.getStorageSync('nickName') || '玩家'
    this._updateDailyChallenge()
    // 胶囊菜单/朋友圈分享的默认内容
    share.setSharePayload(share.defaultPayload())
    // 暂存好友挑战（供横幅展示，应战后清除）
    this._pendingChallenge = app.getIncomingChallenge()
  }

  _updateDailyChallenge() {
    const userData = app.globalData.userData
    const today = getTodayString()
    if (userData.dailyChallenge && userData.dailyChallenge.date === today) {
      this.dailyChallenge = userData.dailyChallenge
    } else {
      const challenge = generateDailyChallenge()
      userData.dailyChallenge = { date: today, completed: false, mode: challenge.mode, level: challenge.level }
      app.saveUserData()
      this.dailyChallenge = challenge
    }
  }

  // 计算入场动画透明度（交错淡入）
  _checkLoginState() {
    this.showLogin = !app.isLoggedIn()
    this._loginLoading = false
    this._loginError = ''
  }

  async _handleLogin() {
    if (this._loginLoading) return
    this._loginLoading = true
    this._loginError = ''
    try {
      // 等待云 SDK 就绪（最多 3 秒），避免 cloud 未初始化直接走 HTTP 回退
      if (wx.cloud && !GameGlobal._cloudReady) {
        GameGlobal.toast.show('正在连接服务...', 3)
        for (let i = 0; i < 30; i++) {
          await new Promise(r => setTimeout(r, 100))
          if (GameGlobal._cloudReady) break
        }
      }
      await app.wxLogin()
      if (!wx.getStorageSync('nickName')) wx.setStorageSync('nickName', '玩家')
      app.loginToServer(wx.getStorageSync('nickName'), '').catch(() => {})
      this.showLogin = false
      this._refresh()
      GameGlobal.toast.show('登录成功')
    } catch (e) {
      this._loginError = e.message || '登录失败，请重试'
      GameGlobal.toast.show(this._loginError, 3)
    } finally {
      this._loginLoading = false
    }
  }

  _handleGuest() {
    app.setGuestMode(true)
    this.showLogin = false
    this._refresh()
    GameGlobal.toast.show('已进入游客模式，登录后可参与全网排行')
  }

  _renderLoginOverlay(ctx) {
    const sw = THEME.screenWidth; const sh = THEME.screenHeight
    const sp = THEME.spacing; const fs = THEME.fontSize

    // 全屏遮罩背景
    ctx.fillStyle = THEME.overlayBg
    ctx.fillRect(0, 0, sw, sh)

    // 居中卡片
    const cardW = sw * 0.82; const cardH = 420 * THEME.rpx
    const cardX = (sw - cardW) / 2; const cardY = (sh - cardH) / 2
    fillRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.modalBg)
    strokeRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.cardBorder, 1)

    // 游戏图标
    let cy = cardY + sp.xl * 1.5
    drawCenteredText(ctx, '🎮', sw / 2, cy, { fontSize: 64 * THEME.rpx })
    cy += 80 * THEME.rpx

    // 标题
    drawCenteredText(ctx, '专注风暴', sw / 2, cy, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary })
    cy += fs.xl + sp.md

    // 说明文字
    drawCenteredText(ctx, '请使用微信登录后开始游戏', sw / 2, cy, { fontSize: fs.md, color: THEME.textSecondary })
    cy += fs.md + sp.xl * 1.5

    // 登录按钮
    const btnW = cardW - sp.xl * 2; const btnH = 80 * THEME.rpx
    const btnX = cardX + sp.xl
    this._loginBtnRect = { x: btnX, y: cy, w: btnW, h: btnH }

    if (this._loginLoading) {
      fillRoundedRect(ctx, btnX, cy, btnW, btnH, THEME.btnRadius, 'rgba(192,122,69,0.45)')
      const dots = '.'.repeat(Math.floor(Date.now() / 400) % 4)
      drawCenteredText(ctx, `登录中${dots}`, sw / 2, cy + btnH / 2, { fontSize: fs.md, fontWeight: '600', color: '#ffffff', baseline: 'middle' })
    } else {
      fillShadowRoundedRect(ctx, btnX, cy, btnW, btnH, THEME.btnRadius, THEME.primary, THEME.btnShadow, 20, 0, 4)
      fillGradientRoundedRect(ctx, btnX, cy, btnW, btnH, THEME.btnRadius, 135, [[0, THEME.primaryStart], [1, THEME.primaryEnd]])
      // 微信图标 + 文字
      drawCenteredText(ctx, '微信一键登录', sw / 2, cy + btnH / 2, { fontSize: fs.md, fontWeight: '600', color: '#ffffff', baseline: 'middle' })
    }
    cy += btnH + sp.lg

    // 游客体验按钮（跳过登录，直接试玩）
    const gbtnW = cardW - sp.xl * 2; const gbtnH = 64 * THEME.rpx
    const gbtnX = cardX + sp.xl; const gbtnY = cy
    this._guestBtnRect = { x: gbtnX, y: gbtnY, w: gbtnW, h: gbtnH }
    fillRoundedRect(ctx, gbtnX, gbtnY, gbtnW, gbtnH, THEME.btnRadius, 'rgba(255,255,255,0.06)')
    strokeRoundedRect(ctx, gbtnX, gbtnY, gbtnW, gbtnH, THEME.btnRadius, THEME.cardBorder, 1)
    drawCenteredText(ctx, '游客体验（成绩仅本地保存）', sw / 2, gbtnY + gbtnH / 2, { fontSize: fs.sm, color: THEME.textSecondary, baseline: 'middle' })
    cy += gbtnH + sp.lg

    // 错误提示
    if (this._loginError) {
      drawCenteredText(ctx, this._loginError, sw / 2, cy, { fontSize: fs.sm, color: '#FF6B6B' })
    }
  }

  // 计算入场动画透明度（交错淡入）
  _getItemAlpha(index) {
    if (!this._entered) return 0
    const elapsed = (Date.now() - this._enterTime) / 1000
    const delay = index * 0.06
    const t = Math.max(0, Math.min(1, (elapsed - delay) / 0.35))
    return t < 1 ? EASING.easeOut(t) : 1
  }

  _getItemOffsetY(index) {
    const alpha = this._getItemAlpha(index)
    return (1 - alpha) * 30
  }

  onTouchStart(x, y) {
    if (this.showLogin) {
      this._touchStartX = x; this._touchStartY = y; this._touchMoved = false
      return
    }
    this.handleScrollStart(y)
    this._touchStartX = x
    this._touchStartY = y
    this._touchMoved = false
  }

  onTouchMove(x, y) {
    if (this.showLogin) {
      if (Math.abs(y - this._touchStartY) > 10 || Math.abs(x - this._touchStartX) > 10) this._touchMoved = true
      return
    }
    this.handleScrollMove(y)
    if (Math.abs(y - this._touchStartY) > 10 || Math.abs(x - this._touchStartX) > 10) {
      this._touchMoved = true
    }
  }

  onTouchEnd(x, y) {
    if (this.showLogin) {
      if (!this._touchMoved && this._loginBtnRect && this._hitRect(x, y, this._loginBtnRect)) {
        this._handleLogin()
        return
      }
      if (!this._touchMoved && this._guestBtnRect && this._hitRect(x, y, this._guestBtnRect)) {
        this._handleGuest()
      }
      return
    }
    if (this.showGroupRank) {
      if (!this._touchMoved && this._groupRankCloseRect && this._hitRect(x, y, this._groupRankCloseRect)) {
        this.showGroupRank = false
      }
      return
    }
    this.handleScrollEnd()
    if (!this._touchMoved) {
      this._checkTap(x, y)
    }
  }

  _checkTap(x, y) {
    if (this.showLogin) return
    const sy = this.scrollY
    if (this._rankCardRect && this._hitRect(x, y + sy, this._rankCardRect)) {
      GameGlobal.sceneManager.switchTab('rank')
      return
    }
    if (this._freezeBtnRect && this._hitRect(x, y + sy, this._freezeBtnRect)) {
      const userData = app.globalData.userData
      if (userData.streakFreeze > 0) {
        const result = useStreakFreeze(userData.lastPlayDate, userData.streak)
        userData.streakFreeze--
        userData.lastPlayDate = result.lastPlayDate
        userData.streak = result.streak
        app.saveUserData()
        this._refresh()
        GameGlobal.toast.show('补签成功！')
      }
      return
    }
    if (this._freezeWatchRect && this._hitRect(x, y + sy, this._freezeWatchRect)) {
      app.showRewardedAd().then(watched => {
        if (watched) {
          app.globalData.userData.streakFreeze++
          app.saveUserData()
          this._refresh()
          GameGlobal.toast.show('获得补签卡 x1')
        }
      })
      return
    }
    if (this._dailyRect && this._hitRect(x, y + sy, this._dailyRect)) {
      if (this.dailyChallenge && !this.dailyChallenge.completed) {
        GameGlobal.sceneManager.push(this.dailyChallenge.mode, { level: this.dailyChallenge.level, daily: true })
      }
      return
    }
    if (this._trainingRect && this._hitRect(x, y + sy, this._trainingRect)) {
      GameGlobal.sceneManager.push('training')
      return
    }
    for (let i = 0; i < this._modeCardRects.length; i++) {
      const rect = this._modeCardRects[i]
      if (this._hitRect(x, y + sy, rect)) {
        GameGlobal.sceneManager.push(MODES[i].id)
        return
      }
    }
    // 好友挑战横幅：接受 / 关闭
    if (this._pendingChallenge && this._pendingChallenge.mode) {
      if (this._challengeAcceptRect && this._hitRect(x, y + sy, this._challengeAcceptRect)) {
        this._acceptChallenge()
        return
      }
      if (this._challengeCloseRect && this._hitRect(x, y + sy, this._challengeCloseRect)) {
        app.clearIncomingChallenge()
        this._pendingChallenge = null
        return
      }
    }
    // 社交入口
    if (this._shareBtnRect && this._hitRect(x, y + sy, this._shareBtnRect)) {
      share.shareToFriend(share.defaultPayload())
      return
    }
    if (this._groupRankBtnRect && this._hitRect(x, y + sy, this._groupRankBtnRect)) {
      this.showGroupRank = true
      return
    }
    if (this._subscribeBtnRect && this._hitRect(x, y + sy, this._subscribeBtnRect)) {
      share.requestSubscribe().then((res) => {
        if (res && res.ok) GameGlobal.toast.show('订阅成功，次日召回提醒已开启', 2)
      })
      return
    }
  }

  _acceptChallenge() {
    const ch = this._pendingChallenge
    if (!ch || !ch.mode) return
    app.clearIncomingChallenge()
    this._pendingChallenge = null
    const target = ch.score != null ? `击败好友的 ${ch.score} 分！` : '好友在等你应战！'
    // 带上 challenge 上下文，供结算屏比出胜负
    if (ch.level != null) GameGlobal.sceneManager.push(ch.mode, { level: ch.level, challenge: ch })
    else GameGlobal.sceneManager.push(ch.mode, { challenge: ch })
    GameGlobal.toast.show('挑战开始 · ' + target, 2)
  }

  _hitRect(px, py, rect) {
    return px >= rect.x && px <= rect.x + rect.w && py >= rect.y && py <= rect.y + rect.h
  }

  onRender(ctx) {
    const sw = THEME.screenWidth
    const sp = THEME.spacing
    const fs = THEME.fontSize
    const pad = sp.xl
    let y = sp.xl + sp.lg + THEME.contentTopPadding
    let itemIdx = 0

    // 每帧重置所有hit-test rect，防止stale rect
    this._freezeBtnRect = null
    this._freezeWatchRect = null
    this._dailyRect = null
    this._trainingRect = null
    this._rankCardRect = null
    this._modeCardRects = []
    this._shareBtnRect = null
    this._groupRankBtnRect = null
    this._subscribeBtnRect = null
    this._challengeBannerRect = null
    this._challengeAcceptRect = null
    this._challengeCloseRect = null

    // === 顶部标题行（居中布局，避开微信菜单按钮） ===
    const alpha0 = this._getItemAlpha(itemIdx)
    const off0 = this._getItemOffsetY(itemIdx)
    if (alpha0 > 0) {
      ctx.save()
      ctx.globalAlpha = alpha0

      // 标题居中
      drawCenteredGradientText(ctx, '专注风暴', sw / 2, y + off0, fs.title, '700', [
        [0, THEME.gradientTextStart], [1, THEME.gradientTextEnd]
      ])

      // 副标题和段位徽章同一行居中
      const subY = y + fs.title + sp.xs + off0
      const badgeText = `${this.rankInfo.icon || '🥉'} ${this.rankInfo.name || '青铜'}`
      const badgeTextW = ctx.measureText(badgeText).width
      const totalW = badgeTextW + sp.md * 2

      // 副标题
      const subTitle = '思维挑战游戏'
      const subW = ctx.measureText(subTitle).width
      const gap = sp.md
      const startX = sw / 2 - (subW + gap + totalW) / 2

      drawText(ctx, subTitle, startX, subY, {
        fontSize: fs.sm, color: THEME.textSecondary
      })

      // 段位徽章
      const badgeH = 44 * THEME.rpx
      const badgeX = startX + subW + gap
      const badgeY = subY + (fs.sm - badgeH) / 2
      const badgeW = totalW
      fillRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2, THEME.cardBg)
      strokeRoundedRect(ctx, badgeX, badgeY, badgeW, badgeH, badgeH / 2, THEME.cardBorder, 1)
      drawCenteredText(ctx, badgeText, badgeX + badgeW / 2, badgeY + (badgeH - fs.xs) / 2, {
        fontSize: fs.xs, fontWeight: '600', color: this.rankInfo.color || '#CD7F32'
      })

      ctx.restore()
    }
    y += fs.title + fs.sm + sp.md + sp.lg
    itemIdx++

    // === 段位卡片 ===
    const alpha1 = this._getItemAlpha(itemIdx)
    const off1 = this._getItemOffsetY(itemIdx)
    if (alpha1 > 0) {
      ctx.save(); ctx.globalAlpha = alpha1
      const cardW = sw - pad * 2
      this._rankCardRect = { x: pad, y: y + off1, w: cardW, h: 180 * THEME.rpx }
      this._drawRankCard(ctx, pad, y + off1, cardW)
      ctx.restore()
    }
    y += 180 * THEME.rpx + sp.md
    itemIdx++

    // === 连续打卡 ===
    if (this.streak > 0) {
      const alpha2 = this._getItemAlpha(itemIdx)
      const off2 = this._getItemOffsetY(itemIdx)
      if (alpha2 > 0) {
        ctx.save(); ctx.globalAlpha = alpha2
        this._drawStreakBar(ctx, pad, y + off2, sw - pad * 2)
        ctx.restore()
      }
      y += 60 * THEME.rpx + sp.md
      itemIdx++
    }

    // === 补签卡 ===
    if (this.canFreeze || this.streakFreeze > 0) {
      const alpha3 = this._getItemAlpha(itemIdx)
      const off3 = this._getItemOffsetY(itemIdx)
      if (alpha3 > 0) {
        ctx.save(); ctx.globalAlpha = alpha3
        this._drawFreezeCard(ctx, pad, y + off3, sw - pad * 2)
        ctx.restore()
      }
      y += 100 * THEME.rpx + sp.md
      itemIdx++
    }

    // === 好友挑战横幅（来自分享深链）===
    if (this._pendingChallenge && this._pendingChallenge.mode) {
      const alphaC = this._getItemAlpha(itemIdx)
      const offC = this._getItemOffsetY(itemIdx)
      if (alphaC > 0) {
        ctx.save(); ctx.globalAlpha = alphaC
        const ch = this._pendingChallenge
        const modeName = (MODES.find(m => m.id === ch.mode) || {}).name || '专注力'
        const h = 96 * THEME.rpx
        this._challengeBannerRect = { x: pad, y: y + offC, w: sw - pad * 2, h }
        this._drawChallengeBanner(ctx, pad, y + offC, sw - pad * 2, modeName, ch)
        ctx.restore()
      }
      y += 96 * THEME.rpx + sp.md
      itemIdx++
    }

    // === 每日挑战 ===
    if (this.dailyChallenge) {
      const alpha4 = this._getItemAlpha(itemIdx)
      const off4 = this._getItemOffsetY(itemIdx)
      if (alpha4 > 0) {
        ctx.save(); ctx.globalAlpha = alpha4
        this._dailyRect = { x: pad, y: y + off4, w: sw - pad * 2, h: 140 * THEME.rpx }
        this._drawDailyCard(ctx, pad, y + off4, sw - pad * 2)
        ctx.restore()
      }
      y += 140 * THEME.rpx + sp.md
      itemIdx++
    }

    // === 训练计划 ===
    const alpha5 = this._getItemAlpha(itemIdx)
    const off5 = this._getItemOffsetY(itemIdx)
    if (alpha5 > 0) {
      ctx.save(); ctx.globalAlpha = alpha5
      this._trainingRect = { x: pad, y: y + off5, w: sw - pad * 2, h: 100 * THEME.rpx }
      this._drawTrainingCard(ctx, pad, y + off5, sw - pad * 2)
      ctx.restore()
    }
    y += 100 * THEME.rpx + sp.lg
    itemIdx++

    // === 社交分享（轻量行内操作栏）===
    const alphaS = this._getItemAlpha(itemIdx)
    const offS = this._getItemOffsetY(itemIdx)
    if (alphaS > 0) {
      ctx.save(); ctx.globalAlpha = alphaS
      const h = 72 * THEME.rpx
      this._drawSocialCard(ctx, pad, y + offS, sw - pad * 2)
      ctx.restore()
    }
    y += 72 * THEME.rpx + sp.md
    itemIdx++

    // === 挑战模式标题 ===
    const alpha6 = this._getItemAlpha(itemIdx)
    const off6 = this._getItemOffsetY(itemIdx)
    if (alpha6 > 0) {
      ctx.save(); ctx.globalAlpha = alpha6
      drawText(ctx, '挑战模式', pad, y + off6, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary })
      ctx.restore()
    }
    y += fs.lg + sp.md
    itemIdx++

    // === 游戏模式列表 ===
    this._modeCardRects = []
    const modeCardH = 130 * THEME.rpx
    for (let i = 0; i < MODES.length; i++) {
      const mode = MODES[i]
      const alphaM = this._getItemAlpha(itemIdx)
      const offM = this._getItemOffsetY(itemIdx)
      if (alphaM > 0) {
        ctx.save(); ctx.globalAlpha = alphaM
        this._modeCardRects.push({ x: pad, y: y + offM, w: sw - pad * 2, h: modeCardH })
        this._drawModeCard(ctx, pad, y + offM, sw - pad * 2, mode)
        ctx.restore()
      } else {
        this._modeCardRects.push({ x: pad, y: y, w: sw - pad * 2, h: modeCardH })
      }
      y += modeCardH + sp.md
      itemIdx++
    }

    // === 统计信息 ===
    y += sp.md
    const alpha8 = this._getItemAlpha(itemIdx)
    const off8 = this._getItemOffsetY(itemIdx)
    if (alpha8 > 0) {
      ctx.save(); ctx.globalAlpha = alpha8
      this._drawStatsRow(ctx, pad, y + off8, sw - pad * 2)
      ctx.restore()
    }
    y += 100 * THEME.rpx + sp.xl

    this._contentHeight = y
    this.setMaxScroll(this._contentHeight)

    // 登录遮罩（绘制在最顶层）
    if (this.showLogin) this._renderLoginOverlay(ctx)

    // 群排行占位弹层（绘制在最顶层）
    if (this.showGroupRank) this._drawGroupRankOverlay(ctx)
  }

  _drawRankCard(ctx, x, y, w) {
    const h = 180 * THEME.rpx
    const r = THEME.cardRadius
    const sp = THEME.spacing
    const fs = THEME.fontSize

    // 卡片背景
    fillRoundedRect(ctx, x, y, w, h, r, THEME.cardBg)
    strokeRoundedRect(ctx, x, y, w, h, r, THEME.cardBorder, 1)

    // 左侧：段位信息
    const lx = x + sp.lg
    drawText(ctx, '当前段位', lx, y + sp.md, { fontSize: fs.sm, color: THEME.textSecondary })

    // 段位图标和名称
    ctx.font = `${fs.xxl}px ${THEME.fontFamily}`
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText(this.rankInfo.icon || '🥉', lx, y + sp.md + fs.sm + sp.xs)

    ctx.font = `700 ${fs.xl}px ${THEME.fontFamily}`
    ctx.fillStyle = this.rankInfo.color || '#CD7F32'
    ctx.fillText(this.rankInfo.name || '青铜', lx + fs.xxl + sp.sm, y + sp.md + fs.sm + sp.xs + sp.xs)

    // 右侧：积分
    ctx.font = `700 ${THEME.fontSize.title}px ${THEME.fontFamily}`
    ctx.fillStyle = '#FFD700'
    ctx.textAlign = 'right'; ctx.textBaseline = 'top'
    ctx.fillText(String(app.globalData.userData.rankPoints), x + w - sp.lg, y + sp.md)
    ctx.font = `400 ${fs.sm}px ${THEME.fontFamily}`
    ctx.fillStyle = THEME.textSecondary
    ctx.fillText('积分', x + w - sp.lg, y + sp.md + THEME.fontSize.title + sp.xs)
    ctx.textAlign = 'left'

    // 进度条
    const barY = y + h - sp.lg - 20 * THEME.rpx
    const barX = x + sp.lg
    const barW = w - sp.lg * 2
    const barH = 12 * THEME.rpx

    fillRoundedRect(ctx, barX, barY, barW, barH, barH / 2, 'rgba(255,255,255,0.1)')
    const fillW = barW * Math.min(1, this.rankProgress)
    if (fillW > 0) {
      fillGradientRoundedRect(ctx, barX, barY, fillW, barH, barH / 2, 90, [
        [0, this.rankInfo.color || '#CD7F32'],
        [1, (this.rankInfo.color || '#CD7F32') + 'AA']
      ])
    }

    if (this.nextRank) {
      drawText(ctx, `距离${this.nextRank.name} 还需${this.pointsNeeded}分`, barX, barY + barH + sp.xs, {
        fontSize: fs.xs, color: THEME.textSecondary
      })
    }
  }

  _drawStreakBar(ctx, x, y, w) {
    const h = 60 * THEME.rpx
    fillGradientRoundedRect(ctx, x, y, w, h, THEME.btnRadius, 135, [
      [0, 'rgba(255,107,107,0.15)'], [1, 'rgba(255,165,0,0.15)']
    ])
    strokeRoundedRect(ctx, x, y, w, h, THEME.btnRadius, 'rgba(255,107,107,0.2)', 1)
    drawText(ctx, `🔥 连续打卡 ${this.streak} 天`, x + THEME.spacing.lg, y + (h - THEME.fontSize.md) / 2, {
      fontSize: THEME.fontSize.md, fontWeight: '600', color: '#FF6B6B'
    })
    if (this.streakFreeze > 0) {
      ctx.font = `400 ${THEME.fontSize.sm}px ${THEME.fontFamily}`
      ctx.fillStyle = THEME.textSecondary
      ctx.textAlign = 'right'; ctx.textBaseline = 'top'
      ctx.fillText(`🧊 ${this.streakFreeze}`, x + w - THEME.spacing.lg, y + (h - THEME.fontSize.sm) / 2)
      ctx.textAlign = 'left'
    }
  }

  _drawFreezeCard(ctx, x, y, w) {
    const h = 100 * THEME.rpx
    fillRoundedRect(ctx, x, y, w, h, THEME.cardRadius, 'rgba(123,165,160,0.08)')
    strokeRoundedRect(ctx, x, y, w, h, THEME.cardRadius, 'rgba(123,165,160,0.15)', 1)

    if (this.canFreeze && this.streakFreeze > 0) {
      drawText(ctx, '断签了！使用补签卡恢复连续打卡', x + THEME.spacing.lg, y + THEME.spacing.md, {
        fontSize: THEME.fontSize.sm, color: THEME.textSecondary
      })
      const btnW = 160 * THEME.rpx; const btnH = 50 * THEME.rpx
      const btnX = x + THEME.spacing.lg; const btnY = y + h - THEME.spacing.md - btnH
      fillGradientRoundedRect(ctx, btnX, btnY, btnW, btnH, THEME.btnRadius, 135, [
        [0, THEME.primaryStart], [1, THEME.primaryEnd]
      ])
      drawCenteredText(ctx, '使用补签卡', btnX + btnW / 2, btnY + (btnH - THEME.fontSize.sm) / 2, {
        fontSize: THEME.fontSize.sm, fontWeight: '600', color: '#ffffff'
      })
      this._freezeBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH }
    } else {
      drawText(ctx, this.canFreeze ? '断签了！看视频领取补签卡' : `补签卡 x${this.streakFreeze} · 看视频再领一张`,
        x + THEME.spacing.lg, y + THEME.spacing.md, {
          fontSize: THEME.fontSize.sm, color: THEME.textSecondary
        })
    }
    const vbtnW = 240 * THEME.rpx; const vbtnH = 50 * THEME.rpx
    const vbtnX = x + w - THEME.spacing.lg - vbtnW; const vbtnY = y + h - THEME.spacing.md - vbtnH
    fillGradientRoundedRect(ctx, vbtnX, vbtnY, vbtnW, vbtnH, THEME.btnRadius, 135, [
      [0, '#7BA5A0'], [1, '#9CC5C0']
    ])
    drawCenteredText(ctx, '📺 看视频领补签卡', vbtnX + vbtnW / 2, vbtnY + (vbtnH - THEME.fontSize.sm) / 2, {
      fontSize: THEME.fontSize.sm, fontWeight: '600', color: '#ffffff'
    })
    this._freezeWatchRect = { x: vbtnX, y: vbtnY, w: vbtnW, h: vbtnH }
  }

  _drawChallengeBanner(ctx, x, y, w, modeName, ch) {
    const h = 96 * THEME.rpx
    const r = THEME.cardRadius
    const sp = THEME.spacing; const fs = THEME.fontSize; const rp = THEME.rpx

    // 背景：极淡的青绿色调（暗示"来自外部/社交"，但不抢眼）
    fillRoundedRect(ctx, x, y, w, h, r, 'rgba(123,165,160,0.08)')
    strokeRoundedRect(ctx, x, y, w, h, r, 'rgba(123,165,160,0.2)', 1)

    // 左侧文字（紧凑两行）
    drawText(ctx, '好友发起挑战', x + sp.lg, y + 28 * rp, {
      fontSize: fs.md, fontWeight: '700', color: '#9CC5C0'
    })
    const target = ch.score != null ? `目标 ${ch.score} 分` : '等你来战'
    drawText(ctx, `${modeName} · ${target}`, x + sp.lg, y + 28 * rp + fs.md + 4 * rp, {
      fontSize: fs.xs, color: THEME.textSecondary
    })

    // 接受按钮（右侧紧凑）
    const btnW = 180 * rp; const btnH = 52 * rp
    const btnX = x + w - sp.md - btnW; const btnY = y + (h - btnH) / 2
    fillGradientRoundedRect(ctx, btnX, btnY, btnW, btnH, THEME.btnRadius, 135, [[0, THEME.primaryStart], [1, THEME.primaryEnd]])
    drawCenteredText(ctx, '接受', btnX + btnW / 2, btnY + (btnH - fs.sm) / 2, {
      fontSize: fs.sm, fontWeight: '600', color: '#ffffff'
    })
    this._challengeAcceptRect = { x: btnX, y: btnY, w: btnW, h: btnH }

    // 关闭按钮（极简，右上角小圆点式）
    const cw = 44 * rp
    const closeX = x + w - sp.xs - cw; const closeY = y + sp.xs
    drawCenteredText(ctx, '×', closeX + cw / 2, closeY + cw / 2, {
      fontSize: fs.lg, color: THEME.textSecondary, baseline: 'middle'
    })
    this._challengeCloseRect = { x: closeX, y: closeY, w: cw, h: cw }
  }

  _drawSocialCard(ctx, x, y, w) {
    // 轻量行内操作栏：无卡片容器、无 emoji、纯文字链接风格
    // 用细分割线分隔，与整体暗色暖岩调融为一体而非"贴上去的补丁"
    const h = 72 * THEME.rpx
    const sp = THEME.spacing; const fs = THEME.fontSize; const rp = THEME.rpx

    // 顶部细分割线（比 cardBorder 更淡，暗示"分区"而非"卡片边界"）
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + w, y)
    ctx.strokeStyle = THEME.cardBorderLight
    ctx.lineWidth = 1
    ctx.stroke()

    // 三等分文字操作区，用竖线分隔
    const colW = w / 3
    const items = [
      { label: '分享给好友', rect: '_shareBtnRect' },
      { label: '群内排行', rect: '_groupRankBtnRect' },
      { label: '每日提醒', rect: '_subscribeBtnRect' }
    ]

    for (let i = 0; i < items.length; i++) {
      const cx = x + colW * i + colW / 2
      drawCenteredText(ctx, items[i].label, cx, y + h / 2, {
        fontSize: fs.sm,
        fontWeight: '500',
        color: THEME.textSecondary,
        baseline: 'middle'
      })
      this[items[i].rect] = { x: x + colW * i, y, w: colW, h }
      // 竖向分隔线（最后一项后不画）
      if (i < items.length - 1) {
        const divX = x + colW * (i + 1)
        ctx.beginPath()
        ctx.moveTo(divX, y + 16 * rp)
        ctx.lineTo(divX, y + h - 16 * rp)
        ctx.strokeStyle = THEME.cardBorderLight
        ctx.lineWidth = 1
        ctx.stroke()
      }
    }
  }

  _drawGroupRankOverlay(ctx) {
    const sw = THEME.screenWidth; const sh = THEME.screenHeight
    const sp = THEME.spacing; const fs = THEME.fontSize; const rp = THEME.rpx
    ctx.fillStyle = THEME.overlayBg
    ctx.fillRect(0, 0, sw, sh)
    const cardW = sw * 0.86; const cardH = 480 * rp
    const cardX = (sw - cardW) / 2; const cardY = (sh - cardH) / 2
    fillRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.modalBg)
    strokeRoundedRect(ctx, cardX, cardY, cardW, cardH, THEME.cardRadius, THEME.cardBorder, 1)
    // 标题区（无 emoji，干净文字）
    drawCenteredText(ctx, '群内排行', sw / 2, cardY + 44 * rp, {
      fontSize: fs.lg, fontWeight: '700', color: THEME.textPrimary
    })
    drawCenteredText(ctx, '当前显示个人最佳成绩，好友排行需服务端支持', sw / 2, cardY + 44 * rp + fs.lg + sp.xs, {
      fontSize: fs.xs, color: THEME.textSecondary
    })
    // 列表：模式名 + 最佳成绩（左对齐 + 右对齐）
    const best = app.globalData.userData.bestScores || {}
    let ry = cardY + 120 * rp
    const rowH = 48 * rp
    for (let i = 0; i < MODES.length; i++) {
      const m = MODES[i]
      const scores = best[m.id] || {}
      const keys = Object.keys(scores)
      let bestTxt = '—'
      if (keys.length > 0) {
        let maxV = null
        for (const k of keys) {
          const v = scores[k]
          if (typeof v === 'number' && (maxV === null || v > maxV)) maxV = v
        }
        if (maxV !== null) bestTxt = String(maxV)
      }
      drawText(ctx, m.name, cardX + sp.lg, ry + (rowH - fs.sm) / 2, { fontSize: fs.sm, color: THEME.textPrimary })
      drawText(ctx, bestTxt, cardX + cardW - sp.lg, ry + (rowH - fs.sm) / 2, {
        fontSize: fs.sm, color: THEME.textAccent, align: 'right'
      })
      // 行间细分割线（最后一行后不画）
      if (i < MODES.length - 1) {
        ctx.beginPath()
        ctx.moveTo(cardX + sp.lg, ry + rowH)
        ctx.lineTo(cardX + cardW - sp.lg, ry + rowH)
        ctx.strokeStyle = THEME.cardBorderLight
        ctx.lineWidth = 1
        ctx.stroke()
      }
      ry += rowH
    }
    // 关闭按钮
    const btnW = cardW - sp.lg * 2; const btnH = 60 * rp
    const btnX = cardX + sp.lg; const btnY = cardY + cardH - sp.lg - btnH
    fillGradientRoundedRect(ctx, btnX, btnY, btnW, btnH, THEME.btnRadius, 135, [[0, THEME.primaryStart], [1, THEME.primaryEnd]])
    drawCenteredText(ctx, '关闭', btnX + btnW / 2, btnY + (btnH - fs.sm) / 2, {
      fontSize: fs.sm, fontWeight: '600', color: '#ffffff'
    })
    this._groupRankCloseRect = { x: btnX, y: btnY, w: btnW, h: btnH }
  }

  _drawDailyCard(ctx, x, y, w) {
    const h = 140 * THEME.rpx
    const r = THEME.cardRadius
    const sp = THEME.spacing

    // 渐变背景
    fillGradientRoundedRect(ctx, x, y, w, h, r, 135, [
      [0, 'rgba(192,122,69,0.25)'], [1, 'rgba(212,165,116,0.18)']
    ])
    strokeRoundedRect(ctx, x, y, w, h, r, 'rgba(192,122,69,0.25)', 1)

    // 标签（右上角金色）
    const badgeW = 120 * THEME.rpx; const badgeH = 36 * THEME.rpx
    fillGradientRoundedRect(ctx, x + w - badgeW, y, badgeW, badgeH, 0, 135, [
      [0, '#FFD700'], [1, '#FFA500']
    ])
    // 圆角只在左下
    drawCenteredText(ctx, '每日挑战', x + w - badgeW / 2, y + (badgeH - THEME.fontSize.xs) / 2, {
      fontSize: THEME.fontSize.xs, fontWeight: '700', color: '#2A2320'
    })

    // 内容
    const ch = this.dailyChallenge
    const modeName = (MODES.find(m => m.id === ch.mode) || {}).name || ''
    const title = ch.level ? `${ch.level} ${modeName}` : modeName
    drawText(ctx, title, x + sp.lg, y + 50 * THEME.rpx, {
      fontSize: THEME.fontSize.lg, fontWeight: '700', color: THEME.textPrimary
    })
    drawText(ctx, '完成挑战获得额外奖励', x + sp.lg, y + 50 * THEME.rpx + THEME.fontSize.lg + sp.xs, {
      fontSize: THEME.fontSize.sm, color: 'rgba(255,255,255,0.7)'
    })

    // 箭头圆圈
    const arrowSize = 56 * THEME.rpx
    const arrowX = x + w - sp.lg - arrowSize; const arrowY = y + (h - arrowSize) / 2
    fillRoundedRect(ctx, arrowX, arrowY, arrowSize, arrowSize, arrowSize / 2, THEME.btnSecondaryBg)
    drawCenteredText(ctx, '→', arrowX + arrowSize / 2, arrowY + arrowSize / 2, {
      fontSize: THEME.fontSize.lg, color: THEME.textPrimary, baseline: 'middle'
    })
  }

  _drawTrainingCard(ctx, x, y, w) {
    const h = 100 * THEME.rpx
    const sp = THEME.spacing; const fs = THEME.fontSize

    fillGradientRoundedRect(ctx, x, y, w, h, THEME.cardRadius, 135, [
      [0, 'rgba(192,122,69,0.12)'], [1, 'rgba(212,165,116,0.08)']
    ])
    strokeRoundedRect(ctx, x, y, w, h, THEME.cardRadius, 'rgba(192,122,69,0.18)', 1)

    ctx.font = `${THEME.fontSize.xl}px ${THEME.fontFamily}`
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.fillText('📋', x + sp.lg, y + (h - THEME.fontSize.xl) / 2)

    drawText(ctx, '每日训练计划', x + sp.lg + THEME.fontSize.xl + sp.md, y + sp.md + sp.xs, {
      fontSize: fs.md, fontWeight: '700', color: THEME.textPrimary
    })
    drawText(ctx, '5天周期 · 每日3关 · 科学训练', x + sp.lg + THEME.fontSize.xl + sp.md, y + sp.md + fs.md + sp.sm, {
      fontSize: fs.xs, color: THEME.textSecondary
    })

    ctx.font = `${fs.lg}px ${THEME.fontFamily}`
    ctx.fillStyle = THEME.textSecondary
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('→', x + w - sp.lg, y + h / 2)
    ctx.textAlign = 'left'
  }

  _drawModeCard(ctx, x, y, w, mode) {
    const h = 130 * THEME.rpx
    const r = THEME.cardRadius
    const sp = THEME.spacing

    fillRoundedRect(ctx, x, y, w, h, r, THEME.cardBg)
    strokeRoundedRect(ctx, x, y, w, h, r, THEME.cardBorder, 1)

    // 图标容器（圆角方形渐变）
    const iconSize = 88 * THEME.rpx
    const iconX = x + sp.lg; const iconY = y + (h - iconSize) / 2
    fillGradientRoundedRect(ctx, iconX, iconY, iconSize, iconSize, 24 * THEME.rpx, 135, [
      [0, mode.gradient[0]], [1, mode.gradient[1]]
    ])
    ctx.font = `${THEME.fontSize.xl}px ${THEME.fontFamily}`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(mode.icon, iconX + iconSize / 2, iconY + iconSize / 2)

    // 文字（增大字号）
    const textX = iconX + iconSize + sp.md
    drawText(ctx, mode.name, textX, y + sp.md + sp.xs, {
      fontSize: THEME.fontSize.lg, fontWeight: '700', color: THEME.textPrimary
    })
    drawText(ctx, mode.desc, textX, y + sp.md + THEME.fontSize.lg + sp.sm, {
      fontSize: THEME.fontSize.sm, color: THEME.textSecondary
    })

    // 箭头
    ctx.font = `${THEME.fontSize.lg}px ${THEME.fontFamily}`
    ctx.fillStyle = THEME.textSecondary
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('→', x + w - sp.lg, y + h / 2)
    ctx.textAlign = 'left'
  }

  _drawStatsRow(ctx, x, y, w) {
    const h = 100 * THEME.rpx
    const itemW = (w - THEME.spacing.md * 2) / 3

    function formatBest(ms) {
      if (!ms) return '--'
      const s = Math.floor(ms / 1000)
      const m = Math.floor(s / 60)
      const sec = s % 60
      return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
    }

    const items = [
      { value: String(this.totalGames), label: '总局数' },
      { value: this.bestScores.schulte && this.bestScores.schulte[4] ? formatBest(this.bestScores.schulte[4]) : '--', label: '最佳4×4' },
      { value: this.bestScores.memory && this.bestScores.memory[6] ? `${this.bestScores.memory[6]}%` : '--', label: '最佳记忆' }
    ]
    items.forEach((item, i) => {
      const ix = x + i * (itemW + THEME.spacing.md)
      fillRoundedRect(ctx, ix, y, itemW, h, THEME.btnRadius, 'rgba(255,255,255,0.05)')
      strokeRoundedRect(ctx, ix, y, itemW, h, THEME.btnRadius, 'rgba(255,255,255,0.08)', 1)
      drawCenteredText(ctx, item.value, ix + itemW / 2, y + THEME.spacing.md, {
        fontSize: THEME.fontSize.lg, fontWeight: '700', color: THEME.textPrimary
      })
      drawCenteredText(ctx, item.label, ix + itemW / 2, y + THEME.spacing.md + THEME.fontSize.lg + THEME.spacing.xs, {
        fontSize: THEME.fontSize.xs, color: THEME.textSecondary
      })
    })
  }
}

module.exports = HomeScene
