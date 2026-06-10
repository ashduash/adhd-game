const app = getApp()
const { vibrate } = require('../../utils/util')
const { getSkin } = require('../../utils/skins')
const { getDualRating, calcRankPoints } = require('../../utils/scoring')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../../utils/guide')
const { checkAchievements } = require('../../utils/achievements')
const { getTodayString, calculateStreak } = require('../../utils/daily')

const DIFFICULTY_CONFIG = {
  easy:   { duration: 30, spawnInterval: 2000, itemLife: 3000, label: '初级', desc: '30秒 · 慢速' },
  normal: { duration: 30, spawnInterval: 1400, itemLife: 2800, label: '中级', desc: '30秒 · 中速' },
  hard:   { duration: 30, spawnInterval: 900,  itemLife: 2500, label: '高级', desc: '30秒 · 快速' },
  expert: { duration: 45, spawnInterval: 700,  itemLife: 2200, label: '专家', desc: '45秒 · 极速' },
  master: { duration: 60, spawnInterval: 500,  itemLife: 1800, label: '大师', desc: '60秒 · 地狱' }
}

const ITEM_COLORS = [
  { name: 'red', hex: '#FF6B6B' },
  { name: 'blue', hex: '#0984E3' },
  { name: 'green', hex: '#00B894' },
  { name: 'yellow', hex: '#FDCB6E' }
]

const TASK_PAIRS = [
  { top: { rule: 'even', label: '点击偶数' }, bottom: { rule: 'odd', label: '点击奇数' } },
  { top: { rule: 'big', label: '点击 ≥ 5' }, bottom: { rule: 'small', label: '点击 < 5' } },
  { top: { rule: 'red', label: '点击红色' }, bottom: { rule: 'blue', label: '点击蓝色' } },
  { top: { rule: 'mult3', label: '点击3的倍数' }, bottom: { rule: 'notmult3', label: '点击非3倍数' } },
  { top: { rule: 'prime', label: '点击质数' }, bottom: { rule: 'notprime', label: '点击非质数' } }
]

