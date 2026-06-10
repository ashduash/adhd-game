/**
 * 全局状态管理 - 替代 App()
 * 从原 app.js 转换，移除 App() 包装，改为普通模块
 */
const THEME = require('./config/theme')
const { setTheme } = THEME

const app = {
  globalData: {
    userInfo: null,
    openid: null,
    unlockedSkins: ['night'],
    // 部署后端后填入真实地址，为空时自动回退到微信云函数
    serverUrl: '',
    userData: {
      rank: 'bronze',
      rankPoints: 0,
      bestScores: {
        schulte: {},
        memory: {},
        scan: {},
        stroop: {},
        react: {},
        match: {},
        sort: {},
        dual: {}
      },
      achievements: [],
      totalGames: 0,
      lastPlayDate: null,
      streak: 0,
      streakFreeze: 0,
      dailyChallenge: { date: null, completed: false, mode: null, level: null },
      trainingPlan: { cycleStart: null, dayIndex: 0, completed: [] }
    }
  },

  // 初始化（替代 onLaunch）
  init() {
    // 加载已解锁皮肤
    const unlockedSkins = wx.getStorageSync('unlockedSkins')
    if (unlockedSkins && unlockedSkins.length > 0) {
      this.globalData.unlockedSkins = unlockedSkins
    }

    // 加载主题设置
    const savedTheme = wx.getStorageSync('appTheme') || 'dark'
    setTheme(savedTheme)

    // 加载本地存储的用户数据
    const userData = wx.getStorageSync('userData')
    if (userData) {
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

  // 保存主题设置
  saveTheme(themeName) {
    wx.setStorageSync('appTheme', themeName)
    setTheme(themeName)
  },

  // 更新最佳成绩
  updateBestScore(mode, level, score) {
    const bestScores = this.globalData.userData.bestScores
    const higherBetter = ['match', 'memory', 'scan', 'stroop']
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
      return { promoted: true, newRank: rankNames[newRankIndex], newRankKey: ranks[newRankIndex] }
    }

    this.saveUserData()
    return { promoted: false }
  },

  getOpenid() {
    return this.globalData.openid || wx.getStorageSync('openid') || null
  },

  // 重置 openid（清除数据时调用）
  resetOpenid() {
    this.globalData.openid = null
    wx.removeStorageSync('openid')
  },

  // 清除所有应用数据（不清除云SDK缓存，避免触发原生视图崩溃）
  clearAppData() {
    const appKeys = [
      'userData', 'openid', 'nickName', 'avatarUrl',
      'unlockedSkins', 'appTheme',
      'guided_games', 'schulte_paused', 'soundEnabled', 'skin'
    ]
    for (const key of appKeys) {
      wx.removeStorageSync(key)
    }
    this.globalData.openid = null
  },

  // 检查是否已通过微信登录（openid 为真实微信 openid，非 user_ 开头的伪 openid）
  isLoggedIn() {
    const openid = this.globalData.openid || wx.getStorageSync('openid')
    return !!openid && !openid.startsWith('user_')
  },

  // 优先通过云函数获取 openid，serverUrl 可用时走 HTTP 服务端
  wxLogin() {
    return new Promise((resolve, reject) => {
      // 优先云函数路径（审核环境始终可用）
      if (wx.cloud && GameGlobal._cloudReady) {
        wx.cloud.callFunction({
          name: 'login',
          success: (res) => {
            if (res.result && res.result.openid) {
              this._saveOpenid(res.result.openid)
              resolve(res.result.openid)
            } else {
              reject(new Error('云函数未返回 openid'))
            }
          },
          fail: () => {
            this._wxLoginByHttp(resolve, reject)
          }
        })
        return
      }
      // 云 SDK 未就绪时等待（最多 3 秒），而非直接走 HTTP 回退
      if (wx.cloud && !GameGlobal._cloudReady) {
        let waited = 0
        const check = setInterval(() => {
          waited += 200
          if (GameGlobal._cloudReady) {
            clearInterval(check)
            // 云 SDK 就绪，重新走云函数路径
            wx.cloud.callFunction({
              name: 'login',
              success: (res) => {
                if (res.result && res.result.openid) {
                  this._saveOpenid(res.result.openid)
                  resolve(res.result.openid)
                } else {
                  reject(new Error('云函数未返回 openid'))
                }
              },
              fail: () => { this._wxLoginByHttp(resolve, reject) }
            })
          } else if (waited >= 3000) {
            clearInterval(check)
            this._wxLoginByHttp(resolve, reject)
          }
        }, 200)
        return
      }
      this._wxLoginByHttp(resolve, reject)
    })
  },

  _wxLoginByHttp(resolve, reject) {
    if (!this.globalData.serverUrl) {
      reject(new Error('服务连接失败，请稍后重试'))
      return
    }
    wx.login({
      success: (loginRes) => {
        if (!loginRes.code) {
          reject(new Error('wx.login 获取 code 失败'))
          return
        }
        wx.request({
          url: this.globalData.serverUrl + '/api/wxlogin',
          method: 'POST',
          data: { code: loginRes.code },
          timeout: 8000,
          success: (res) => {
            if (res.data && res.data.openid) {
              this._saveOpenid(res.data.openid)
              resolve(res.data.openid)
            } else {
              reject(new Error('服务端未返回 openid'))
            }
          },
          fail: () => {
            reject(new Error('服务端不可用，无法登录'))
          }
        })
      },
      fail: () => {
        reject(new Error('wx.login 失败'))
      }
    })
  },

  _saveOpenid(openid) {
    this.globalData.openid = openid
    wx.setStorageSync('openid', openid)
  },

  // 退出登录
  logout() {
    this.globalData.openid = null
    wx.removeStorageSync('openid')
  },

  // 登录到服务器（云函数优先，HTTP 兜底）
  loginToServer(nickName, avatarUrl) {
    const openid = this.getOpenid()
    if (!openid) return Promise.resolve(null)
    if (wx.cloud && GameGlobal._cloudReady) {
      return new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'leaderboard',
          data: { action: 'sync', nickName, avatarUrl },
          success: (res) => resolve(res.result),
          fail: () => this._loginToServerHttp(nickName, avatarUrl, resolve)
        })
      })
    }
    return this._loginToServerHttp(nickName, avatarUrl, null)
  },

  _loginToServerHttp(nickName, avatarUrl, resolveFallback) {
    if (!this.globalData.serverUrl) {
      if (resolveFallback) resolveFallback(null)
      return Promise.resolve(null)
    }
    const openid = this.getOpenid()
    const p = new Promise((resolve) => {
      wx.request({
        url: this.globalData.serverUrl + '/api/login',
        method: 'POST',
        data: { openid, nickName, avatarUrl },
        timeout: 5000,
        success: (res) => resolve(res.data),
        fail: () => resolve(null)
      })
    })
    if (resolveFallback) { p.then(resolveFallback); return undefined }
    return p
  },

  // 同步分数（云函数优先，HTTP 兜底）
  syncScoreToCloud(nickName, avatarUrl) {
    const openid = this.getOpenid()
    if (!openid) return Promise.resolve(false)
    const ud = this.globalData.userData
    const data = {
      action: 'sync',
      openid,
      nickName: nickName || wx.getStorageSync('nickName') || '匿名玩家',
      avatarUrl: avatarUrl || wx.getStorageSync('avatarUrl') || '',
      rank: ud.rank,
      rankPoints: ud.rankPoints,
      totalGames: ud.totalGames,
      bestScores: ud.bestScores
    }
    if (wx.cloud && GameGlobal._cloudReady) {
      return new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'leaderboard',
          data,
          success: () => resolve(true),
          fail: () => this._syncScoreHttp(data, resolve)
        })
      })
    }
    return this._syncScoreHttp(data, null)
  },

  _syncScoreHttp(data, resolveFallback) {
    if (!this.globalData.serverUrl) {
      console.warn('syncScoreToCloud: 云函数不可用且 serverUrl 为空，分数未同步')
      if (resolveFallback) resolveFallback(false)
      return Promise.resolve(false)
    }
    const p = new Promise((resolve) => {
      wx.request({
        url: this.globalData.serverUrl + '/api/sync',
        method: 'POST',
        timeout: 5000,
        data,
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    })
    if (resolveFallback) { p.then(resolveFallback); return undefined }
    return p
  },

  // 获取排行榜（云函数优先，HTTP 兜底）
  getRankList() {
    const openid = this.getOpenid()
    if (!openid) return Promise.resolve({ rankList: [], myRank: null })
    if (wx.cloud && GameGlobal._cloudReady) {
      return new Promise((resolve) => {
        wx.cloud.callFunction({
          name: 'leaderboard',
          data: { action: 'rank' },
          success: (res) => resolve(res.result || { rankList: [], myRank: null }),
          fail: () => this._getRankListHttp(resolve)
        })
      })
    }
    return this._getRankListHttp(null)
  },

  _getRankListHttp(resolveFallback) {
    if (!this.globalData.serverUrl) {
      if (resolveFallback) resolveFallback({ rankList: [], myRank: null })
      return Promise.resolve({ rankList: [], myRank: null })
    }
    const openid = this.getOpenid()
    const p = new Promise((resolve) => {
      wx.request({
        url: this.globalData.serverUrl + '/api/rank',
        method: 'POST',
        data: { openid },
        timeout: 5000,
        success: (res) => resolve(res.data),
        fail: () => resolve({ rankList: [], myRank: null })
      })
    })
    if (resolveFallback) { p.then(resolveFallback); return undefined }
    return p
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

  // 广告方法（委托给 ads 模块）
  showRewardedAd() {
    const ads = require('./utils/ads')
    return ads.showRewardedAd()
  },

  tryShowInterstitial() {
    const ads = require('./utils/ads')
    return ads.tryShowInterstitial(this.globalData.userData.totalGames)
  }
}

module.exports = app
