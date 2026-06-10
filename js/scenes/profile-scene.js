/**
 * 个人中心场景
 */
const Scene = require('../base/scene')
const THEME = require('../config/theme')
const { RANKS, getRankProgress } = require('../utils/util')
const { getAchievementsByCategory } = require('../utils/achievements')
const { fillRoundedRect, strokeRoundedRect, drawText, drawCenteredText, fillGradientRoundedRect, drawArc, fillShadowRoundedRect, fillCircle } = require('../base/draw-utils')
const { checkLocal, checkContent, checkImage } = require('../utils/sensitive-filter')
const { loadAvatar, DEFAULT_AVATAR_EMOJI } = require('../utils/avatar-loader')
const app = require('../app')

const MODE_NAMES = {
  schulte: { name: '数字风暴', icon: '⚡' },
  memory: { name: '记忆还原', icon: '🧠' },
  scan: { name: '闪电扫视', icon: '👁️' },
  stroop: { name: '斯特鲁普', icon: '🎭' },
  react: { name: '极速反应', icon: '🎯' },
  match: { name: '色彩消除', icon: '🌈' },
  sort: { name: '序列排序', icon: '📊' },
  dual: { name: '双线任务', icon: '🔀' }
}

class ProfileScene extends Scene {
  constructor(params) {
    super(params)
    this._isTab = true
    this.rankInfo = null
    this.rankProgress = 0
    this.nextRank = null
    this.pointsNeeded = 0
    this.stats = []
    this.bestScores = []
    this.achievementCategories = []
    this._contentHeight = 0
    this._touchMoved = true
    this._renameRect = null
    this._themeRect = null
    this._soundRect = null
    this._aboutRect = null
    this._clearRect = null
    this._checkingNickName = false
  }

  onEnter() { this._refresh() }
  onShow() { this._refresh() }

  _refresh() {
    const ud = app.globalData.userData
    this.rankInfo = RANKS[ud.rank] || RANKS.bronze
    const { progress, nextRank, pointsNeeded } = getRankProgress(ud.rank, ud.rankPoints)
    this.rankProgress = progress
    this.nextRank = nextRank ? RANKS[nextRank] : null
    this.pointsNeeded = pointsNeeded

    // 加载头像
    const avatarUrl = wx.getStorageSync('avatarUrl') || ''
    this._avatarImage = null
    if (avatarUrl) {
      loadAvatar(avatarUrl, (img) => { this._avatarImage = img })
    }

    const nickName = wx.getStorageSync('nickName') || '点击设置昵称'
    const userId = app.getOpenid()
    this.nickName = nickName === '点击设置昵称' ? '点击设置昵称' : nickName
    this.userId = userId ? userId.substring(0, 16) : '未注册'

    this.stats = [
      { icon: '🎮', value: String(ud.totalGames), label: '总局数' },
      { icon: this.rankInfo.icon, value: this.rankInfo.name, label: '当前段位' },
      { icon: '⭐', value: String(ud.rankPoints), label: '段位积分' },
      { icon: '🔥', value: `${ud.streak || 0}天`, label: '连续打卡' }
    ]

    this.bestScores = []
    for (const mode of Object.keys(MODE_NAMES)) {
      const scores = ud.bestScores[mode] || {}
      const info = MODE_NAMES[mode]
      const items = []
      if (mode === 'schulte') {
        for (const lv of [4, 5, 6]) {
          const val = scores[lv]
          items.push({ level: `${lv}×${lv}`, time: val ? this._formatMs(val) : '--' })
        }
      } else if (mode === 'memory') {
        for (const lv of [4, 6, 8]) {
          const val = scores[lv]
          items.push({ level: `${lv}位`, time: val !== undefined ? `${val}%` : '--' })
        }
      } else if (mode === 'scan') {
        for (const lv of [16, 25, 36]) {
          const val = scores[lv]
          items.push({ level: `${lv}数`, time: val !== undefined ? `${val}个` : '--' })
        }
      } else if (mode === 'stroop') {
        for (const lv of [15, 25, 35]) {
          const val = scores[lv]
          items.push({ level: `${lv}题`, time: val !== undefined ? val : '--' })
        }
      } else if (mode === 'react') {
        for (const lv of ['easy', 'normal', 'hard']) {
          const val = scores[lv]
          const lvNames = { easy: '初级', normal: '中级', hard: '高级' }
          items.push({ level: lvNames[lv], time: val !== undefined ? val : '--' })
        }
      } else if (mode === 'match') {
        for (const lv of [4, 5, 6]) {
          const val = scores[lv]
          items.push({ level: `${lv}×${lv}`, time: val !== undefined ? val : '--' })
        }
      } else if (mode === 'sort') {
        for (const lv of [9, 16, 25, 36]) {
          const val = scores[lv]
          items.push({ level: `${lv}项`, time: val ? this._formatMs(val) : '--' })
        }
      } else if (mode === 'dual') {
        for (const lv of ['easy', 'normal', 'hard']) {
          const val = scores[lv]
          const lvNames = { easy: '初级', normal: '中级', hard: '高级' }
          items.push({ level: lvNames[lv], time: val !== undefined ? val : '--' })
        }
      }
      this.bestScores.push({ ...info, mode, items })
    }

    const cats = getAchievementsByCategory()
    this.achievementCategories = []
    for (const catName of Object.keys(cats)) {
      const items = cats[catName].map(a => ({
        ...a,
        unlocked: ud.achievements.includes(a.id)
      }))
      this.achievementCategories.push({ name: catName, items })
    }
  }

