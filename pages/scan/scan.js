const app = getApp()
const { shuffleArray, vibrate } = require('../../utils/util')
const { getSkin } = require('../../utils/skins')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../../utils/guide')
const { calcRankPoints } = require('../../utils/scoring')

Page({
  data: {
    // 游戏状态
    gameState: 'ready', // ready, playing, finished
    level: 20,          // 数字总数
    timeLimit: 12,      // 时间限制(秒)
    numbers: [],        // 数字网格
    targetOrder: [],    // 目标顺序（随机打乱）
    targetIndex: 0,     // 当前目标索引
    nextNumber: 1,      // 当前要找的数字
    foundCount: 0,      // 已找到数量

    // 计时
    timeLeft: 15,
    timerDisplay: '15',

    // 成绩
    accuracy: 0,
    rating: '',
    ratingColor: '',
    isNewRecord: false,
    earnedPoints: 0,
    doubleClaimed: false,

    // 皮肤
    currentSkin: null,

    // 动画
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
    const level = options.level ? parseInt(options.level) : 20
    const timeLimit = options.time ? parseInt(options.time) : 12
    const savedSkin = wx.getStorageSync('skin') || 'night'

    this.setData({
      level,
      timeLimit,
      currentSkin: getSkin(savedSkin)
    })

    this.initGame()

    // 检查是否有暂停的游戏
    const saved = wx.getStorageSync('scan_paused')
    if (saved && saved.level === level) {
      wx.showModal({
        title: '发现未完成的游戏',
        content: '是否继续上次的游戏？',
        confirmText: '继续',
        cancelText: '重新开始',
        success: (res) => {
          wx.removeStorageSync('scan_paused')
          if (res.confirm) {
            this.setData({
              numbers: saved.numbers,
              nextNumber: saved.nextNumber,
              foundCount: saved.foundCount,
              timeLeft: saved.timeLeft,
              targetOrder: saved.targetOrder || shuffleArray(level),
              targetIndex: saved.targetIndex || saved.foundCount,
              timerDisplay: Math.ceil(saved.timeLeft).toString(),
              gameState: 'playing'
            })
            const resumeTime = Date.now()
            this.timer = setInterval(() => {
              const elapsed = (Date.now() - resumeTime) / 1000
              const newTimeLeft = Math.max(0, saved.timeLeft - elapsed)
              this.setData({
                timeLeft: newTimeLeft,
                timerDisplay: Math.ceil(newTimeLeft).toString()
              })
              if (newTimeLeft <= 0) this.gameFinished(false)
            }, 100)
          }
        }
      })
    }

    // 加载玩法说明和新手引导
    const gameId = 'scan'
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
        wx.removeStorageSync('scan_paused')
        if (res.confirm) this.resumeGame()
        else this.restart()
      }
    })
  },

  savePausedState() {
    const { level, numbers, nextNumber, foundCount, timeLeft, targetOrder, targetIndex } = this.data
    wx.setStorageSync('scan_paused', {
      level, numbers, nextNumber, foundCount, timeLeft, targetOrder, targetIndex
    })
  },

  resumeGame() {
    this.setData({ gameState: 'playing' })
    // 用剩余时间重启倒计时
    const timeLeft = this.data.timeLeft
    const resumeTime = Date.now()
    this.timer = setInterval(() => {
      const elapsed = (Date.now() - resumeTime) / 1000
      const newTimeLeft = Math.max(0, timeLeft - elapsed)
      this.setData({
        timeLeft: newTimeLeft,
        timerDisplay: Math.ceil(newTimeLeft).toString()
      })
      if (newTimeLeft <= 0) this.gameFinished(false)
    }, 100)
  },

  // 初始化游戏
  initGame() {
    const { level } = this.data
    const numbers = shuffleArray(level).map((num, index) => ({
      value: num,
      index: index,
      found: false
    }))

    // 生成随机目标顺序
    const targetOrder = shuffleArray(level)

    this.setData({
      numbers,
      targetOrder,
      targetIndex: 0,
      nextNumber: targetOrder[0],
      foundCount: 0,
      gameState: 'ready',
      timeLeft: this.data.timeLimit,
      timerDisplay: this.data.timeLimit.toString(),
      accuracy: 0,
      rating: '',
      isNewRecord: false,
      tappedIndex: -1,
      tappedType: ''
    })

    this.stopTimer()
  },

  // 开始游戏
  startGame() {
    this.setData({
      gameState: 'playing',
      timeLeft: this.data.timeLimit
    })
    this.startTimer()
  },

  // 开始计时
  startTimer() {
    const startTime = Date.now()
    const { timeLimit } = this.data

    this.timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const timeLeft = Math.max(0, timeLimit - elapsed)

      this.setData({
        timeLeft,
        timerDisplay: Math.ceil(timeLeft).toString()
      })

      // 时间用完
      if (timeLeft <= 0) {
        this.gameFinished(false)
      }
    }, 100)
  },

  // 停止计时
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  // 点击数字
  tapNumber(e) {
    const { gameState, nextNumber, numbers, targetOrder, targetIndex } = this.data
    if (gameState !== 'playing') return

    const { index } = e.currentTarget.dataset
    const num = numbers[index]

    if (num.found) return

    this.setData({ tappedIndex: index })

    if (num.value === nextNumber) {
      // 正确
      vibrate('light')
      this.setData({ tappedType: 'success' })

      setTimeout(() => {
        const newNumbers = numbers.map((item, i) => {
          if (i === index) {
            return { ...item, found: true }
          }
          return item
        })

        const newFoundCount = this.data.foundCount + 1
        const newTargetIndex = targetIndex + 1
        const newNext = newTargetIndex < targetOrder.length ? targetOrder[newTargetIndex] : -1

        this.setData({
          numbers: newNumbers,
          targetIndex: newTargetIndex,
          nextNumber: newNext,
          foundCount: newFoundCount,
          tappedIndex: -1,
          tappedType: ''
        })

        if (newFoundCount >= this.data.level) {
          this.gameFinished(true)
        }
      }, 100)

    } else {
      // 错误
      vibrate('heavy')
      this.setData({ tappedType: 'error' })

      setTimeout(() => {
        this.setData({ tappedIndex: -1, tappedType: '' })
      }, 200)
    }
  },

  // 游戏完成
  gameFinished(completed) {
    this.stopTimer()
    wx.removeStorageSync('scan_paused')

    const { level, foundCount, timeLimit, timeLeft } = this.data
    const accuracy = foundCount / level
    const timeUsed = timeLimit - timeLeft

    // 计算评级
    let rating, ratingColor
    if (completed) {
      if (timeUsed <= timeLimit * 0.35) {
        rating = 'S'
        ratingColor = '#FFD700'
      } else if (timeUsed <= timeLimit * 0.55) {
        rating = 'A'
        ratingColor = '#00B894'
      } else {
        rating = 'B'
        ratingColor = '#00CED1'
      }
    } else {
      if (accuracy >= 0.85) {
        rating = 'B'
        ratingColor = '#00CED1'
      } else if (accuracy >= 0.7) {
        rating = 'C'
        ratingColor = '#D4A574'
      } else {
        rating = 'D'
        ratingColor = '#636e72'
      }
    }

    // 检查是否新纪录
    const isNewRecord = app.updateBestScore('scan', level, timeUsed)

    // 添加段位积分
    const points = calcRankPoints('scan', level, rating)
    const rankResult = app.addRankPoints(points)

    // 更新总局数
    app.globalData.userData.totalGames++
    app.saveUserData()
    app.syncScoreToCloud()

    this.setData({
      gameState: 'finished',
      accuracy: Math.round(accuracy * 100),
      rating,
      ratingColor,
      isNewRecord,
      earnedPoints: points,
      doubleClaimed: false
    })

    app.tryShowInterstitial()

    // 如果升段，显示提示
    if (rankResult.promoted) {
      setTimeout(() => {
        wx.showModal({
          title: '恭喜升段！',
          content: `你已晋升为${rankResult.newRank}段位！`,
          showCancel: false,
          confirmText: '太棒了'
        })
      }, 500)
    }
  },

  // 看广告双倍积分
  async watchAdDoublePoints() {
    if (this.data.doubleClaimed) return
    const today = new Date().toISOString().slice(0, 10)
    const claimed = wx.getStorageSync('double_claimed_date') || { date: '', games: {} }
    if (claimed.date === today && claimed.games['scan']) {
      wx.showToast({ title: '今日已使用过双倍积分', icon: 'none' })
      return
    }
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.data.earnedPoints)
      this.setData({ doubleClaimed: true })
      const record = claimed.date === today ? claimed : { date: today, games: {} }
      record.games['scan'] = true
      wx.setStorageSync('double_claimed_date', record)
      wx.showToast({ title: `+${this.data.earnedPoints} 积分`, icon: 'success' })
    }
  },

  // 重新开始
  restart() {
    wx.removeStorageSync('scan_paused')
    this.initGame()
  },

  // 下一难度
  nextLevel() {
    const levelTimeMap = { 15: 12, 20: 12, 25: 15, 30: 18 }
    const nextLevel = Math.min(30, this.data.level + 5)
    this.setData({ level: nextLevel, timeLimit: levelTimeMap[nextLevel] || 12 })
    this.initGame()
  },

  // 选择难度
  selectLevel(e) {
    const { level, time } = e.currentTarget.dataset
    this.setData({
      level: parseInt(level),
      timeLimit: parseInt(time)
    })
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
    markGuided('scan')
    this.setData({ showGuide: false, guideStep: 0 })
  },

  // 玩法说明
  openRules() {
    this.setData({ showRules: true })
  },

  closeRules() {
    this.setData({ showRules: false })
  },

  // 返回首页
  goHome() {
    wx.navigateBack()
  },

  // 分享成绩
  onShareAppMessage() {
    const { level, timeLimit } = this.data
    return {
      title: `我在${timeLimit}秒内找到了${level}个数字中的${this.data.foundCount}个！来挑战我的眼力`,
      path: '/pages/index/index'
    }
  }
})
