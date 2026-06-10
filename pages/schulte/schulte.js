const app = getApp()
const { formatTime, shuffleArray, calculateRating, vibrate } = require('../../utils/util')
const { getSkin, getAllSkins } = require('../../utils/skins')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../../utils/guide')
const { calcRankPoints } = require('../../utils/scoring')

Page({
  data: {
    // 游戏状态
    gameState: 'ready', // ready, playing, finished
    level: 4,           // 网格大小
    grid: [],           // 网格数据
    nextNumber: 1,      // 下一个要点击的数字
    totalNumbers: 16,   // 总数字数

    // 计时
    startTime: 0,
    currentTime: '00:00.00',
    elapsedTime: 0,

    // 成绩
    rating: '',
    ratingColor: '',
    isNewRecord: false,
    earnedPoints: 0,
    doubleClaimed: false,

    // 皮肤
    currentSkin: null,
    skinList: [],
    showSkinPicker: false,

    // 动画
    show: false,
    tappedIndex: -1,
    tappedType: '', // 'success' or 'error'
    pausedAt: 0,

    // 提示模式
    hintMode: false,

    // 新手引导和玩法说明
    showGuide: false,
    guideStep: 0,
    guideSteps: [],
    showRules: false,
    rulesSections: []
  },

  timer: null,

  onLoad(options) {
    const level = options.level ? parseInt(options.level) : 4

    // 加载保存的皮肤偏好
    const savedSkin = wx.getStorageSync('skin') || 'night'
    const allSkins = getAllSkins()
    const skinList = allSkins.map(s => ({
      ...s,
      locked: !app.isSkinUnlocked(s.id)
    }))

    this.setData({
      level,
      currentSkin: getSkin(savedSkin),
      skinList
    })

    this.initGame()

    // 检查是否有暂停的游戏
    const saved = wx.getStorageSync('schulte_paused')
    if (saved && saved.level === level) {
      wx.showModal({
        title: '发现未完成的游戏',
        content: '是否继续上次的游戏？',
        confirmText: '继续',
        cancelText: '重新开始',
        success: (res) => {
          wx.removeStorageSync('schulte_paused')
          if (res.confirm) {
            this.setData({
              grid: saved.grid,
              nextNumber: saved.nextNumber,
              totalNumbers: saved.totalNumbers,
              elapsedTime: saved.elapsedTime,
              currentTime: formatTime(saved.elapsedTime),
              startTime: Date.now() - saved.elapsedTime,
              hintMode: saved.hintMode,
              gameState: 'playing'
            })
            this.startTimer()
          }
        }
      })
    }

    // 加载玩法说明和新手引导
    const gameId = 'schulte'
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
    // 页面销毁时保存暂停状态
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
        wx.removeStorageSync('schulte_paused')
        if (res.confirm) this.resumeGame()
        else this.restart()
      }
    })
  },

  savePausedState() {
    const { level, grid, nextNumber, totalNumbers, elapsedTime, hintMode } = this.data
    wx.setStorageSync('schulte_paused', {
      level, grid, nextNumber, totalNumbers, elapsedTime, hintMode
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

  // 初始化游戏
  initGame() {
    const { level } = this.data
    const totalNumbers = level * level
    const numbers = shuffleArray(totalNumbers)

    const grid = numbers.map((num, index) => ({
      number: num,
      index: index,
      tapped: false,
      isNext: num === 1
    }))

    this.setData({
      grid,
      totalNumbers,
      nextNumber: 1,
      gameState: 'ready',
      currentTime: '00:00.00',
      elapsedTime: 0,
      rating: '',
      isNewRecord: false,
      tappedIndex: -1,
      tappedType: ''
    })
  },

  // 开始游戏
  startGame() {
    this.setData({
      gameState: 'playing',
      startTime: Date.now()
    })
    this.startTimer()
  },

  // 开始计时
  startTimer() {
    this.timer = setInterval(() => {
      const elapsed = Date.now() - this.data.startTime
      this.setData({
        elapsedTime: elapsed,
        currentTime: formatTime(elapsed)
      })
    }, 10)
  },

  // 停止计时
  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  },

  // 点击格子
  tapCell(e) {
    const { gameState, nextNumber, totalNumbers, grid } = this.data
    if (gameState !== 'playing') return

    const { index } = e.currentTarget.dataset
    const cell = grid[index]

    if (cell.tapped) return

    // 添加点击反馈 - 模拟键盘按压效果
    this.setData({ tappedIndex: index })

    if (cell.number === nextNumber) {
      // 正确
      vibrate('light')

      setTimeout(() => {
        const newGrid = grid.map((item, i) => {
          if (i === index) {
            return { ...item, tapped: true }
          }
          if (item.number === nextNumber + 1) {
            return { ...item, isNext: true }
          }
          return item
        })

        const newNext = nextNumber + 1

        this.setData({
          grid: newGrid,
          nextNumber: newNext,
          tappedType: 'success'
        })

        // 清除点击状态
        setTimeout(() => {
          this.setData({ tappedIndex: -1, tappedType: '' })
        }, 150)

        // 检查是否完成
        if (newNext > totalNumbers) {
          this.gameFinished()
        }
      }, 80) // 短暂延迟，模拟真实按压感

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
  gameFinished() {
    this.stopTimer()
    wx.removeStorageSync('schulte_paused')

    const { level, elapsedTime } = this.data
    const elapsedSeconds = elapsedTime / 1000

    // 计算评级
    const thresholds = {
      3: [6, 12, 20, 35],
      4: [12, 24, 42, 70],
      5: [24, 48, 78, 110],
      6: [42, 80, 130, 180],
      7: [72, 144, 220, 320],
      8: [108, 208, 340, 460],
      9: [150, 288, 450, 650],
      10: [210, 400, 630, 900]
    }

    const rating = calculateRating(elapsedSeconds, thresholds[level] || thresholds[4])
    const ratingColors = { 'S': '#D4A04A', 'A': '#7BAE7F', 'B': '#7BA5A0', 'C': '#D4A574', 'D': '#8A7E72' }

    // 检查是否新纪录
    const isNewRecord = app.updateBestScore('schulte', level, elapsedTime)

    // 添加段位积分
    const points = calcRankPoints('schulte', level, rating)
    const rankResult = app.addRankPoints(points)

    // 更新总局数
    app.globalData.userData.totalGames++
    app.saveUserData()
    app.syncScoreToCloud()

    this.setData({
      gameState: 'finished',
      rating,
      ratingColor: ratingColors[rating],
      isNewRecord,
      earnedPoints: points,
      doubleClaimed: false
    })

    // 插屏广告
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

  // 切换提示
  toggleHint() {
    this.setData({ hintMode: !this.data.hintMode })
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
    markGuided('schulte')
    this.setData({ showGuide: false, guideStep: 0 })
  },

  // 玩法说明
  openRules() {
    this.setData({ showRules: true })
  },

  closeRules() {
    this.setData({ showRules: false })
  },

  // 切换皮肤选择器
  toggleSkinPicker() {
    this.setData({ showSkinPicker: !this.data.showSkinPicker })
  },

  // 选择皮肤
  async selectSkin(e) {
    const { id } = e.currentTarget.dataset
    const skin = getSkin(id)

    // 未解锁的皮肤需要看广告
    if (!app.isSkinUnlocked(id)) {
      const watched = await app.showRewardedAd()
      if (watched) {
        app.unlockSkin(id)
        // 更新皮肤列表状态
        const skinList = this.data.skinList.map(s =>
          s.id === id ? { ...s, locked: false } : s
        )
        this.setData({ skinList })
        wx.showToast({ title: `解锁「${skin.name}」`, icon: 'success' })
      }
      return
    }

    // 保存皮肤偏好
    wx.setStorageSync('skin', id)

    this.setData({
      currentSkin: skin,
      showSkinPicker: false
    })
  },

  // 看广告双倍积分
  async watchAdDoublePoints() {
    if (this.data.doubleClaimed) return
    // 每日每游戏限1次
    const today = new Date().toISOString().slice(0, 10)
    const claimed = wx.getStorageSync('double_claimed_date') || { date: '', games: {} }
    if (claimed.date === today && claimed.games['schulte']) {
      wx.showToast({ title: '今日已使用过双倍积分', icon: 'none' })
      return
    }
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.data.earnedPoints)
      this.setData({ doubleClaimed: true })
      // 记录今日已使用
      const record = claimed.date === today ? claimed : { date: today, games: {} }
      record.games['schulte'] = true
      wx.setStorageSync('double_claimed_date', record)
      wx.showToast({ title: `+${this.data.earnedPoints} 积分`, icon: 'success' })
    }
  },

  // 重新开始
  restart() {
    wx.removeStorageSync('schulte_paused')
    this.initGame()
  },

  // 下一难度
  nextLevel() {
    const nextLevel = Math.min(10, this.data.level + 1)
    this.setData({ level: nextLevel })
    this.initGame()
  },

  // 选择难度
  selectLevel(e) {
    const level = parseInt(e.currentTarget.dataset.level)
    this.setData({ level })
    this.initGame()
  },

  // 返回首页
  goHome() {
    wx.navigateBack()
  },

  // 分享成绩
  onShareAppMessage() {
    const { level, currentTime, rating } = this.data
    return {
      title: `我在${level}×${level}数字风暴中获得${rating}评级，用时${currentTime}！来挑战我吧`,
      path: '/pages/index/index'
    }
  }
})
