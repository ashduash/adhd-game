const app = getApp()
const { vibrate } = require('../../utils/util')
const { getSkin } = require('../../utils/skins')
const { getReactRating, calcRankPoints } = require('../../utils/scoring')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../../utils/guide')
const { checkAchievements } = require('../../utils/achievements')
const { getTodayString, calculateStreak } = require('../../utils/daily')

const DIFFICULTY_CONFIG = {
  easy:   { duration: 30, spawnInterval: 1500, targetLife: 2500, fakeRatio: 0.15, targetSize: 90, label: '初级', desc: '30秒 · 慢速' },
  normal: { duration: 30, spawnInterval: 1000, targetLife: 1800, fakeRatio: 0.25, targetSize: 85, label: '中级', desc: '30秒 · 中速' },
  hard:   { duration: 30, spawnInterval: 700,  targetLife: 1200, fakeRatio: 0.35, targetSize: 75, label: '高级', desc: '30秒 · 快速' },
  expert: { duration: 45, spawnInterval: 500,  targetLife: 900,  fakeRatio: 0.40, targetSize: 70, label: '专家', desc: '45秒 · 极速' },
  master: { duration: 60, spawnInterval: 400,  targetLife: 700,  fakeRatio: 0.50, targetSize: 60, label: '大师', desc: '60秒 · 地狱' }
}

