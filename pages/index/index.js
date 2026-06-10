const app = getApp()
const { RANKS, getRankProgress, formatSeconds } = require('../../utils/util')
const { generateDailyChallenge, getTodayString, calculateStreak, canUseStreakFreeze, useStreakFreeze } = require('../../utils/daily')

Page({
  data: {
    // 段位信息
    rankInfo: {},
    rankProgress: 0,
    nextRank: null,
    pointsNeeded: 0,

    // 玩法列表
    modes: [
      {
        id: 'schulte',
        name: '数字风暴',
        desc: '经典舒尔特方格',
        icon: '⚡',
        color: '#C07A45',
        gradient: 'linear-gradient(135deg, #C07A45 0%, #D4A574 100%)'
      },
      {
        id: 'memory',
        name: '记忆还原',
        desc: '挑战你的工作记忆',
        icon: '🧠',
        color: '#7BAE7F',
        gradient: 'linear-gradient(135deg, #7BAE7F 0%, #9CCF9F 100%)'
      },
      {
        id: 'scan',
        name: '闪电扫视',
        desc: '极速视觉搜索',
        icon: '👁️',
        color: '#D4915C',
        gradient: 'linear-gradient(135deg, #D4915C 0%, #E8B87C 100%)'
      },
      {
        id: 'stroop',
        name: '斯特鲁普',
        desc: '认知抑制挑战',
        icon: '🎭',
        color: '#C77D8A',
        gradient: 'linear-gradient(135deg, #C77D8A 0%, #E0A0AC 100%)'
      },
      {
        id: 'react',
        name: '极速反应',
        desc: '反应速度训练',
        icon: '🎯',
        color: '#7BA5A0',
        gradient: 'linear-gradient(135deg, #7BA5A0 0%, #9CC5C0 100%)'
      },
      {
        id: 'match',
        name: '色彩消除',
        desc: '消除配对挑战',
        icon: '🌈',
        color: '#D4A574',
        gradient: 'linear-gradient(135deg, #D4A574 0%, #C8965C 100%)'
      },
      {
        id: 'sort',
        name: '序列排序',
        desc: '顺序还原挑战',
        icon: '📊',
        color: '#9B8EC4',
        gradient: 'linear-gradient(135deg, #9B8EC4 0%, #B5AAD4 100%)'
      },
      {
        id: 'dual',
        name: '双线任务',
        desc: '多线程注意力',
        icon: '🔀',
        color: '#E17055',
        gradient: 'linear-gradient(135deg, #E17055 0%, #FF7675 100%)'
      }
    ],

    // 每日挑战
    dailyChallenge: null,

    // 连续打卡
    streak: 0,
    streakFreeze: 0,
    canFreeze: false,

    // 广告
    bannerAdId: '',

    // 统计数据
    totalGames: 0,
    bestScores: {},

    // 动画控制
    show: false,

    // 登录状态
    needsLogin: false,
    loginLoading: false,
    loginError: ''
  },

  onLoad() {
    this.setData({ bannerAdId: app.getBannerAdId() })
    this.updateUserInfo()
    this.updateDailyChallenge()
  },

  onShow() {
    this.updateUserInfo()
    this.setData({ needsLogin: !app.isLoggedIn() })
    setTimeout(() => {
      this.setData({ show: true })
    }, 100)
  },

  // 更新用户信息
  updateUserInfo() {
    const userData = app.globalData.userData
    const rankInfo = RANKS[userData.rank] || RANKS.bronze
    const { progress, nextRank, pointsNeeded } = getRankProgress(userData.rank, userData.rankPoints)

    this.setData({
      rankInfo,
      rankProgress: progress,
      nextRank: nextRank ? RANKS[nextRank] : null,
      pointsNeeded,
      totalGames: userData.totalGames,
      bestScores: userData.bestScores,
      streak: userData.streak || 0,
      streakFreeze: userData.streakFreeze || 0,
      canFreeze: canUseStreakFreeze(userData.lastPlayDate)
    })
  },

  // 更新每日挑战
  updateDailyChallenge() {
    const userData = app.globalData.userData
    const today = getTodayString()

    // 检查今日是否已有挑战
    if (userData.dailyChallenge && userData.dailyChallenge.date === today) {
      const challenge = userData.dailyChallenge
      const modeNames = {
        schulte: '数字风暴', memory: '记忆还原', scan: '闪电扫视',
        stroop: '斯特鲁普', react: '极速反应', match: '色彩消除',
        sort: '序列排序', dual: '双线任务'
      }
      this.setData({
        dailyChallenge: {
          ...challenge,
          title: `${challenge.level}${typeof challenge.level === 'number' ? '' : ''} ${modeNames[challenge.mode] || challenge.mode}`,
          target: '完成挑战',
          participants: Math.floor(1000 + Math.random() * 5000)
        }
      })
    } else {
      // 生成新的每日挑战
      const challenge = generateDailyChallenge()
      userData.dailyChallenge = {
        date: today,
        completed: false,
        mode: challenge.mode,
        level: challenge.level
      }
      app.saveUserData()
      this.setData({
        dailyChallenge: {
          ...challenge,
          completed: false
        }
      })
    }
  },

  // 微信登录
  async wxLogin() {
    if (this.data.loginLoading) return
    this.setData({ loginLoading: true, loginError: '' })
    try {
      await app.wxLogin()
      if (!wx.getStorageSync('nickName')) wx.setStorageSync('nickName', '玩家')
      app.loginToServer(wx.getStorageSync('nickName'), '').catch(() => {})
      this.setData({ needsLogin: false })
      this.updateUserInfo()
      wx.showToast({ title: '登录成功', icon: 'success' })
    } catch (e) {
      this.setData({ loginError: e.message || '登录失败，请重试' })
    } finally {
      this.setData({ loginLoading: false })
    }
  },

  // 看视频领补签卡
  async watchAdForFreeze() {
    const watched = await app.showRewardedAd()
    if (watched) {
      app.globalData.userData.streakFreeze++
      app.saveUserData()
      this.setData({ streakFreeze: app.globalData.userData.streakFreeze })
      wx.showToast({ title: '获得补签卡 x1', icon: 'success' })
    }
  },

  // 使用补签卡
  useStreakFreeze() {
    const userData = app.globalData.userData
    if (userData.streakFreeze <= 0) {
      wx.showToast({ title: '没有补签卡', icon: 'none' })
      return
    }

    const result = useStreakFreeze(userData.lastPlayDate, userData.streak)
    userData.streakFreeze--
    userData.lastPlayDate = result.lastPlayDate
    userData.streak = result.streak
    app.saveUserData()

    this.setData({
      streak: userData.streak,
      streakFreeze: userData.streakFreeze,
      canFreeze: false
    })
    wx.showToast({ title: '补签成功！', icon: 'success' })
  },

  // 广告加载失败
  onAdError() {},

  // 开始玩法
  startMode(e) {
    if (this.data.needsLogin) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    const { mode } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/${mode}/${mode}`
    })
  },

  // 开始每日挑战
  startDailyChallenge() {
    if (this.data.needsLogin) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    const { dailyChallenge } = this.data
    if (dailyChallenge) {
      wx.navigateTo({
        url: `/pages/${dailyChallenge.mode}/${dailyChallenge.mode}?level=${dailyChallenge.level}&daily=true`
      })
    }
  },

  // 进入训练计划
  startTraining() {
    if (this.data.needsLogin) { wx.showToast({ title: '请先登录', icon: 'none' }); return }
    wx.navigateTo({
      url: '/pages/training/training'
    })
  },

  // 查看排行榜
  viewRank() {
    wx.switchTab({
      url: '/pages/rank/rank'
    })
  },

  // 分享
  onShareAppMessage() {
    return {
      title: `我在专注风暴达到了${this.data.rankInfo.name}段位，连续打卡${this.data.streak}天！`,
      path: '/pages/index/index'
    }
  }
})
