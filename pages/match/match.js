const app = getApp()
const { vibrate, formatTime } = require('../../utils/util')
const { getSkin } = require('../../utils/skins')
const { getMatchRating, calcRankPoints } = require('../../utils/scoring')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../../utils/guide')
const { checkAchievements } = require('../../utils/achievements')
const { getTodayString, calculateStreak } = require('../../utils/daily')

const COLOR_POOL = ['#C07A70', '#7BA5A0', '#7BAE7F', '#D4A574', '#9B8EC4', '#D4915C', '#9CC5C0']

// 限时模式时间限制（秒），0表示无限时
const TIME_LIMITS = { 4: 60, 5: 90, 6: 120, 7: 150, 8: 180 }

Page({
  data: {
    gameState: 'ready',
    gridSize: 4,
    grid: [],
    selectedCell: null,
    score: 0,
    combo: 0,
    maxCombo: 0,
    moves: 0,
    pairsLeft: 0,
    startTime: 0,
    elapsedTime: 0,
    currentTime: '00:00.00',
    timeLimit: 0,
    timeLeft: 0,
    timerDisplay: '',
    rating: '',
    ratingColor: '',
    isNewRecord: false,
    earnedPoints: 0,
    doubleClaimed: false,
    currentSkin: null,
    show: false,
    animating: false,
    pausedAt: 0,

    // 新手引导和玩法说明
    showGuide: false,
    guideStep: 0,
    guideSteps: [],
    showRules: false,
    rulesSections: []
  },

  timer: null,
  nextId: 0,

  onLoad(options) {
    const gridSize = options.level ? parseInt(options.level) : 4
    const savedSkin = wx.getStorageSync('skin') || 'night'
    this.setData({ gridSize, currentSkin: getSkin(savedSkin) })
    this.initGame()

    // 检查是否有暂停的游戏
    const saved = wx.getStorageSync('match_paused')
    if (saved && saved.gridSize === gridSize) {
      wx.showModal({
        title: '发现未完成的游戏',
        content: '是否继续上次的游戏？',
        confirmText: '继续',
        cancelText: '重新开始',
        success: (res) => {
          wx.removeStorageSync('match_paused')
          if (res.confirm) {
            this.setData({
              grid: saved.grid,
              selectedCell: null,
              score: saved.score,
              combo: saved.combo,
              maxCombo: saved.maxCombo,
              moves: saved.moves,
              pairsLeft: saved.pairsLeft,
              elapsedTime: saved.elapsedTime,
              currentTime: formatTime(saved.elapsedTime),
              startTime: Date.now() - saved.elapsedTime,
              timeLimit: saved.timeLimit,
              timeLeft: saved.timeLeft,
              timerDisplay: saved.timerDisplay,
              gameState: 'playing'
            })
            this.startTimer()
          }
        }
      })
    }

    // 加载玩法说明和新手引导
    const gameId = 'match'
    this.setData({ guideSteps: GUIDE_STEPS[gameId], rulesSections: RULES_TEXT[gameId] })
    if ((!saved || saved.gridSize !== gridSize) && !checkGuided(gameId)) {
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
        wx.removeStorageSync('match_paused')
        if (res.confirm) this.resumeGame()
        else this.restart()
      }
    })
  },

  savePausedState() {
    const { gridSize, grid, score, combo, maxCombo, moves, pairsLeft, elapsedTime, timeLimit, timeLeft, timerDisplay } = this.data
    wx.setStorageSync('match_paused', {
      gridSize, grid, score, combo, maxCombo, moves, pairsLeft, elapsedTime, timeLimit, timeLeft, timerDisplay
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
    const { gridSize } = this.data
    const colorCount = Math.min(gridSize + 2, COLOR_POOL.length)
    const grid = this.generateGrid(gridSize, colorCount)

    this.setData({
      gameState: 'ready',
      grid,
      selectedCell: null,
      score: 0,
      combo: 0,
      maxCombo: 0,
      moves: 0,
      pairsLeft: this.countPairs(grid),
      elapsedTime: 0,
      currentTime: '00:00.00',
      rating: '',
      ratingColor: '',
      isNewRecord: false,
      animating: false
    })
    this.stopTimer()
  },

  generateGrid(size, colorCount) {
    const grid = []
    this.nextId = 0
    for (let row = 0; row < size; row++) {
      grid[row] = []
      for (let col = 0; col < size; col++) {
        grid[row][col] = {
          color: COLOR_POOL[Math.floor(Math.random() * colorCount)],
          id: this.nextId++,
          matched: false
        }
      }
    }
    return grid
  },

  countPairs(grid) {
    let pairs = 0
    const size = grid.length
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        if (!grid[row][col].matched) {
          // 检查右边和下面是否有同色
          if (col + 1 < size && !grid[row][col + 1].matched && grid[row][col].color === grid[row][col + 1].color) pairs++
          if (row + 1 < size && !grid[row + 1][col].matched && grid[row][col].color === grid[row + 1][col].color) pairs++
        }
      }
    }
    return pairs
  },

  startGame() {
    const timeLimit = TIME_LIMITS[this.data.gridSize] || 0
    this.setData({
      gameState: 'playing',
      startTime: Date.now(),
      timeLimit,
      timeLeft: timeLimit
    })
    this.startTimer()
  },

  startTimer() {
    const startTime = this.data.startTime
    const { timeLimit } = this.data
    this.timer = setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000
      if (timeLimit > 0) {
        const timeLeft = Math.max(0, timeLimit - elapsed)
        const mins = Math.floor(timeLeft / 60)
        const secs = Math.floor(timeLeft % 60)
        this.setData({
          elapsedTime: elapsed,
          timeLeft,
          timerDisplay: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        })
        if (timeLeft <= 0) this.gameFinished()
      } else {
        const mins = Math.floor(elapsed / 60)
        const secs = Math.floor(elapsed % 60)
        const ms = Math.floor((elapsed % 1) * 100)
        this.setData({
          elapsedTime: elapsed,
          currentTime: `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`
        })
      }
    }, 50)
  },

  stopTimer() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
  },

  tapCell(e) {
    if (this.data.gameState !== 'playing' || this.data.animating) return
    const { row, col } = e.currentTarget.dataset
    const { grid, selectedCell } = this.data
    const cell = grid[row][col]
    if (cell.matched) return

    if (!selectedCell) {
      this.setData({ selectedCell: { row, col } })
      vibrate('light')
    } else {
      const first = selectedCell
      if (first.row === row && first.col === col) {
        this.setData({ selectedCell: null })
        return
      }

      const firstCell = grid[first.row][first.col]
      const isAdjacent = (Math.abs(first.row - row) + Math.abs(first.col - col)) === 1
      const isSameColor = firstCell.color === cell.color

      if (isAdjacent && isSameColor) {
        // 匹配成功
        vibrate('light')
        const newGrid = grid.map(r => r.map(c => ({ ...c })))
        newGrid[first.row][first.col].matched = true
        newGrid[row][col].matched = true

        const newCombo = this.data.combo + 1
        const comboBonus = Math.floor(newCombo / 3)
        const newScore = this.data.score + 10 + comboBonus * 5
        const newPairsLeft = this.data.pairsLeft - 1

        this.setData({
          grid: newGrid,
          selectedCell: null,
          score: newScore,
          combo: newCombo,
          maxCombo: Math.max(this.data.maxCombo, newCombo),
          moves: this.data.moves + 1,
          pairsLeft: newPairsLeft
        })

        // 重力下落
        setTimeout(() => {
          this.applyGravity()
        }, 150)

        // 检查是否清除完毕
        if (newPairsLeft <= 0) {
          setTimeout(() => this.gameFinished(), 300)
        }
      } else {
        // 不匹配
        vibrate('heavy')
        this.setData({ selectedCell: null, combo: 0 })
      }
    }
  },

  applyGravity() {
    const { grid, gridSize } = this.data
    const newGrid = grid.map(r => r.map(c => ({ ...c })))
    let changed = false

    // 按列处理重力
    for (let col = 0; col < gridSize; col++) {
      let writeRow = gridSize - 1
      for (let row = gridSize - 1; row >= 0; row--) {
        if (!newGrid[row][col].matched) {
          if (writeRow !== row) {
            newGrid[writeRow][col] = { ...newGrid[row][col] }
            newGrid[row][col] = { color: null, id: -1, matched: true }
            changed = true
          }
          writeRow--
        }
      }
      // 填充新方块
      for (let row = writeRow; row >= 0; row--) {
        const colorCount = Math.min(this.data.gridSize + 2, COLOR_POOL.length)
        newGrid[row][col] = {
          color: COLOR_POOL[Math.floor(Math.random() * colorCount)],
          id: this.nextId++,
          matched: false
        }
        changed = true
      }
    }

    if (changed) {
      this.setData({ grid: newGrid, animating: true })
      // 检查连锁
      setTimeout(() => {
        this.checkChainReactions()
      }, 200)
    }
  },

  checkChainReactions() {
    const { grid, gridSize } = this.data
    let hasChain = false

    // 检查所有相邻同色对
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        if (grid[row][col].matched) continue
        // 右
        if (col + 1 < gridSize && !grid[row][col + 1].matched && grid[row][col].color === grid[row][col + 1].color) {
          hasChain = true
          break
        }
        // 下
        if (row + 1 < gridSize && !grid[row + 1][col].matched && grid[row][col].color === grid[row + 1][col].color) {
          hasChain = true
          break
        }
      }
      if (hasChain) break
    }

    this.setData({ animating: false })
    // 连锁不自动消除，需要玩家手动操作
  },

  gameFinished() {
    this.stopTimer()
    wx.removeStorageSync('match_paused')

    const { gridSize, score, elapsedTime } = this.data
    const timeUsed = Math.round(elapsedTime * 10) / 10
    const rating = getMatchRating(score, gridSize)
    const ratingColors = { 'S': '#D4A04A', 'A': '#7BAE7F', 'B': '#7BA5A0', 'C': '#D4A574', 'D': '#8A7E72' }
    const ratingColor = ratingColors[rating]

    // 更新最佳成绩
    const isNewRecord = !app.globalData.userData.bestScores.match[gridSize] ||
      score > (app.globalData.userData.bestScores.match[gridSize] || 0)
    if (isNewRecord) {
      app.globalData.userData.bestScores.match[gridSize] = score
    }
    if (this.data.maxCombo > (app.globalData.userData.bestScores.match._maxCombo || 0)) {
      app.globalData.userData.bestScores.match._maxCombo = this.data.maxCombo
    }
    if (this.data.pairsLeft <= 0) {
      app.globalData.userData.bestScores.match._cleared = true
    }

    // 更新打卡
    const today = getTodayString()
    const userData = app.globalData.userData
    userData.streak = calculateStreak(userData.lastPlayDate, userData.streak)
    userData.lastPlayDate = today
    userData.totalGames++

    const points = calcRankPoints('match', gridSize, rating)
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
    if (claimed.date === today && claimed.games['match']) {
      wx.showToast({ title: '今日已使用过双倍积分', icon: 'none' })
      return
    }
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.data.earnedPoints)
      this.setData({ doubleClaimed: true })
      const record = claimed.date === today ? claimed : { date: today, games: {} }
      record.games['match'] = true
      wx.setStorageSync('double_claimed_date', record)
      wx.showToast({ title: `+${this.data.earnedPoints} 积分`, icon: 'success' })
    }
  },

  restart() {
    wx.removeStorageSync('match_paused')
    this.initGame()
  },

  nextLevel() {
    const levels = [4, 5, 6, 7, 8]
    const currentIndex = levels.indexOf(this.data.gridSize)
    if (currentIndex < levels.length - 1) {
      this.setData({ gridSize: levels[currentIndex + 1] })
    }
    this.initGame()
  },

  selectLevel(e) {
    const { level } = e.currentTarget.dataset
    this.setData({ gridSize: parseInt(level) })
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
    markGuided('match')
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
      title: `我在${this.data.gridSize}×${this.data.gridSize}色彩消除中得到${this.data.score}分！来挑战我`,
      path: '/pages/index/index'
    }
  }
})