Page({
  data: {
    gameState: 'ready',
    difficulty: 'easy',
    timeLeft: 30,
    timerDisplay: '30',
    targets: [],
    score: 0,
    hits: 0,
    totalTargets: 0,
    misses: 0,
    falsePositives: 0,
    combo: 0,
    maxCombo: 0,
    rating: '',
    ratingColor: '',
    isNewRecord: false,
    earnedPoints: 0,
    doubleClaimed: false,
    currentSkin: null,
    show: false,
    pausedAt: 0,

    // 新手引导和玩法说明
    showGuide: false,
    guideStep: 0,
    guideSteps: [],
    showRules: false,
    rulesSections: []
  },

  gameTimer: null,
  spawnTimer: null,
  targetIdCounter: 0,

  onLoad(options) {
    const savedSkin = wx.getStorageSync('skin') || 'night'
    this.setData({ currentSkin: getSkin(savedSkin) })
    this.initGame()

    // 检查是否有暂停的游戏
    const saved = wx.getStorageSync('react_paused')
    if (saved && saved.difficulty === this.data.difficulty) {
      wx.showModal({
        title: '发现未完成的游戏',
        content: '是否继续上次的游戏？',
        confirmText: '继续',
        cancelText: '重新开始',
        success: (res) => {
          wx.removeStorageSync('react_paused')
          if (res.confirm) {
            this.setData({
              timeLeft: saved.timeLeft,
              timerDisplay: Math.ceil(saved.timeLeft).toString(),
              score: saved.score,
              hits: saved.hits,
              totalTargets: saved.totalTargets,
              misses: saved.misses,
              falsePositives: saved.falsePositives,
              combo: saved.combo,
              maxCombo: saved.maxCombo,
              targets: [],
              gameState: 'playing'
            })
            const config = DIFFICULTY_CONFIG[saved.difficulty]
            const resumeTime = Date.now()
            this.gameTimer = setInterval(() => {
              const elapsed = (Date.now() - resumeTime) / 1000
              const newTimeLeft = Math.max(0, saved.timeLeft - elapsed)
              this.setData({
                timeLeft: newTimeLeft,
                timerDisplay: Math.ceil(newTimeLeft).toString()
              })
              if (newTimeLeft <= 0) this.gameFinished()
            }, 100)
            this.spawnTimer = setInterval(() => {
              this.spawnTarget()
            }, config.spawnInterval)
          }
        }
      })
    }

    // 加载玩法说明和新手引导
    const gameId = 'react'
    this.setData({ guideSteps: GUIDE_STEPS[gameId], rulesSections: RULES_TEXT[gameId] })
    if ((!saved || saved.difficulty !== this.data.difficulty) && !checkGuided(gameId)) {
      setTimeout(() => {
        this.setData({ showGuide: true })
      }, 500)
    }

    setTimeout(() => { this.setData({ show: true }) }, 100)
  },

  onUnload() {
    this.stopGame()
    if (this.data.gameState === 'playing') {
      this.savePausedState()
    }
  },

  onHide() {
    if (this.data.gameState !== 'playing') return
    this.stopGame()
    this.savePausedState()
    this.setData({ pausedAt: Date.now(), gameState: 'paused' })
  },

  onShow() {
    if (this.data.gameState !== 'paused') return
    wx.showModal({
      title: '游戏暂停',
      content: '是否继续游戏？',
      confirmText: '继续',
      cancelText: '重新开始',
      success: (res) => {
        wx.removeStorageSync('react_paused')
        if (res.confirm) this.resumeGame()
        else this.restart()
      }
    })
  },

  savePausedState() {
    const { difficulty, timeLeft, score, hits, totalTargets, misses, falsePositives, combo, maxCombo } = this.data
    wx.setStorageSync('react_paused', {
      difficulty, timeLeft, score, hits, totalTargets, misses, falsePositives, combo, maxCombo
    })
  },

  resumeGame() {
    const config = DIFFICULTY_CONFIG[this.data.difficulty]
    this.setData({ gameState: 'playing' })

    // 用剩余时间重启倒计时
    const timeLeft = this.data.timeLeft
    const resumeTime = Date.now()
    this.gameTimer = setInterval(() => {
      const elapsed = (Date.now() - resumeTime) / 1000
      const newTimeLeft = Math.max(0, timeLeft - elapsed)
      this.setData({
        timeLeft: newTimeLeft,
        timerDisplay: Math.ceil(newTimeLeft).toString()
      })
      if (newTimeLeft <= 0) this.gameFinished()
    }, 100)

    // 重启生成器
    this.spawnTimer = setInterval(() => {
      this.spawnTarget()
    }, config.spawnInterval)
  },

  initGame() {
    this.setData({
      gameState: 'ready',
      targets: [],
      score: 0,
      hits: 0,
      totalTargets: 0,
      misses: 0,
      falsePositives: 0,
      combo: 0,
      maxCombo: 0,
      rating: '',
      ratingColor: '',
      isNewRecord: false
    })
    this.stopGame()
  },

  startGame() {
    const config = DIFFICULTY_CONFIG[this.data.difficulty]
    this.setData({
      gameState: 'playing',
      timeLeft: config.duration,
      timerDisplay: config.duration.toString()
    })

    // 倒计时
    const startTime = Date.now()
    this.gameTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const timeLeft = Math.max(0, config.duration - elapsed)
      this.setData({
        timeLeft,
        timerDisplay: Math.ceil(timeLeft).toString()
      })
      if (timeLeft <= 0) this.gameFinished()
    }, 100)

    // 生成目标
    this.spawnTimer = setInterval(() => {
      this.spawnTarget()
    }, config.spawnInterval)

    // 立即生成第一个
    this.spawnTarget()
  },

  stopGame() {
    if (this.gameTimer) { clearInterval(this.gameTimer); this.gameTimer = null }
    if (this.spawnTimer) { clearInterval(this.spawnTimer); this.spawnTimer = null }
  },

  spawnTarget() {
    const config = DIFFICULTY_CONFIG[this.data.difficulty]
    const isFake = Math.random() < config.fakeRatio
    const id = ++this.targetIdCounter
    const baseSize = config.targetSize || 85
    const target = {
      id,
      x: Math.random() * 75 + 10,
      y: Math.random() * 55 + 10,
      isFake,
      size: isFake ? baseSize - 15 : baseSize
    }

    const targets = [...this.data.targets, target]
    this.setData({ targets, totalTargets: this.data.totalTargets + 1 })

    // 自动消失
    setTimeout(() => {
      this.removeTarget(id, true)
    }, config.targetLife)
  },

  removeTarget(id, expired) {
    const targets = this.data.targets.filter(t => t.id !== id)
    if (expired && this.data.gameState === 'playing') {
      // 真目标过期算miss
      const target = this.data.targets.find(t => t.id === id)
      if (target && !target.isFake) {
        this.setData({
          targets,
          misses: this.data.misses + 1,
          combo: 0
        })
        return
      }
    }
    this.setData({ targets })
  },

  tapTarget(e) {
    if (this.data.gameState !== 'playing') return
    const { id } = e.currentTarget.dataset
    const target = this.data.targets.find(t => t.id === id)
    if (!target) return

    if (target.isFake) {
      // 点了假目标
      vibrate('heavy')
      this.setData({
        falsePositives: this.data.falsePositives + 1,
        combo: 0
      })
    } else {
      // 点了真目标
      vibrate('light')
      const newCombo = this.data.combo + 1
      const comboBonus = Math.floor(newCombo / 5)
      this.setData({
        hits: this.data.hits + 1,
        score: this.data.score + 1 + comboBonus,
        combo: newCombo,
        maxCombo: Math.max(this.data.maxCombo, newCombo)
      })
    }

    this.removeTarget(id, false)
  },

  tapBackground(e) {
    // 点击空白区域
    if (this.data.gameState !== 'playing') return
    vibrate('heavy')
    this.setData({ combo: 0 })
  },

  gameFinished() {
    this.stopGame()
    wx.removeStorageSync('react_paused')

    const { difficulty, hits, totalTargets, falsePositives } = this.data
    const rating = getReactRating(hits, totalTargets, falsePositives)
    const ratingColors = { 'S': '#D4A04A', 'A': '#7BAE7F', 'B': '#7BA5A0', 'C': '#D4A574', 'D': '#8A7E72' }
    const ratingColor = ratingColors[rating]

    // 更新最佳成绩
    const hitRate = totalTargets > 0 ? Math.round(hits / totalTargets * 100) : 0
    const isNewRecord = !app.globalData.userData.bestScores.react[difficulty] ||
      hitRate > (app.globalData.userData.bestScores.react[difficulty] || 0)
    if (isNewRecord) {
      app.globalData.userData.bestScores.react[difficulty] = hitRate
    }
    if (this.data.maxCombo > (app.globalData.userData.bestScores.react._maxCombo || 0)) {
      app.globalData.userData.bestScores.react._maxCombo = this.data.maxCombo
    }
    // 记录评级
    app.globalData.userData.bestScores.react[difficulty] = rating === 'S' ? 'S' : app.globalData.userData.bestScores.react[difficulty]

    // 更新打卡
    const today = getTodayString()
    const userData = app.globalData.userData
    userData.streak = calculateStreak(userData.lastPlayDate, userData.streak)
    userData.lastPlayDate = today
    userData.totalGames++

    const points = calcRankPoints('react', this.data.difficulty, rating)
    const rankResult = app.addRankPoints(points)
    const newAchievements = checkAchievements(userData)
    app.saveUserData()
    app.syncScoreToCloud()

    this.setData({
      gameState: 'finished',
      hitRate,
      rating,
      ratingColor,
      isNewRecord,
      earnedPoints: points,
      doubleClaimed: false
    })

    app.tryShowInterstitial()

    if (newAchievements.length > 0) {
      setTimeout(() => {
        wx.showModal({
          title: '解锁成就！',
          content: newAchievements.map(a => `${a.icon} ${a.name}`).join('\n'),
          showCancel: false,
          confirmText: '太棒了'
        })
      }, 500)
    }

    if (rankResult.promoted) {
      setTimeout(() => {
        wx.showModal({
          title: '恭喜升段！',
          content: `你已晋升为${rankResult.newRank}段位！`,
          showCancel: false,
          confirmText: '太棒了'
        })
      }, newAchievements.length > 0 ? 1500 : 500)
    }
  },

  selectDifficulty(e) {
    const { level } = e.currentTarget.dataset
    this.setData({ difficulty: level })
  },

  // 看广告双倍积分
  async watchAdDoublePoints() {
    if (this.data.doubleClaimed) return
    const today = new Date().toISOString().slice(0, 10)
    const claimed = wx.getStorageSync('double_claimed_date') || { date: '', games: {} }
    if (claimed.date === today && claimed.games['react']) {
      wx.showToast({ title: '今日已使用过双倍积分', icon: 'none' })
      return
    }
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.data.earnedPoints)
      this.setData({ doubleClaimed: true })
      const record = claimed.date === today ? claimed : { date: today, games: {} }
      record.games['react'] = true
      wx.setStorageSync('double_claimed_date', record)
      wx.showToast({ title: `+${this.data.earnedPoints} 积分`, icon: 'success' })
    }
  },

  restart() {
    wx.removeStorageSync('react_paused')
    this.initGame()
  },

  // 新手引导
  nextGuide() {
    const { guideStep, guideSteps } = this.data
    if (guideStep < guideSteps.length - 1) {
      this.setData({ guideStep: guideStep + 1 })
    } else {
      this.closeGuide()
    }
  },

  closeGuide() {
    markGuided('react')
    this.setData({ showGuide: false, guideStep: 0 })
  },

  // 玩法说明
  openRules() {
    this.setData({ showRules: true })
  },

  closeRules() {
    this.setData({ showRules: false })
  },

  goHome() {
    wx.navigateBack()
  },

  onShareAppMessage() {
    const { difficulty, hits, totalTargets } = DIFFICULTY_CONFIG[this.data.difficulty]
    return {
      title: `我在${DIFFICULTY_CONFIG[this.data.difficulty].label}反应训练中命中${this.data.hits}个目标！`,
      path: '/pages/index/index'
    }
  }
})
