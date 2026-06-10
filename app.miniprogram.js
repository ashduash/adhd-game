const ads = require('./utils/ads')

App({
  globalData: {
    userInfo: null,
    openid: null,
    // 已解锁皮肤（默认解锁 night）
    unlockedSkins: ['night'],
    // 用户数据
    userData: {
      rank: 'bronze',           // 段位
      rankPoints: 0,            // 段位积分
      bestScores: {             // 最佳成绩
        schulte: {},
        memory: {},
        scan: {},
        stroop: {},
        react: {},
        match: {},
        sort: {},
        dual: {}
      },
      achievements: [],         // 成就列表
      totalGames: 0,            // 总局数
      lastPlayDate: null,       // 上次游玩日期
      streak: 0,                // 连续打卡天数
      streakFreeze: 0,          // 补签卡数量
      dailyChallenge: {         // 每日挑战状态
        date: null,
        completed: false,
        mode: null,
        level: null
      },
      trainingPlan: {           // 训练计划
        cycleStart: null,
        dayIndex: 0,
        completed: []
      }
    }
  },

  onLaunch() {
    // 初始化云开发（用于内容安全检测）
    if (typeof wx !== 'undefined' && wx.cloud) {
      wx.cloud.init({
        env: 'cloud1-d3g8g2icn594133d1', // 云开发环境ID
        traceUser: true
      })
    }

    // 服务器地址（本地开发用）
    this.globalData.serverUrl = 'http://localhost:3000'

    // 初始化广告
    ads.createRewardedAd()
    ads.createInterstitialAd()

    // 加载已解锁皮肤
    const unlockedSkins = wx.getStorageSync('unlockedSkins')
    if (unlockedSkins && unlockedSkins.length > 0) {
      this.globalData.unlockedSkins = unlockedSkins
    }

    // 加载本地存储的用户数据
    const userData = wx.getStorageSync('userData')
    if (userData) {
      // 数据迁移：确保新字段存在
      if (!userData.bestScores) userData.bestScores = {}
      if (!userData.bestScores.schulte) userData.bestScores.schulte = {}
      if (!userData.bestScores.memory) userData.bestScores.memory = {}
      if (!userData.bestScores.scan) userData.bestScores.scan = {}
      if (!userData.bestScores.stroop) userData.bestScores.stroop = {}
      if (!userData.bestScores.react) userData.bestScores.react = {}
      if (!userData.bestScores.match) userData.bestScores.match = {}
      if (!userData.bestScores.sort) userData.bestScores.sort = {}
      if (!userData.bestScores.dual) userData.bestScores.dual = {}
      if (userData.streak === undefined) userData.streak = 0
      if (userData.streakFreeze === undefined) userData.streakFreeze = 0
      if (!userData.dailyChallenge) userData.dailyChallenge = { date: null, completed: false, mode: null, level: null }
      if (!userData.trainingPlan) userData.trainingPlan = { cycleStart: null, dayIndex: 0, completed: [] }
      if (!userData.achievements) userData.achievements = []
      this.globalData.userData = userData
    }
  },

  // 保存用户数据
  saveUserData() {
    wx.setStorageSync('userData', this.globalData.userData)
  },

  // 更新最佳成绩
  updateBestScore(mode, level, score) {
    const bestScores = this.globalData.userData.bestScores
    // 分数越高越好的游戏
    const higherBetter = ['match']
    const isNew = higherBetter.includes(mode)
      ? (!bestScores[mode][level] || score > bestScores[mode][level])
      : (!bestScores[mode][level] || score < bestScores[mode][level])
    if (isNew) {
      bestScores[mode][level] = score
      this.saveUserData()
      return true
    }
    return false
  },

  // 添加段位积分
  addRankPoints(points) {
    const ranks = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'king']
    const rankNames = ['青铜', '白银', '黄金', '铂金', '钻石', '大师', '王者']
    const pointsNeeded = [0, 100, 300, 600, 1000, 1500, 2000]

    this.globalData.userData.rankPoints += points

    // 检查是否升段
    const currentRankIndex = ranks.indexOf(this.globalData.userData.rank)
    let newRankIndex = currentRankIndex

    for (let i = currentRankIndex + 1; i < ranks.length; i++) {
      if (this.globalData.userData.rankPoints >= pointsNeeded[i]) {
        newRankIndex = i
      } else {
        break
      }
    }

    if (newRankIndex > currentRankIndex) {
      this.globalData.userData.rank = ranks[newRankIndex]
      this.saveUserData()
      return {
        promoted: true,
        newRank: rankNames[newRankIndex],
        newRankKey: ranks[newRankIndex]
      }
    }

    this.saveUserData()
    return { promoted: false }
  },

  // 清除所有应用数据（不清除云SDK缓存，避免触发原生视图崩溃）
  clearAppData() {
    const appKeys = [
      'userData', 'openid', 'nickName', 'avatarUrl',
      'unlockedSkins', 'appTheme', 'local_openid',
      'guided_games', 'schulte_paused', 'soundEnabled', 'skin'
    ]
    for (const key of appKeys) {
      wx.removeStorageSync(key)
    }
    this.globalData.openid = null
  },

  // 生成或获取本地openid（仅已注册用户可用）
  getOpenid() {
    const nickName = wx.getStorageSync('nickName')
    if (!nickName) return null
    if (this.globalData.openid) return this.globalData.openid
    let openid = wx.getStorageSync('openid')
    if (!openid) {
      openid = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 8)
      wx.setStorageSync('openid', openid)
    }
    this.globalData.openid = openid
    return openid
  },

  // 重置 openid（清除数据时调用）
  resetOpenid() {
    this.globalData.openid = null
    wx.removeStorageSync('openid')
  },

  // 检查是否已通过微信登录
  isLoggedIn() {
    const openid = this.globalData.openid || wx.getStorageSync('openid')
    return !!openid && !openid.startsWith('user_')
  },

  // 微信登录（wx.login + 服务端换 openid，服务端不可用时用本地 openid）
  wxLogin() {
    return new Promise((resolve) => {
      wx.login({
        success: (loginRes) => {
          if (!loginRes.code) { this._loginFallback(resolve); return }
          wx.request({
            url: this.globalData.serverUrl + '/api/wxlogin',
            method: 'POST',
            data: { code: loginRes.code },
            timeout: 8000,
            success: (res) => {
              if (res.data && res.data.openid) {
                this.globalData.openid = res.data.openid
                wx.setStorageSync('openid', res.data.openid)
                resolve(res.data.openid)
              } else {
                this._loginFallback(resolve)
              }
            },
            fail: () => this._loginFallback(resolve)
          })
        },
        fail: () => this._loginFallback(resolve)
      })
    })
  },

  _loginFallback(resolve) {
    let cached = wx.getStorageSync('local_openid')
    if (!cached) {
      const sys = wx.getSystemInfoSync()
      const raw = sys.brand + '|' + sys.model + '|' + sys.system + '|' + sys.platform
      let hash = 0
      for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0 }
      cached = 'dev_' + Math.abs(hash).toString(36) + '_' + Date.now().toString(36)
      wx.setStorageSync('local_openid', cached)
    }
    this.globalData.openid = cached
    wx.setStorageSync('openid', cached)
    resolve(cached)
  },

  // 登录到服务器
  loginToServer(nickName, avatarUrl) {
    const openid = this.getOpenid()
    return new Promise((resolve) => {
      wx.request({
        url: this.globalData.serverUrl + '/api/login',
        method: 'POST',
        data: { openid, nickName, avatarUrl },
        timeout: 5000,
        success: (res) => resolve(res.data),
        fail: () => resolve(null)
      })
    })
  },

  // 同步分数到服务器
  syncScoreToCloud(nickName, avatarUrl) {
    const openid = this.getOpenid()
    if (!openid) return
    const userData = this.globalData.userData
    wx.request({
      url: this.globalData.serverUrl + '/api/sync',
      method: 'POST',
      timeout: 5000,
      data: {
        openid,
        nickName: nickName || wx.getStorageSync('nickName') || '匿名玩家',
        avatarUrl: avatarUrl || wx.getStorageSync('avatarUrl') || '',
        rank: userData.rank,
        rankPoints: userData.rankPoints,
        totalGames: userData.totalGames,
        bestScores: userData.bestScores
      }
    })
  },

  // 获取排行榜
  getRankList() {
    const openid = this.getOpenid()
    if (!openid) return Promise.resolve({ rankList: [], myRank: null })
    return new Promise((resolve) => {
      wx.request({
        url: this.globalData.serverUrl + '/api/rank',
        method: 'POST',
        data: { openid },
        timeout: 5000,
        success: (res) => resolve(res.data),
        fail: () => resolve({ rankList: [], myRank: null })
      })
    })
  },

  // 显示激励视频广告
  showRewardedAd() {
    return ads.showRewardedAd()
  },

  // 尝试显示插屏广告
  tryShowInterstitial() {
    return ads.tryShowInterstitial(this.globalData.userData.totalGames)
  },

  // 解锁皮肤
  unlockSkin(skinId) {
    if (!this.globalData.unlockedSkins.includes(skinId)) {
      this.globalData.unlockedSkins.push(skinId)
      wx.setStorageSync('unlockedSkins', this.globalData.unlockedSkins)
    }
  },

  // 检查皮肤是否已解锁
  isSkinUnlocked(skinId) {
    return this.globalData.unlockedSkins.includes(skinId)
  },

  // 获取 Banner 广告位 ID
  getBannerAdId() {
    return ads.getBannerAdId()
  }
})