  _formatMs(ms) {
    if (!ms) return '--'
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
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

    // 清除数据确认弹窗
    if (this.showClearConfirm) {
      if (this._clearCancelRect && this._hit(x, y, this._clearCancelRect)) {
        this.showClearConfirm = false
        return
      }
      if (this._clearConfirmRect && this._hit(x, y, this._clearConfirmRect)) {
        this.showClearConfirm = false
        app.clearAppData()
        app.globalData.userData = {
          rank: 'bronze', rankPoints: 0,
          bestScores: { schulte: {}, memory: {}, scan: {}, stroop: {}, react: {}, match: {}, sort: {}, dual: {} },
          achievements: [], totalGames: 0, lastPlayDate: null, streak: 0, streakFreeze: 0,
          dailyChallenge: { date: null, completed: false, mode: null, level: null },
          trainingPlan: { cycleStart: null, dayIndex: 0, completed: [] }
        }
        app.saveUserData()
        this._refresh()
        GameGlobal.toast.show('数据已清除')
        return
      }
      return
    }

    const sy = this.scrollY

    // 点击头像 — 选择新头像
    if (this._avatarRect && this._hit(x, y + sy, this._avatarRect)) {
      wx.chooseImage({
        count: 1,
        sizeType: ['compressed'],
        sourceType: ['album', 'camera'],
        success: async (res) => {
          let tempPath = res.tempFilePaths[0]
          // 压缩图片避免 base64 过大导致上传失败
          try {
            const compRes = await new Promise((resolve, reject) => {
              wx.compressImage({ src: tempPath, quality: 60, success: resolve, fail: reject })
            })
            tempPath = compRes.tempFilePath
          } catch (_) {}
          const fs = wx.getFileSystemManager()
          const base64 = fs.readFileSync(tempPath, 'base64')
          // 安全检测（严格 fail-closed：检测不通过或异常时均拒绝上传）
          try {
            const check = await checkImage(base64, app.globalData.serverUrl)
            if (!check.pass) {
              GameGlobal.toast.show(check.reason || '图片检测未通过，请更换图片')
              return
            }
          } catch (_) {
            GameGlobal.toast.show('图片安全检测失败，请稍后重试')
            return
          }
          const openid = app.getOpenid() || ''
          const useCloud = wx.cloud && GameGlobal._cloudReady
          try {
            let avatarUrl = ''
            if (useCloud) {
              const cloudPath = `avatars/${openid}_${Date.now()}.jpg`
              const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: tempPath })
              avatarUrl = uploadRes.fileID
            } else {
              const avatarServerUrl = app.globalData.serverUrl + '/api/upload-avatar'
              const uploadRes = await new Promise((resolve, reject) => {
                wx.request({
                  url: avatarServerUrl,
                  method: 'POST',
                  data: { openid, imageBase64: base64 },
                  timeout: 15000,
                  success: (r) => {
                    r.data && r.data.success ? resolve(r.data) : reject(new Error(r.data?.error || '服务端返回失败'))
                  },
                  fail: (err) => {
                    reject(new Error('网络请求失败: ' + (err.errMsg || '')))
                  }
                })
              })
              avatarUrl = app.globalData.serverUrl + uploadRes.avatarUrl
            }
            wx.setStorageSync('avatarUrl', avatarUrl)
            loadAvatar(avatarUrl, (img) => { this._avatarImage = img })
            app.loginToServer(wx.getStorageSync('nickName'), avatarUrl).catch(() => {})
            GameGlobal.toast.show('头像已更新')
          } catch (_) {
            GameGlobal.toast.show('上传失败: ' + (e.message || '未知错误'))
          }
        },
        fail: (err) => {
          if (err.errMsg && !err.errMsg.includes('cancel')) {
            GameGlobal.toast.show('选择头像失败')
          }
        }
      })
      return
    }

    if (this._renameRect && this._hit(x, y + sy, this._renameRect)) {
      if (this._checkingNickName) return
      wx.showModal({
        title: '修改昵称',
        editable: true,
        placeholderText: '请输入新昵称（最多12字）',
        success: async (res) => {
          if (res.confirm && res.content && res.content.trim()) {
            const nickName = res.content.trim().substring(0, 12)
            // 先做本地快速检测
            const localCheck = checkLocal(nickName)
            if (!localCheck.pass) {
              GameGlobal.toast.show(localCheck.reason)
              return
            }
            // 阻塞等待内容安全检测结果
            this._checkingNickName = true
            GameGlobal.toast.show('内容审核中...', 10)
            try {
              const check = await checkContent(nickName, app.globalData.serverUrl)
              if (!check.pass) {
                GameGlobal.toast.show(check.reason, 2)
                return
              }
              wx.setStorageSync('nickName', nickName)
              app.syncScoreToCloud().catch(e => console.warn("分数同步失败:", e))
              this._refresh()
              GameGlobal.toast.show('昵称已修改')
            } finally {
              this._checkingNickName = false
            }
          }
        }
      })
      return
    }
    if (this._aboutRect && this._hit(x, y + sy, this._aboutRect)) {
      GameGlobal.sceneManager.push('about')
      return
    }
    if (this._themeRect && this._hit(x, y + sy, this._themeRect)) {
      this._showThemeSelector()
      return
    }
    if (this._soundRect && this._hit(x, y + sy, this._soundRect)) {
      if (GameGlobal.audio) {
        const muted = !GameGlobal.audio.isMuted()
        GameGlobal.audio.setMuted(muted)
        GameGlobal.toast.show(muted ? '音效已关闭' : '音效已开启')
      }
      return
    }
    if (this._clearRect && this._hit(x, y + sy, this._clearRect)) {
      this.showClearConfirm = true
      return
    }
  }

  _hit(px, py, r) { return px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h }

  _showThemeSelector() {
    const { getTheme } = require('../config/theme')
    const currentTheme = getTheme()
    wx.showActionSheet({
      itemList: ['深色主题', '浅色主题'],
      itemColor: '#C07A45',
      success: (res) => {
        const themes = ['dark', 'white']
        const selectedTheme = themes[res.tapIndex]
        if (selectedTheme !== currentTheme) {
          app.saveTheme(selectedTheme)
          this._refresh()
          GameGlobal.toast.show(selectedTheme === 'white' ? '已切换到浅色主题' : '已切换到深色主题')
        }
      }
    })
  }

  onRender(ctx) {
    const sw = THEME.screenWidth; const sp = THEME.spacing; const fs = THEME.fontSize; const pad = sp.xl
    let y = sp.xl + sp.lg + THEME.contentTopPadding

    // 标题
    drawCenteredText(ctx, '个人中心', sw / 2, y, { fontSize: fs.xl, fontWeight: '700', color: THEME.textPrimary })
    y += fs.xl + sp.lg

    // 用户卡片
    const cardW = sw - pad * 2
    this._drawUserCard(ctx, pad, y, cardW)
    y += 140 * THEME.rpx + sp.md

    // 菜单项
    this._renameRect = { x: pad, y, w: cardW, h: 70 * THEME.rpx }
    this._drawMenuItem(ctx, pad, y, cardW, '✏️', '修改昵称')
    y += 70 * THEME.rpx + sp.xs
    this._themeRect = { x: pad, y, w: cardW, h: 70 * THEME.rpx }
    this._drawMenuItem(ctx, pad, y, cardW, '🎨', '主题设置')
    y += 70 * THEME.rpx + sp.xs
    this._soundRect = { x: pad, y, w: cardW, h: 70 * THEME.rpx }
    this._drawSoundToggle(ctx, pad, y, cardW)
    y += 70 * THEME.rpx + sp.xs
    this._aboutRect = { x: pad, y, w: cardW, h: 70 * THEME.rpx }
    this._drawMenuItem(ctx, pad, y, cardW, 'ℹ️', '关于')
    y += 70 * THEME.rpx + sp.lg

    // 段位卡片
    this._drawRankCard(ctx, pad, y, cardW)
    y += 200 * THEME.rpx + sp.md

    // 统计数据
    const statW = (cardW - sp.md) / 2
    const statH = 100 * THEME.rpx
    for (let i = 0; i < this.stats.length; i++) {
      const col = i % 2; const row = Math.floor(i / 2)
      const sx = pad + col * (statW + sp.md)
      const sy = y + row * (statH + sp.md)
      const st = this.stats[i]
      fillRoundedRect(ctx, sx, sy, statW, statH, THEME.btnRadius, THEME.cardBg)
      strokeRoundedRect(ctx, sx, sy, statW, statH, THEME.btnRadius, THEME.cardBorder, 1)
      drawText(ctx, st.icon, sx + sp.md, sy + sp.md, { fontSize: fs.lg })
      drawText(ctx, st.value, sx + sp.md + fs.lg + sp.sm, sy + sp.md, { fontSize: fs.lg, fontWeight: '700', color: THEME.textPrimary })
      drawText(ctx, st.label, sx + sp.md + fs.lg + sp.sm, sy + sp.md + fs.lg + sp.sm, { fontSize: fs.xs, color: THEME.textSecondary })
    }
    y += 2 * (statH + sp.md) + sp.lg

    // 最佳成绩
    drawText(ctx, '最佳成绩', pad, y, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary })
    y += fs.lg + sp.md

    for (const bs of this.bestScores) {
      fillRoundedRect(ctx, pad, y, cardW, 140 * THEME.rpx, THEME.cardRadius, THEME.cardBg)
      strokeRoundedRect(ctx, pad, y, cardW, 140 * THEME.rpx, THEME.cardRadius, THEME.cardBorder, 1)
      drawText(ctx, `${bs.icon} ${bs.name}`, pad + sp.lg, y + sp.md, { fontSize: fs.md, fontWeight: '600', color: THEME.textPrimary })
      const colW = cardW / 3
      for (let j = 0; j < bs.items.length; j++) {
        const item = bs.items[j]
        const cx = pad + sp.lg + j * colW
        drawText(ctx, item.level, cx, y + sp.md + fs.md + sp.sm, { fontSize: fs.xs, color: THEME.textSecondary })
        drawText(ctx, item.time, cx, y + sp.md + fs.md + sp.sm + fs.xs + sp.xs, { fontSize: fs.sm, fontWeight: '600', color: THEME.textPrimary })
      }
      y += 140 * THEME.rpx + sp.md
    }

    // 成就
    for (const cat of this.achievementCategories) {
      drawText(ctx, cat.name, pad, y, { fontSize: fs.lg, fontWeight: '600', color: THEME.textPrimary })
      y += fs.lg + sp.md

      const achW = (cardW - sp.md) / 2; const achH = 100 * THEME.rpx
      for (let i = 0; i < cat.items.length; i++) {
        const col = i % 2; const row = Math.floor(i / 2)
        const ax = pad + col * (achW + sp.md)
        const ay = y + row * (achH + sp.md)
        const ach = cat.items[i]
        const unlocked = ach.unlocked
        fillRoundedRect(ctx, ax, ay, achW, achH, THEME.btnRadius, unlocked ? 'rgba(192,122,69,0.1)' : THEME.cardBg)
        strokeRoundedRect(ctx, ax, ay, achW, achH, THEME.btnRadius, unlocked ? 'rgba(192,122,69,0.25)' : THEME.cardBorder, 1)
        drawText(ctx, unlocked ? ach.icon : '🔒', ax + sp.md, ay + sp.md, { fontSize: fs.lg })
        drawText(ctx, ach.name, ax + sp.md + fs.lg + sp.sm, ay + sp.md, {
          fontSize: fs.xs, fontWeight: '600', color: unlocked ? THEME.textPrimary : THEME.textSecondary
        })
        drawText(ctx, ach.desc, ax + sp.md + fs.lg + sp.sm, ay + sp.md + fs.xs + sp.xs, {
          fontSize: 10 * THEME.rpx, color: THEME.textSecondary
        })
      }
      const rows = Math.ceil(cat.items.length / 2)
      y += rows * (achH + sp.md) + sp.md
    }

    // 清除数据按钮
    y += sp.md
    const btnW = cardW; const btnH = 80 * THEME.rpx
    this._clearRect = { x: pad, y, w: btnW, h: btnH }
    fillRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, 'rgba(255,107,107,0.15)')
    strokeRoundedRect(ctx, pad, y, btnW, btnH, THEME.btnRadius, 'rgba(255,107,107,0.3)', 1)
    drawCenteredText(ctx, '清除数据', pad + btnW / 2, y + (btnH - fs.md) / 2, {
      fontSize: fs.md, fontWeight: '600', color: '#FF6B6B'
    })
    y += btnH + sp.lg

    // 版本信息
    drawCenteredText(ctx, '专注风暴 v1.0.0', sw / 2, y, { fontSize: fs.xs, color: THEME.textSecondary })
    y += fs.xs + sp.xxl

    this._contentHeight = y
    this.setMaxScroll(this._contentHeight)

    // 清除数据确认弹窗（Canvas 版）
    if (this.showClearConfirm) {
      ctx.save()
      const dpr = ctx.canvas.width / THEME.screenWidth
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // 重置滚动偏移，保留 DPR 缩放
      ctx.fillStyle = THEME.overlayBg
      ctx.fillRect(0, 0, THEME.screenWidth, THEME.screenHeight)
      const cW = THEME.screenWidth * 0.75; const cH = 200 * THEME.rpx
      const cX = (THEME.screenWidth - cW) / 2; const cY = (THEME.screenHeight - cH) / 2
      fillRoundedRect(ctx, cX, cY, cW, cH, THEME.cardRadius, THEME.modalBg)
      strokeRoundedRect(ctx, cX, cY, cW, cH, THEME.cardRadius, THEME.cardBorder, 1)
      drawCenteredText(ctx, '确认清除', THEME.screenWidth / 2, cY + THEME.spacing.xl, { fontSize: THEME.fontSize.lg, fontWeight: '700', color: THEME.textPrimary })
      drawCenteredText(ctx, '清除后所有数据将无法恢复', THEME.screenWidth / 2, cY + THEME.spacing.xl + THEME.fontSize.lg + THEME.spacing.md, { fontSize: THEME.fontSize.md, color: THEME.textSecondary })
      const bH = 60 * THEME.rpx; const bY = cY + cH - bH - THEME.spacing.lg
      const bW = (cW - THEME.spacing.xl * 2 - THEME.spacing.md) / 2
      this._clearCancelRect = { x: cX + THEME.spacing.xl, y: bY, w: bW, h: bH }
      this._clearConfirmRect = { x: cX + THEME.spacing.xl + bW + THEME.spacing.md, y: bY, w: bW, h: bH }
      fillRoundedRect(ctx, cX + THEME.spacing.xl, bY, bW, bH, THEME.btnRadius, THEME.cardBg)
      strokeRoundedRect(ctx, cX + THEME.spacing.xl, bY, bW, bH, THEME.btnRadius, THEME.cardBorder, 1)
      drawCenteredText(ctx, '取消', cX + THEME.spacing.xl + bW / 2, bY + bH / 2, { fontSize: THEME.fontSize.md, color: THEME.textSecondary, baseline: 'middle' })
      fillGradientRoundedRect(ctx, cX + THEME.spacing.xl + bW + THEME.spacing.md, bY, bW, bH, THEME.btnRadius, 135, [[0, '#FF6B6B'], [1, '#FF4757']])
      drawCenteredText(ctx, '清除', cX + THEME.spacing.xl + bW + THEME.spacing.md + bW / 2, bY + bH / 2, { fontSize: THEME.fontSize.md, fontWeight: '600', color: '#ffffff', baseline: 'middle' })
      ctx.restore()
    }
  }

  _drawUserCard(ctx, x, y, w) {
    const h = 140 * THEME.rpx; const sp = THEME.spacing; const fs = THEME.fontSize
    fillShadowRoundedRect(ctx, x, y, w, h, THEME.cardRadius, THEME.cardBg, 'rgba(0,0,0,0.15)', 10, 0, 2)
    strokeRoundedRect(ctx, x, y, w, h, THEME.cardRadius, THEME.cardBorder, 1)

    // 头像
    const avatarSize = 60 * THEME.rpx
    const avatarX = x + sp.lg
    const avatarY = y + (h - avatarSize) / 2
    if (this._avatarImage && this._avatarImage.loaded) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(this._avatarImage, avatarX, avatarY, avatarSize, avatarSize)
      ctx.restore()
      ctx.beginPath()
      ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
      ctx.strokeStyle = 'rgba(192, 122, 69, 0.35)'
      ctx.lineWidth = 1
      ctx.stroke()
    } else {
      fillGradientRoundedRect(ctx, avatarX, avatarY, avatarSize, avatarSize, avatarSize / 2, 135, [
        [0, THEME.primaryStart], [1, THEME.primaryEnd]
      ])
      ctx.font = `${fs.xl}px ${THEME.fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText(DEFAULT_AVATAR_EMOJI, avatarX + avatarSize / 2, avatarY + avatarSize / 2)
    }

    // 记录头像区域用于点击检测
    this._avatarRect = { x: avatarX, y: avatarY, w: avatarSize, h: avatarSize }

    // 昵称和ID
    const textX = x + sp.lg + avatarSize + sp.md
    drawText(ctx, this.nickName, textX, y + sp.lg, { fontSize: fs.md, fontWeight: '600', color: THEME.textPrimary })
    drawText(ctx, `ID: ${this.userId}`, textX, y + sp.lg + fs.md + sp.sm, { fontSize: fs.xs, color: THEME.textSecondary })
  }

  _drawMenuItem(ctx, x, y, w, icon, text) {
    const h = 70 * THEME.rpx; const sp = THEME.spacing; const fs = THEME.fontSize
    fillRoundedRect(ctx, x, y, w, h, THEME.btnRadius, THEME.cardBg)
    strokeRoundedRect(ctx, x, y, w, h, THEME.btnRadius, THEME.cardBorder, 1)
    drawText(ctx, icon, x + sp.lg, y + (h - fs.md) / 2, { fontSize: fs.md })
    drawText(ctx, text, x + sp.lg + fs.md + sp.sm, y + (h - fs.md) / 2, { fontSize: fs.sm, color: THEME.textPrimary })
    ctx.font = `${fs.md}px ${THEME.fontFamily}`; ctx.fillStyle = THEME.textSecondary; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    ctx.fillText('›', x + w - sp.lg, y + h / 2); ctx.textAlign = 'left'
  }

  _drawSoundToggle(ctx, x, y, w) {
    const h = 70 * THEME.rpx; const sp = THEME.spacing; const fs = THEME.fontSize
    const soundOn = GameGlobal.audio && !GameGlobal.audio.isMuted()
    fillRoundedRect(ctx, x, y, w, h, THEME.btnRadius, THEME.cardBg)
    strokeRoundedRect(ctx, x, y, w, h, THEME.btnRadius, THEME.cardBorder, 1)
    drawText(ctx, soundOn ? '🔊' : '🔇', x + sp.lg, y + (h - fs.md) / 2, { fontSize: fs.md })
    drawText(ctx, '音效', x + sp.lg + fs.md + sp.sm, y + (h - fs.md) / 2, { fontSize: fs.sm, color: THEME.textPrimary })
    const trackW = 48 * THEME.rpx; const trackH = 28 * THEME.rpx; const trackR = trackH / 2
    const trackX = x + w - sp.lg - trackW; const trackY = y + (h - trackH) / 2
    const trackColor = soundOn ? THEME.primary : 'rgba(255,255,255,0.15)'
    fillRoundedRect(ctx, trackX, trackY, trackW, trackH, trackR, trackColor)
    const knobR = 10 * THEME.rpx
    const knobX = soundOn ? trackX + trackW - knobR - 4 * THEME.rpx : trackX + knobR + 4 * THEME.rpx
    fillCircle(ctx, knobX, trackY + trackH / 2, knobR, '#ffffff')
  }

  _drawRankCard(ctx, x, y, w) {
    const h = 200 * THEME.rpx; const sp = THEME.spacing; const fs = THEME.fontSize
    fillShadowRoundedRect(ctx, x, y, w, h, THEME.cardRadius, THEME.cardBg, 'rgba(0,0,0,0.15)', 10, 0, 2)
    strokeRoundedRect(ctx, x, y, w, h, THEME.cardRadius, THEME.cardBorder, 1)

    // 段位图标
    const iconSize = 60 * THEME.rpx
    fillRoundedRect(ctx, x + sp.lg, y + sp.lg, iconSize, iconSize, iconSize / 2,
      (this.rankInfo.color || '#CD7F32') + '20')
    ctx.font = `${THEME.fontSize.xl}px ${THEME.fontFamily}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(this.rankInfo.icon || '🥉', x + sp.lg + iconSize / 2, y + sp.lg + iconSize / 2)

    // 段位名称和积分
    drawText(ctx, this.rankInfo.name || '青铜', x + sp.lg + iconSize + sp.md, y + sp.lg + sp.xs, {
      fontSize: fs.xl, fontWeight: '700', color: this.rankInfo.color || '#CD7F32'
    })
    drawText(ctx, `${app.globalData.userData.rankPoints} 积分`, x + sp.lg + iconSize + sp.md, y + sp.lg + fs.xl + sp.sm, {
      fontSize: fs.sm, color: THEME.textSecondary
    })

    // 进度条
    const barY = y + h - sp.lg - 30 * THEME.rpx
    const barX = x + sp.lg; const barW = w - sp.lg * 2; const barH = 12 * THEME.rpx
    fillRoundedRect(ctx, barX, barY, barW, barH, barH / 2, THEME.cardBgLight)
    const fillW = barW * Math.min(1, this.rankProgress)
    if (fillW > 0) fillRoundedRect(ctx, barX, barY, fillW, barH, barH / 2, this.rankInfo.color || '#CD7F32')

    if (this.nextRank) {
      drawText(ctx, `距离${this.nextRank.name} 还需${this.pointsNeeded}分`, barX, barY + barH + sp.xs, {
        fontSize: fs.xs, color: THEME.textSecondary
      })
    } else {
      drawText(ctx, '已达最高段位！', barX, barY + barH + sp.xs, { fontSize: fs.xs, color: '#FFD700' })
    }
  }
}

module.exports = ProfileScene
