const app = getApp()
const { vibrate, shuffleArray, formatTime } = require('../../utils/util')
const { getSkin } = require('../../utils/skins')
const { getSortRating, calcRankPoints } = require('../../utils/scoring')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../../utils/guide')
const { checkAchievements } = require('../../utils/achievements')
const { getTodayString, calculateStreak } = require('../../utils/daily')

Page({
  data: {
    gameState: 'ready',
    level: 8,
    items: [],
    sortedSequence: [],
    nextExpected: null,
    correctCount: 0,
    errorCount: 0,
    startTime: 0,
    elapsedTime: 0,
    currentTime: '00:00.00',
    rating: '',
    ratingColor: '',
    isNewRecord: false,
    earnedPoints: 0,
    doubleClaimed: false,
    currentSkin: null,
    show: false,
    tappedIndex: -1,
    tappedType: '',
    pausedAt: 0,

    // 新手引导和玩法说明
    showGuide: false,
    guideStep: 0,
    guideSteps: [],
    showRules: false,
    rulesSections: []
  },

  timer: null,

  onLoad(options) {
    const level = options.level ? parseInt(options.level) : 8
    const savedSkin = wx.getStorageSync('skin') || 'night'

    this.setData({
      level,
      currentSkin: getSkin(savedSkin)
    })

    this.initGame()

    // 检查是否有暂停的游戏
    const saved = wx.getStorageSync('sort_paused')
    if (saved && saved.level === level) {
      wx.showModal({
        title: '发现未完成的游戏',
        content: '是否继续上次的游戏？',
        confirmText: '继续',
        cancelText: '重新开始',
        success: (res) => {
          wx.removeStorageSync('sort_paused')
          if (res.confirm) {
            this.setData({
              items: saved.items,
              sortedSequence: saved.sortedSequence,
              nextExpected: saved.nextExpected,
              correctCount: saved.correctCount,
              errorCount: saved.errorCount,
              elapsedTime: saved.elapsedTime,
              currentTime: formatTime(saved.elapsedTime),
              startTime: Date.now() - saved.elapsedTime,
              gameState: 'playing'
            })
            this.startTimer()
          }
        }
      })
    }

    // 加载玩法说明和新手引导
    const gameId = 'sort'
    this.setData({ guideSteps: GUIDE_STEPS[gameId], rulesSections: RULES_TEXT[gameId] })
    if ((!saved || saved.level !== level) && !checkGuided(gameId)) {
      setTimeout(() => {
        this.setData({ showGuide: true })
      }, 500)
    }

    setTimeout(() => { this.setData({ show: true }) }, 100)
  },

  onUnload() {
    this.stopTimer()
    if (this.data.gameState === 'playing') {
      this.savePausedState()
    }
  },

  onHide() {
    if (this.data.gameState !== 'playing') return
    this.stopTimer()
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
        wx.removeStorageSync('sort_paused')
        if (res.confirm) this.resumeGame()
        else this.restart()
      }
    })
  },

  savePausedState() {
    const { level, items, sortedSequence, nextExpected, correctCount, errorCount, elapsedTime } = this.data
    wx.setStorageSync('sort_paused', {
      level, items, sortedSequence, nextExpected, correctCount, errorCount, elapsedTime
    })
  },

  resumeGame() {
    const pausedDuration = Date.now() - this.data.pausedAt
    this.setData({
      gameState: 'playing',
      startTime: this.data.startTime + pausedDuration
    })
    this.startTimer()
  },

  initGame() {
    const { level } = this.data
    const maxNum = level >= 15 ? 200 : 99
    const numbers = new Set()
    while (numbers.size < level) {
      numbers.add(Math.floor(Math.random() * maxNum) + 1)
    }
    const sorted = Array.from(numbers).sort((a, b) => a - b)
    const shuffled = [...sorted]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }

    const items = shuffled.map((value, index) => ({
      value,
      index,
      tapped: false,
      tapOrder: -1
    }))

    this.setData({
      gameState: 'ready',
      items,
      sortedSequence: sorted,
      nextExpected: sorted[0],
      correctCount: 0,
      errorCount: 0,
      elapsedTime: 0,
      currentTime: '00:00.00',
      rating: '',
      ratingColor: '',
      isNewRecord: false,
      tappedIndex: -1,
      tappedType: ''
    })

    this.stopTimer()
  },

  startGame() {
    this.setData({
      gameState: 'playing',
      startTime: Date.now()
    })
    this.startTimer()
  },

  startTimer() {
    const startTime = this.data.startTime
    this.timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const mins = Math.floor(elapsed / 60)
      const secs = Math.floor(elapsed % 60)
      const ms = Math.floor((elapsed % 1) * 100)
      this.setData({
        elapsedTime: elapsed,
        currentTime: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
      })
    }, 50)
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  tapItem(e) {
    if (this.data.gameState !== 'playing') return
    const { index } = e.currentTarget.dataset
    const item = this.data.items[index]
    if (item.tapped) return

    this.setData({ tappedIndex: index })

    if (item.value === this.data.nextExpected) {
      vibrate('light')
      const newItems = this.data.items.map((it, i) => {
        if (i === index) return { ...it, tapped: true, tapOrder: this.data.correctCount }
        return it
      })
      const newCorrectCount = this.data.correctCount + 1
      const nextExpected = newCorrectCount < this.data.sortedSequence.length
        ? this.data.sortedSequence[newCorrectCount] : null

      this.setData({
        tappedType: 'success',
        items: newItems,
        correctCount: newCorrectCount,
        nextExpected
      })

      setTimeout(() => {
        this.setData({ tappedIndex: -1, tappedType: '' })
        if (newCorrectCount >= this.data.sortedSequence.length) {
          this.gameFinished()
        }
      }, 150)
    } else {
      vibrate('heavy')
      this.setData({
        tappedType: 'error',
        errorCount: this.data.errorCount + 1
      })

      setTimeout(() => {
        this.setData({ tappedIndex: -1, tappedType: '' })
      }, 250)
    }
  },

  gameFinished() {
    this.stopTimer()
    wx.removeStorageSync('sort_paused')

    const { level, errorCount, elapsedTime } = this.data
    const timeUsed = Math.round(elapsedTime * 10) / 10
    const rating = getSortRating(timeUsed, level, errorCount)
    const ratingColors = { 'S': '#D4A04A', 'A': '#7BAE7F', 'B': '#7BA5A0', 'C': '#D4A574', 'D': '#8A7E72' }
    const ratingColor = ratingColors[rating]

    // 更新最佳成绩（用时间，越小越好）
    const isNewRecord = !app.globalData.userData.bestScores.sort[level] ||
      elapsedTime * 1000 < (app.globalData.userData.bestScores.sort[level] || Infinity)
    if (isNewRecord) {
      app.globalData.userData.bestScores.sort[level] = Math.round(elapsedTime * 1000)
    }

    // 记录完美成就
    if (errorCount === 0 && level === 12) {
      app.globalData.userData.bestScores.sort._perfect12 = true
    }

    // 更新打卡
    const today = getTodayString()
    const userData = app.globalData.userData
    userData.streak = calculateStreak(userData.lastPlayDate, userData.streak)
    userData.lastPlayDate = today
    userData.totalGames++

    const points = calcRankPoints('sort', level, rating)
    const rankResult = app.addRankPoints(points)
    const newAchievements = checkAchievements(userData)
    app.saveUserData()
    app.syncScoreToCloud()

    this.setData({
      gameState: 'finished',
      timeUsed,
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

  // 看广告双倍积分
  async watchAdDoublePoints() {
    if (this.data.doubleClaimed) return
    const today = new Date().toISOString().slice(0, 10)
    const claimed = wx.getStorageSync('double_claimed_date') || { date: '', games: {} }
    if (claimed.date === today && claimed.games['sort']) {
      wx.showToast({ title: '今日已使用过双倍积分', icon: 'none' })
      return
    }
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.data.earnedPoints)
      this.setData({ doubleClaimed: true })
      const record = claimed.date === today ? claimed : { date: today, games: {} }
      record.games['sort'] = true
      wx.setStorageSync('double_claimed_date', record)
      wx.showToast({ title: `+${this.data.earnedPoints} 积分`, icon: 'success' })
    }
  },

  restart() {
    wx.removeStorageSync('sort_paused')
    this.initGame()
  },

  nextLevel() {
    const levels = [6, 8, 10, 12, 15]
    const currentIndex = levels.indexOf(this.data.level)
    if (currentIndex < levels.length - 1) {
      this.setData({ level: levels[currentIndex + 1] })
    }
    this.initGame()
  },

  selectLevel(e) {
    const { level } = e.currentTarget.dataset
    this.setData({ level: parseInt(level) })
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
    markGuided('sort')
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
    const { level, currentTime, errorCount } = this.data
    return {
      title: `我用${currentTime}完成了${level}项序列排序，${errorCount === 0 ? '零失误' : '错了' + errorCount + '次'}！`,
      path: '/pages/index/index'
    }
  }
})
