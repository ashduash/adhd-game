const app = getApp()
const { RANKS, getRankProgress, formatSeconds } = require('../../utils/util')
const { ACHIEVEMENTS, getAchievementsByCategory } = require('../../utils/achievements')
const { checkContent, checkLocal, checkImage } = require('../../utils/sensitive-filter')

Page({
  data: {
    // 用户数据
    userData: null,
    rankInfo: null,
    rankProgress: 0,
    nextRank: null,
    pointsNeeded: 0,

    // 个人信息
    userInfo: { nickName: '', avatarUrl: '' },
    userId: '',

    // 统计数据
    stats: [],

    // 最佳成绩
    bestScores: [],

    // 成就列表
    achievementCategories: [],

    // 改名弹窗
    showRename: false,
    newNickName: '',

    // 广告
    bannerAdId: '',

    // 动画
    show: false
  },

  onLoad() {
    this.setData({ bannerAdId: app.getBannerAdId() })
    this.loadUserData()
    this.loadUserInfo()
    setTimeout(() => { this.setData({ show: true }) }, 100)
  },

  onShow() {
    this.loadUserData()
    this.loadUserInfo()
  },

  // 加载个人信息
  loadUserInfo() {
    const nickName = wx.getStorageSync('nickName') || ''
    const avatarUrl = wx.getStorageSync('avatarUrl') || ''
    // 生成脱敏用户ID（不显示真实openid）
    const openid = app.getOpenid()
    let userId = '未注册'
    if (openid) {
      // 使用 openid 的哈希值生成简短ID
      let hash = 0
      for (let i = 0; i < openid.length; i++) {
        hash = ((hash << 5) - hash) + openid.charCodeAt(i)
        hash |= 0
      }
      userId = 'U' + Math.abs(hash).toString(36).substring(0, 8).toUpperCase()
    }
    // 过滤敏感词昵称
    const safeNickName = checkLocal(nickName).pass ? nickName : ''
    this.setData({ userInfo: { nickName: safeNickName, avatarUrl }, userId })
  },

  // 点击头像区域 — 选择头像
  chooseAvatar() {
    wx.chooseAvatar({
      success: async (res) => {
        const tempPath = res.avatarUrl
        wx.showLoading({ title: '安全检测中...' })

        // 读取图片 base64 用于安全检测
        const fs = wx.getFileSystemManager()
        const base64 = fs.readFileSync(tempPath, 'base64')
        const check = await checkImage(base64, app.globalData.serverUrl)
        if (!check.pass) {
          wx.hideLoading()
          wx.showToast({ title: check.reason, icon: 'none' })
          return
        }

        // 上传到云存储
        wx.showLoading({ title: '上传中...' })
        const openid = app.getOpenid() || 'anonymous'
        const cloudPath = `avatars/${openid}_${Date.now()}.jpg`
        try {
          const uploadRes = await wx.cloud.uploadFile({ cloudPath, filePath: tempPath })
          const fileID = uploadRes.fileID

          // 保存到本地缓存
          wx.setStorageSync('avatarUrl', fileID)
          this.setData({ 'userInfo.avatarUrl': fileID })
          wx.hideLoading()
          wx.showToast({ title: '头像已更新', icon: 'success' })

          // 异步同步到服务器
          app.loginToServer(this.data.userInfo.nickName, fileID).catch(() => {})
        } catch (e) {
          wx.hideLoading()
          wx.showToast({ title: '上传失败，请重试', icon: 'none' })
        }
      }
    })
  },

  // 显示改名弹窗
  showRenameDialog() {
    this.setData({
      showRename: true,
      newNickName: this.data.userInfo.nickName
    })
  },

  // 隐藏改名弹窗
  hideRenameDialog() {
    this.setData({ showRename: false })
  },

  // 昵称输入
  onNickNameInput(e) {
    this.setData({ newNickName: e.detail.value })
  },

  // 确认改名
  async confirmRename() {
    const nickName = this.data.newNickName.trim()
    if (!nickName) {
      wx.showToast({ title: '昵称不能为空', icon: 'none' })
      return
    }

    wx.showLoading({ title: '内容检测中...' })

    // 内容安全检查（本地 + 服务端 msgSecCheck）
    const check = await checkContent(nickName, app.globalData.serverUrl)
    if (!check.pass) {
      wx.hideLoading()
      wx.showToast({ title: check.reason, icon: 'none' })
      return
    }

    wx.hideLoading()
    wx.setStorageSync('nickName', nickName)
    this.setData({ 'userInfo.nickName': nickName })
    this.hideRenameDialog()
    wx.showToast({ title: '昵称已更新', icon: 'success' })
    // 异步同步到服务器，不阻塞
    app.loginToServer(nickName, this.data.userInfo.avatarUrl).catch(() => {})
  },

  // 跳转关于页面
  goToAbout() {
    wx.navigateTo({ url: '/pages/about/about' })
  },

  // 广告加载失败
  onAdError() {},

  // 加载用户数据
  loadUserData() {
    const userData = app.globalData.userData
    const rankInfo = RANKS[userData.rank] || RANKS.bronze
    const { progress, nextRank, pointsNeeded } = getRankProgress(userData.rank, userData.rankPoints)

    // 统计数据
    const stats = [
      { label: '总局数', value: userData.totalGames, icon: '🎮' },
      { label: '当前段位', value: rankInfo.name, icon: rankInfo.icon },
      { label: '积分', value: userData.rankPoints, icon: '⭐' },
      { label: '打卡天数', value: userData.streak || 0, icon: '🔥' }
    ]

    // 最佳成绩
    const bs = userData.bestScores || {}
    const bestScores = [
      {
        mode: 'schulte', name: '数字风暴', icon: '⚡',
        scores: [
          { level: '3×3', time: bs.schulte[3] ? formatSeconds(Math.floor(bs.schulte[3] / 1000)) : '--' },
          { level: '4×4', time: bs.schulte[4] ? formatSeconds(Math.floor(bs.schulte[4] / 1000)) : '--' },
          { level: '5×5', time: bs.schulte[5] ? formatSeconds(Math.floor(bs.schulte[5] / 1000)) : '--' }
        ]
      },
      {
        mode: 'memory', name: '记忆还原', icon: '🧠',
        scores: [
          { level: '4位', time: bs.memory[4] ? formatSeconds(Math.floor(bs.memory[4] / 1000)) : '--' },
          { level: '6位', time: bs.memory[6] ? formatSeconds(Math.floor(bs.memory[6] / 1000)) : '--' },
          { level: '8位', time: bs.memory[8] ? formatSeconds(Math.floor(bs.memory[8] / 1000)) : '--' }
        ]
      },
      {
        mode: 'scan', name: '闪电扫视', icon: '👁️',
        scores: [
          { level: '15个', time: bs.scan[15] ? formatSeconds(Math.floor(bs.scan[15])) : '--' },
          { level: '20个', time: bs.scan[20] ? formatSeconds(Math.floor(bs.scan[20])) : '--' },
          { level: '25个', time: bs.scan[25] ? formatSeconds(Math.floor(bs.scan[25])) : '--' }
        ]
      },
      {
        mode: 'stroop', name: '斯特鲁普', icon: '🎭',
        scores: [
          { level: '15题', time: bs.stroop[15] ? bs.stroop[15] + '%' : '--' },
          { level: '25题', time: bs.stroop[25] ? bs.stroop[25] + '%' : '--' },
          { level: '35题', time: bs.stroop[35] ? bs.stroop[35] + '%' : '--' }
        ]
      },
      {
        mode: 'react', name: '极速反应', icon: '🎯',
        scores: [
          { level: '初级', time: bs.react.easy || '--' },
          { level: '中级', time: bs.react.normal || '--' },
          { level: '高级', time: bs.react.hard || '--' }
        ]
      },
      {
        mode: 'match', name: '色彩消除', icon: '🌈',
        scores: [
          { level: '4×4', time: bs.match[4] || '--' },
          { level: '5×5', time: bs.match[5] || '--' },
          { level: '6×6', time: bs.match[6] || '--' }
        ]
      },
      {
        mode: 'sort', name: '序列排序', icon: '📊',
        scores: [
          { level: '6项', time: bs.sort[6] ? formatSeconds(Math.floor(bs.sort[6] / 1000)) : '--' },
          { level: '8项', time: bs.sort[8] ? formatSeconds(Math.floor(bs.sort[8] / 1000)) : '--' },
          { level: '10项', time: bs.sort[10] ? formatSeconds(Math.floor(bs.sort[10] / 1000)) : '--' }
        ]
      },
      {
        mode: 'dual', name: '双线任务', icon: '🔀',
        scores: [
          { level: '初级', time: bs.dual.easy || '--' },
          { level: '中级', time: bs.dual.normal || '--' },
          { level: '高级', time: bs.dual.hard || '--' }
        ]
      }
    ]

    // 成就列表（按分类）
    const categories = getAchievementsByCategory()
    const achievementCategories = Object.keys(categories).map(cat => ({
      name: cat,
      items: categories[cat].map(a => ({
        ...a,
        unlocked: userData.achievements && userData.achievements.includes(a.id)
      }))
    }))

    this.setData({
      userData,
      rankInfo,
      rankProgress: progress,
      nextRank: nextRank ? RANKS[nextRank] : null,
      pointsNeeded,
      stats,
      bestScores,
      achievementCategories
    })
  },

  // 清除数据
  clearData() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有游戏数据吗？此操作不可恢复。',
      confirmColor: '#FF6B6B',
      success: (res) => {
        if (res.confirm) {
          app.clearAppData()
          app.globalData.userData = {
            rank: 'bronze',
            rankPoints: 0,
            bestScores: { schulte: {}, memory: {}, scan: {}, stroop: {}, react: {}, match: {}, sort: {}, dual: {} },
            achievements: [],
            totalGames: 0,
            lastPlayDate: null,
            streak: 0,
            streakFreeze: 0,
            dailyChallenge: { date: null, completed: false, mode: null, level: null },
            trainingPlan: { cycleStart: null, dayIndex: 0, completed: [] }
          }
          app.saveUserData()
          this.loadUserData()
          this.loadUserInfo()
          wx.showToast({ title: '数据已清除', icon: 'success' })
        }
      }
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `我在专注风暴达到了${this.data.rankInfo.name}段位，${this.data.userData.totalGames}局游戏经验！`,
      path: '/pages/index/index'
    }
  }
})
