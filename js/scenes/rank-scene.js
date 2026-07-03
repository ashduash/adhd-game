/**
 * 排行榜场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { RANKS } = require('../utils/util')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, fillShadowRoundedRect } = require('../base/draw-utils')
const { sanitizeNickName } = require('../utils/sensitive-filter')
const { loadAvatar } = require('../utils/avatar-loader')
const app = require('../app')

class RankScene extends Scene {
  constructor(params) {
    super(params)
    this._isTab = true
    this.isLoggedIn = false
    this.rankList = []
    this.myRank = null
    this.loading = false
    this._contentHeight = 0
    this._touchMoved = true
    this._loginBtnRect = null
    this._checkingNickName = false
    this._reportRects = []
    this._avatarImages = {}
  }

  onEnter() { this._checkLogin() }
  onShow() { this._touchMoved = true; this._checkLogin() }

  _checkLogin() {
    const nickName = wx.getStorageSync('nickName')
    if (nickName) {
      this.isLoggedIn = true
      this._loadRankData()
    } else {
      this.isLoggedIn = false
    }
  }

  async _loadRankData() {
    this.loading = true
    try {
      const data = await app.getRankList()
      if (data && data.rankList) {
        this.rankList = data.rankList
        this.myRank = data.myRank
        // 预加载所有用户头像
        const allUsers = [...(data.rankList || [])]
        if (data.myRank) allUsers.push(data.myRank)
        for (const user of allUsers) {
          if (user.avatarUrl && !this._avatarImages[user.avatarUrl]) {
            const fileId = user.avatarUrl
            loadAvatar(fileId, (img) => { this._avatarImages[fileId] = img })
          }
        }
      }
    } catch (e) {
      console.warn('加载排行榜失败:', e)
      GameGlobal.toast.show('排行榜加载失败', 2)
    }
    this.loading = false
  }

  async _handleLogin() {
    if (this._checkingNickName) return
    this._checkingNickName = true
    GameGlobal.toast.show('登录中...', 10)
    try {
      const nickName = wx.getStorageSync('nickName')
      if (!nickName) {
        GameGlobal.toast.show('请先在个人中心设置昵称', 3)
        return
      }
      const openid = await app.wxLogin()
      if (!openid) {
        GameGlobal.toast.show('登录失败，请稍后重试', 2)
        return
      }
      const avatarUrl = wx.getStorageSync('avatarUrl') || ''
      this.isLoggedIn = true
      await app.loginToServer(nickName, avatarUrl)
      await app.syncScoreToCloud(nickName, avatarUrl)
      this._loadRankData()
    } catch (e) {
      GameGlobal.toast.show('登录失败: ' + (e.message || '请检查网络后重试'), 2)
    } finally {
      this._checkingNickName = false
    }
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
    if (!this.isLoggedIn && this._loginBtnRect && this._hit(x, y, this._loginBtnRect)) {
      this._handleLogin()
      return
    }
    // 检查举报按钮点击
    for (const rect of this._reportRects) {
      if (rect && this._hit(x, y + this.scrollY, rect)) {
        this._openReport()
        return
      }
    }
  }


  onRender(ctx) {
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize; const pad = sp.xl
    let y = sp.xl + sp.lg + THEME.contentTopPadding
    this._reportRects = []

    // 标题
    drawCenteredText(ctx, '排行榜', sw / 2, y, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary })
    y += fs.xl + sp.xs
    drawCenteredText(ctx, '挑战全网玩家', sw / 2, y, { fontSize: fs.sm, color: THEME.textSecondary })
    y += fs.sm + sp.xl

    if (!this.isLoggedIn) {
      this._renderLoginCard(ctx, pad, y, sw - pad * 2)
      y += 360 * THEME.rpx
      this._reportRects = []
    } else if (this.loading) {
      drawCenteredText(ctx, '加载中...', sw / 2, y + 60 * THEME.rpx, { fontSize: fs.md, color: THEME.textSecondary })
      y += 200 * THEME.rpx
    } else {
      // 我的排名
      if (this.myRank) {
        this._renderMyRank(ctx, pad, y, sw - pad * 2)
        y += 120 * THEME.rpx + sp.md
      }

      // 排行榜列表
      if (this.rankList.length === 0) {
        drawCenteredText(ctx, '暂无数据，快来成为第一名！', sw / 2, y + 40 * THEME.rpx, { fontSize: fs.md, color: THEME.textSecondary })
        y += 120 * THEME.rpx
      } else {
        for (let i = 0; i < this.rankList.length; i++) {
          const item = this.rankList[i]
          this._renderRankItem(ctx, pad, y, sw - pad * 2, item, i)
          y += 90 * THEME.rpx + sp.sm
        }
        // 底部
        drawCenteredText(ctx, `— 共 ${this.rankList.length} 名玩家 —`, sw / 2, y + sp.sm, {
          fontSize: fs.xs, color: THEME.textSecondary
        })
        y += fs.xs + sp.lg
      }
    }

    y += sp.xxl
    this._contentHeight = y
    this.setMaxScroll(this._contentHeight)
  }

  _renderLoginCard(ctx, x, y, w) {
    const h = 320 * THEME.rpx; const sp = THEME.spacing; const fs = THEME.fontSize
    fillShadowRoundedRect(ctx, x, y, w, h, THEME.cardRadius, THEME.cardBg, 'rgba(0,0,0,0.15)', 10, 0, 2)
    strokeRoundedRect(ctx, x, y, w, h, THEME.cardRadius, THEME.cardBorder, 1)

    drawCenteredText(ctx, '🏆', x + w / 2, y + sp.xl, { fontSize: 64 * THEME.rpx })
    drawCenteredText(ctx, '登录后查看排行榜', x + w / 2, y + sp.xl + 80 * THEME.rpx, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary })
    drawCenteredText(ctx, '微信授权后即可参与排行', x + w / 2, y + sp.xl + 80 * THEME.rpx + fs.lg + sp.sm, { fontSize: fs.sm, color: THEME.textSecondary })

    // 登录按钮
    const btnW = w - sp.xl * 2; const btnH = 80 * THEME.rpx
    const btnX = x + sp.xl; const btnY = y + h - sp.xl - btnH
    fillGradientRoundedRect(ctx, btnX, btnY, btnW, btnH, THEME.btnRadius, 135, [
      [0, THEME.primaryStart], [1, THEME.primaryEnd]
    ])
    drawCenteredText(ctx, '登录并参与排行', btnX + btnW / 2, btnY + (btnH - fs.md) / 2, {
      fontSize: fs.md, fontWeight: '700', color: '#ffffff'
    })
    this._loginBtnRect = { x: btnX, y: btnY, w: btnW, h: btnH }
  }

  _renderMyRank(ctx, x, y, w) {
    const h = 120 * THEME.rpx; const sp = THEME.spacing; const fs = THEME.fontSize
    fillGradientRoundedRect(ctx, x, y, w, h, THEME.cardRadius, 135, [
      [0, 'rgba(192,122,69,0.12)'], [1, 'rgba(212,165,116,0.12)']
    ])
    strokeRoundedRect(ctx, x, y, w, h, THEME.cardRadius, 'rgba(192,122,69,0.25)', 1)

    // 排名
    const pos = this.myRank.position || '--'
    drawText(ctx, `#${pos}`, x + sp.lg, y + sp.md, { fontSize: fs.title, fontWeight: '700', color: THEME.primary })

    // 头像和名称
    const nameX = x + sp.lg + 80 * THEME.rpx
    const myAvatarUrl = this.myRank.avatarUrl
    const myAvatarImg = myAvatarUrl ? this._avatarImages[myAvatarUrl] : null
    if (myAvatarImg && myAvatarImg.loaded) {
      const avatarSize = 40 * THEME.rpx
      ctx.save()
      ctx.beginPath()
      ctx.arc(nameX + avatarSize / 2, y + sp.md + sp.xs + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(myAvatarImg, nameX, y + sp.md + sp.xs, avatarSize, avatarSize)
      ctx.restore()
    } else {
      drawText(ctx, '😊', nameX, y + sp.md + sp.xs, { fontSize: fs.xl })
    }
    drawText(ctx, sanitizeNickName(this.myRank.nickName) || '我', nameX + fs.xl + sp.sm, y + sp.md + sp.xs, {
      fontSize: fs.md, fontWeight: '600', color: THEME.textPrimary
    })
    const rankInfo = RANKS[this.myRank.rank] || RANKS.bronze
    drawText(ctx, `${rankInfo.icon} ${rankInfo.name}`, nameX + fs.xl + sp.sm, y + sp.md + fs.md + sp.sm + sp.xs, {
      fontSize: fs.xs, color: rankInfo.color
    })

    // 积分
    drawText(ctx, String(this.myRank.rankPoints || 0), x + w - sp.lg, y + sp.md + sp.xs, {
      fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary, align: 'right'
    })
    drawText(ctx, '积分', x + w - sp.lg, y + sp.md + fs.xl + sp.sm + sp.xs, {
      fontSize: fs.xs, color: THEME.textSecondary, align: 'right'
    })
  }

  _renderRankItem(ctx, x, y, w, item, index) {
    const h = 90 * THEME.rpx; const sp = THEME.spacing; const fs = THEME.fontSize
    const isMe = item.isMe
    fillRoundedRect(ctx, x, y, w, h, THEME.btnRadius, isMe ? 'rgba(192,122,69,0.12)' : THEME.cardBg)
    strokeRoundedRect(ctx, x, y, w, h, THEME.btnRadius, isMe ? 'rgba(192,122,69,0.25)' : THEME.cardBorder, 1)

    // 排名
    const medals = ['🥇', '🥈', '🥉']
    const posText = index < 3 ? '' : String(item.position)
    const posColor = index < 3 ? THEME.textPrimary : THEME.textSecondary
    if (index < 3) {
      ctx.font = `${THEME.fontSize.xl}px ${THEME.fontFamily}`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(medals[index], x + 40 * THEME.rpx, y + h / 2)
    } else {
      drawText(ctx, posText, x + 40 * THEME.rpx, y + (h - fs.md) / 2, {
        fontSize: fs.md, fontWeight: '600', color: posColor, align: 'center'
      })
    }

    // 头像
    const avatarX = x + 80 * THEME.rpx
    const avatarUrl = item.avatarUrl
    const avatarImg = avatarUrl ? this._avatarImages[avatarUrl] : null
    if (avatarImg && avatarImg.loaded) {
      const avatarSize = 36 * THEME.rpx
      ctx.save()
      ctx.beginPath()
      ctx.arc(avatarX + avatarSize / 2, y + h / 2, avatarSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(avatarImg, avatarX, y + (h - avatarSize) / 2, avatarSize, avatarSize)
      ctx.restore()
    } else {
      ctx.font = `${THEME.fontSize.lg}px ${THEME.fontFamily}`
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
      ctx.fillText(item.avatar || '😊', avatarX, y + h / 2)
    }

    // 名称和段位
    const nameX = avatarX + THEME.fontSize.lg + sp.sm
    drawText(ctx, sanitizeNickName(item.nickName) || '匿名', nameX, y + sp.md, {
      fontSize: fs.sm, fontWeight: '600', color: isMe ? THEME.primary : THEME.textPrimary
    })
    const ri = RANKS[item.rank] || RANKS.bronze
    drawText(ctx, `${ri.icon || '🥉'} ${ri.name || '青铜'}`, nameX, y + sp.md + fs.sm + sp.xs, {
      fontSize: fs.xs, color: ri.color || '#CD7F32'
    })

    // 积分
    drawText(ctx, String(item.rankPoints || 0), x + w - sp.lg - 50 * THEME.rpx, y + (h - fs.md) / 2, {
      fontSize: fs.md, fontWeight: '700', color: THEME.textPrimary, align: 'right'
    })

    // 举报按钮
    const reportSize = 40 * THEME.rpx
    const reportX = x + w - reportSize - sp.sm
    const reportY = y + (h - reportSize) / 2
    this._reportRects[index] = { x: reportX, y: reportY, w: reportSize, h: reportSize }
    // 举报按钮背景（圆形半透明）
    fillRoundedRect(ctx, reportX, reportY, reportSize, reportSize, reportSize / 2, 'rgba(255,255,255,0.08)')
    ctx.font = `${10 * THEME.rpx}px ${THEME.fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.fillText('举报', reportX + reportSize / 2, reportY + reportSize / 2)
    ctx.textAlign = 'left'
  }
}

module.exports = RankScene
