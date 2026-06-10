const app = getApp()
const { vibrate, formatTime } = require('../../utils/util')
const { getSkin } = require('../../utils/skins')
const { getStroopRating, calcRankPoints } = require('../../utils/scoring')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../../utils/guide')
const { checkAchievements } = require('../../utils/achievements')
const { getTodayString, calculateStreak } = require('../../utils/daily')

Page({
  data: {
    gameState: 'ready',
    level: 15,
    colors: [
      { name: '红', hex: '#FF6B6B' },
      { name: '蓝', hex: '#0984E3' },
      { name: '绿', hex: '#00B894' },
      { name: '黄', hex: '#FDCB6E' },
      { name: '紫', hex: '#6C5CE7' },
      { name: '橙', hex: '#E17055' }
    ],
    currentQuestion: null,
    questionIndex: 0,
    totalQuestions: 15,
    correctCount: 0,
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
    const level = options.level ? parseInt(options.level) : 15
    const savedSkin = wx.getStorageSync('skin') || 'night'

    this.setData({
      level,
      currentSkin: getSkin(savedSkin)
    })

    this.initGame()

    // 检查是否有暂停的游戏
    const saved = wx.getStorageSync('stroop_paused')
    if (saved && saved.level === level) {
      wx.showModal({
        title: '发现未完成的游戏',
        content: '是否继续上次的游戏？',
        confirmText: '继续',
        cancelText: '重新开始',
        success: (res) => {
          wx.removeStorageSync('stroop_paused')
          if (res.confirm) {
            this.setData({
              questionIndex: saved.questionIndex,
              totalQuestions: saved.totalQuestions,
              correctCount: saved.correctCount,
              currentQuestion: saved.currentQuestion,
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
    const gameId = 'stroop'
    this.setData({ guideSteps: GUIDE_STEPS[gameId], rulesSections: RULES_TEXT[gameId] })
    if ((!saved || saved.level !== level) && !checkGuided(gameId)) {
      setTimeout(() => {
        this.setData({ showGuide: true })
      }, 500)
    }

    setTimeout(() => {
      this.setData({ show: true })
    }, 100)
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
        wx.removeStorageSync('stroop_paused')
        if (res.confirm) this.resumeGame()
        else this.restart()
      }
    })
  },

  savePausedState() {
    const { level, questionIndex, totalQuestions, correctCount, currentQuestion, elapsedTime } = this.data
    wx.setStorageSync('stroop_paused', {
      level, questionIndex, totalQuestions, correctCount, currentQuestion, elapsedTime
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
    this.setData({
      gameState: 'ready',
      currentQuestion: null,
      questionIndex: 0,
      totalQuestions: this.data.level,
      correctCount: 0,
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
    this.generateNextQuestion()
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

  generateNextQuestion() {
    const { colors, questionIndex, totalQuestions, level } = this.data
    if (questionIndex >= totalQuestions) {
      this.gameFinished()
      return
    }

    // 高难度用更多颜色
    const activeColors = level >= 35 ? colors : colors.slice(0, 4)

    const wordColor = activeColors[Math.floor(Math.random() * activeColors.length)]
    let displayColor
    do {
      displayColor = activeColors[Math.floor(Math.random() * activeColors.length)]
    } while (displayColor.name === wordColor.name)

    const options = this.shuffleColors([...activeColors])
    const correctIndex = options.findIndex(c => c.name === displayColor.name)

    this.setData({
      currentQuestion: {
        word: wordColor.name,
        displayColor: displayColor.hex,
        options,
        correctIndex
      }
    })
  },

  shuffleColors(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  },

  tapOption(e) {
    if (this.data.gameState !== 'playing') return
    const { index } = e.currentTarget.dataset
    const { currentQuestion, colors } = this.data

    this.setData({ tappedIndex: index })

    const selectedColor = currentQuestion.options[index]
    const isCorrect = selectedColor.name === colors.find(c => c.hex === currentQuestion.displayColor).name

    if (isCorrect) {
      vibrate('light')
      this.setData({
        tappedType: 'success',
        correctCount: this.data.correctCount + 1
      })

      setTimeout(() => {
        this.setData({
          questionIndex: this.data.questionIndex + 1,
          tappedIndex: -1,
          tappedType: ''
        })
        this.generateNextQuestion()
      }, 150)
    } else {
      vibrate('heavy')
      this.setData({ tappedType: 'error' })

      setTimeout(() => {
        this.setData({
          questionIndex: this.data.questionIndex + 1,
          tappedIndex: -1,
          tappedType: ''
        })
        this.generateNextQuestion()
      }, 250)
    }
  },

  gameFinished() {
    this.stopTimer()
    wx.removeStorageSync('stroop_paused')

    const { level, correctCount, elapsedTime } = this.data
    const accuracy = Math.round((correctCount / level) * 100)
    const timeUsed = Math.round(elapsedTime * 10) / 10

    const rating = getStroopRating(accuracy, timeUsed, level)
    const ratingColors = { 'S': '#FFD700', 'A': '#00B894', 'B': '#00CED1', 'C': '#A29BFE', 'D': '#636e72' }
    const ratingColor = ratingColors[rating]

    // 更新最佳成绩（用准确率作为分数，越高越好）
    const scoreKey = level
    const isNewRecord = !app.globalData.userData.bestScores.stroop[scoreKey] ||
      accuracy > (app.globalData.userData.bestScores.stroop[scoreKey] || 0)
    if (isNewRecord) {
      app.globalData.userData.bestScores.stroop[scoreKey] = accuracy
    }

    // 记录完美成就
    if (correctCount === level) {
      app.globalData.userData.bestScores.stroop._perfect = true
    }

    // 更新打卡
    const today = getTodayString()
    const userData = app.globalData.userData
    userData.streak = calculateStreak(userData.lastPlayDate, userData.streak)
    userData.lastPlayDate = today
    userData.totalGames++

    // 添加段位积分
    const points = calcRankPoints('stroop', level, rating)
    const rankResult = app.addRankPoints(points)

    // 检查成就
    const newAchievements = checkAchievements(userData)
    app.saveUserData()
    app.syncScoreToCloud()

    this.setData({
      gameState: 'finished',
      accuracy,
      timeUsed,
      rating,
      ratingColor,
      isNewRecord,
      earnedPoints: points,
      doubleClaimed: false
    })

    app.tryShowInterstitial()

    // 显示新成就
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

    // 升段提示
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
    if (claimed.date === today && claimed.games['stroop']) {
      wx.showToast({ title: '今日已使用过双倍积分', icon: 'none' })
      return
    }
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.data.earnedPoints)
      this.setData({ doubleClaimed: true })
      const record = claimed.date === today ? claimed : { date: today, games: {} }
      record.games['stroop'] = true
      wx.setStorageSync('double_claimed_date', record)
      wx.showToast({ title: `+${this.data.earnedPoints} 积分`, icon: 'success' })
    }
  },

  restart() {
    wx.removeStorageSync('stroop_paused')
    this.initGame()
  },

  nextLevel() {
    const levels = [15, 25, 35, 45, 60]
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
    markGuided('stroop')
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
    const { level, correctCount } = this.data
    return {
      title: `我在斯特鲁普测试中答对了${correctCount}/${level}题！你能不受颜色干扰吗？`,
      path: '/pages/index/index'
    }
  }
})