Page({
  data: {
    gameState: 'ready',
    difficulty: 'easy',
    timeLeft: 30,
    timerDisplay: '30',
    topItems: [],
    bottomItems: [],
    topTask: null,
    bottomTask: null,
    topScore: 0,
    topTotal: 0,
    bottomScore: 0,
    bottomTotal: 0,
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
  spawnTimerTop: null,
  spawnTimerBottom: null,
  itemIdCounter: 0,

  onLoad(options) {
    const savedSkin = wx.getStorageSync('skin') || 'night'
    this.setData({ currentSkin: getSkin(savedSkin) })
    this.initGame()

    // 检查是否有暂停的游戏
    const saved = wx.getStorageSync('dual_paused')
    if (saved && saved.difficulty === this.data.difficulty) {
      wx.showModal({
        title: '发现未完成的游戏',
        content: '是否继续上次的游戏？',
        confirmText: '继续',
        cancelText: '重新开始',
        success: (res) => {
          wx.removeStorageSync('dual_paused')
          if (res.confirm) {
            this.setData({
              timeLeft: saved.timeLeft,
              timerDisplay: Math.ceil(saved.timeLeft).toString(),
              topScore: saved.topScore,
              topTotal: saved.topTotal,
              bottomScore: saved.bottomScore,
              bottomTotal: saved.bottomTotal,
              topTask: saved.topTask,
              bottomTask: saved.bottomTask,
              topItems: [],
              bottomItems: [],
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
            this.spawnTimerTop = setInterval(() => {
              this.spawnItem('top')
            }, config.spawnInterval)
            setTimeout(() => {
              this.spawnTimerBottom = setInterval(() => {
                this.spawnItem('bottom')
              }, config.spawnInterval)
            }, config.spawnInterval / 2)
          }
        }
      })
    }

    // 加载玩法说明和新手引导
    const gameId = 'dual'
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
        wx.removeStorageSync('dual_paused')
        if (res.confirm) this.resumeGame()
        else this.restart()
      }
    })
  },

  savePausedState() {
    const { difficulty, timeLeft, topScore, topTotal, bottomScore, bottomTotal, topTask, bottomTask } = this.data
    wx.setStorageSync('dual_paused', {
      difficulty, timeLeft, topScore, topTotal, bottomScore, bottomTotal, topTask, bottomTask
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

    // 重启双侧生成器
    this.spawnTimerTop = setInterval(() => {
      this.spawnItem('top')
    }, config.spawnInterval)

    setTimeout(() => {
      this.spawnTimerBottom = setInterval(() => {
        this.spawnItem('bottom')
      }, config.spawnInterval)
    }, config.spawnInterval / 2)
  },

  initGame() {
    this.setData({
      gameState: 'ready',
      topItems: [],
      bottomItems: [],
      topScore: 0,
      topTotal: 0,
      bottomScore: 0,
      bottomTotal: 0,
      rating: '',
      ratingColor: '',
      isNewRecord: false
    })
    this.stopGame()
  },

  startGame() {
    const config = DIFFICULTY_CONFIG[this.data.difficulty]
    const pairIndex = Math.floor(Math.random() * TASK_PAIRS.length)
    const tasks = TASK_PAIRS[pairIndex]

    this.setData({
      gameState: 'playing',
      timeLeft: config.duration,
      timerDisplay: config.duration.toString(),
      topTask: tasks.top,
      bottomTask: tasks.bottom
    })

    // 倒计时
    const startTime = Date.now()
    this.gameTimer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      const timeLeft = Math.max(0, config.duration - elapsed)
      this.setData({ timeLeft, timerDisplay: Math.ceil(timeLeft).toString() })
      if (timeLeft <= 0) this.gameFinished()
    }, 100)

    // 生成上方目标
    this.spawnTimerTop = setInterval(() => {
      this.spawnItem('top')
    }, config.spawnInterval)

    // 生成下方目标（错开一半间隔）
    setTimeout(() => {
      this.spawnTimerBottom = setInterval(() => {
        this.spawnItem('bottom')
      }, config.spawnInterval)
    }, config.spawnInterval / 2)

    // 立即各生成一个
    this.spawnItem('top')
    setTimeout(() => this.spawnItem('bottom'), config.spawnInterval / 2)
  },

  stopGame() {
    if (this.gameTimer) { clearInterval(this.gameTimer); this.gameTimer = null }
    if (this.spawnTimerTop) { clearInterval(this.spawnTimerTop); this.spawnTimerTop = null }
    if (this.spawnTimerBottom) { clearInterval(this.spawnTimerBottom); this.spawnTimerBottom = null }
  },

  spawnItem(half) {
    const config = DIFFICULTY_CONFIG[this.data.difficulty]
    const value = Math.floor(Math.random() * 9) + 1
    const color = ITEM_COLORS[Math.floor(Math.random() * ITEM_COLORS.length)]
    const id = ++this.itemIdCounter
    const x = Math.random() * 70 + 10
    const y = Math.random() * 60 + 15
    const item = { id, value, color, x, y }
    const key = half === 'top' ? 'topItems' : 'bottomItems'
    const items = [...this.data[key], item]
    this.setData({ [key]: items })

    // 自动消失
    setTimeout(() => {
      this.removeItem(half, id)
    }, config.itemLife)
  },

  removeItem(half, id) {
    const key = half === 'top' ? 'topItems' : 'bottomItems'
    const totalKey = half === 'top' ? 'topTotal' : 'bottomTotal'
    const items = this.data[key].filter(t => t.id !== id)
    if (items.length < this.data[key].length) {
      this.setData({ [key]: items, [totalKey]: this.data[totalKey] + 1 })
    }
  },

  isTarget(value, rule, colorName) {
    if (rule === 'even') return value % 2 === 0
    if (rule === 'odd') return value % 2 !== 0
    if (rule === 'big') return value >= 5
    if (rule === 'small') return value < 5
    if (rule === 'red') return colorName === 'red'
    if (rule === 'blue') return colorName === 'blue'
    if (rule === 'mult3') return value % 3 === 0
    if (rule === 'notmult3') return value % 3 !== 0
    if (rule === 'prime') return [2, 3, 5, 7].includes(value)
    if (rule === 'notprime') return ![2, 3, 5, 7].includes(value)
    return false
  },

  tapTopItem(e) {
    if (this.data.gameState !== 'playing') return
    const { id } = e.currentTarget.dataset
    const item = this.data.topItems.find(t => t.id === id)
    if (!item) return

    const isCorrect = this.isTarget(item.value, this.data.topTask.rule, item.color.name)
    if (isCorrect) {
      vibrate('light')
      this.setData({ topScore: this.data.topScore + 1 })
    } else {
      vibrate('heavy')
    }
    this.removeItem('top', id)
  },

  tapBottomItem(e) {
    if (this.data.gameState !== 'playing') return
    const { id } = e.currentTarget.dataset
    const item = this.data.bottomItems.find(t => t.id === id)
    if (!item) return

    const isCorrect = this.isTarget(item.value, this.data.bottomTask.rule, item.color.name)
    if (isCorrect) {
      vibrate('light')
      this.setData({ bottomScore: this.data.bottomScore + 1 })
    } else {
      vibrate('heavy')
    }
    this.removeItem('bottom', id)
  },

  gameFinished() {
    this.stopGame()
    wx.removeStorageSync('dual_paused')

    const { topScore, topTotal, bottomScore, bottomTotal } = this.data
    const topAcc = topTotal > 0 ? Math.round(topScore / topTotal * 100) : 0
    const bottomAcc = bottomTotal > 0 ? Math.round(bottomScore / bottomTotal * 100) : 0
    const combinedAcc = Math.round((topAcc + bottomAcc) / 2)

    const rating = getDualRating(topAcc, bottomAcc)
    const ratingColors = { 'S': '#D4A04A', 'A': '#7BAE7F', 'B': '#7BA5A0', 'C': '#D4A574', 'D': '#8A7E72' }
    const ratingColor = ratingColors[rating]

    // 更新最佳成绩
    const { difficulty } = this.data
    const isNewRecord = !app.globalData.userData.bestScores.dual[difficulty] ||
      combinedAcc > (app.globalData.userData.bestScores.dual[difficulty] || 0)
    if (isNewRecord) {
      app.globalData.userData.bestScores.dual[difficulty] = combinedAcc
    }
    if (rating === 'S') {
      app.globalData.userData.bestScores.dual[difficulty] = 'S'
    }

    // 更新打卡
    const today = getTodayString()
    const userData = app.globalData.userData
    userData.streak = calculateStreak(userData.lastPlayDate, userData.streak)
    userData.lastPlayDate = today
    userData.totalGames++

    const points = calcRankPoints('dual', this.data.difficulty, rating)
    const rankResult = app.addRankPoints(points)
    const newAchievements = checkAchievements(userData)
    app.saveUserData()
    app.syncScoreToCloud()

    this.setData({
      gameState: 'finished',
      topAcc,
      bottomAcc,
      combinedAcc,
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
    if (claimed.date === today && claimed.games['dual']) {
      wx.showToast({ title: '今日已使用过双倍积分', icon: 'none' })
      return
    }
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.data.earnedPoints)
      this.setData({ doubleClaimed: true })
      const record = claimed.date === today ? claimed : { date: today, games: {} }
      record.games['dual'] = true
      wx.setStorageSync('double_claimed_date', record)
      wx.showToast({ title: `+${this.data.earnedPoints} 积分`, icon: 'success' })
    }
  },

  restart() {
    wx.removeStorageSync('dual_paused')
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
    markGuided('dual')
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
    return {
      title: `我在${DIFFICULTY_CONFIG[this.data.difficulty].label}双线任务中综合准确率${this.data.combinedAcc}%！`,
      path: '/pages/index/index'
    }
  }
})
