const app = getApp()
const { generateRandomSequence, vibrate, formatTime } = require('../../utils/util')
const { getSkin } = require('../../utils/skins')
const { GUIDE_STEPS, RULES_TEXT, checkGuided, markGuided } = require('../../utils/guide')
const { getMemoryRating, calcRankPoints } = require('../../utils/scoring')

Page({
  data: {
    // 游戏状态
    gameState: 'ready', // ready, showing, input, finished
    level: 6,           // 数字个数
    sequence: [],       // 目标序列
    userInput: [],      // 用户输入（完整数字）
    showIndex: -1,      // 当前显示的数字索引

    // 逐位输入状态
    currentSlotIndex: 0,   // 当前正在输入第几个数字
    currentDigitIndex: 0,  // 当前输入第几位（0=十位, 1=个位）
    digitFeedback: [],     // 每一位的对错反馈 ['correct'|'wrong', ...]
    slotCorrect: [],       // 每个数字的对错 [true, false, ...]
    currentTens: -1,       // 当前正在输入的十位数字
    displayDigits: [],     // 所有位的显示值 [d0_tens, d0_ones, d1_tens, d1_ones, ...]

    // 计时
    showTime: 3,
    showTimer: 3,
    inputStartTime: 0,
    inputTime: '00:00.00',

    // 成绩
    isPerfect: false,
    isNewRecord: false,
    score: 0,
    rating: '',
    ratingColor: '',
    earnedPoints: 0,
    doubleClaimed: false,

    // 皮肤
    currentSkin: null,

    // 动画
    show: false,
    tappedKey: -1,
    tappedType: '',
    pausedAt: 0,
    pausedState: '',

    // 新手引导和玩法说明
    showGuide: false,
    guideStep: 0,
    guideSteps: [],
    showRules: false,
    rulesSections: []
  },

  showTimer: null,
  inputTimer: null,

  onLoad(options) {
    const level = options.level ? parseInt(options.level) : 6
    const savedSkin = wx.getStorageSync('skin') || 'night'

    this.setData({
      level,
      currentSkin: getSkin(savedSkin)
    })

    this.initGame()

    // 检查是否有暂停的游戏
    const saved = wx.getStorageSync('memory_paused')
    if (saved && saved.level === level) {
      wx.showModal({
        title: '发现未完成的游戏',
        content: '是否继续上次的游戏？',
        confirmText: '继续',
        cancelText: '重新开始',
        success: (res) => {
          wx.removeStorageSync('memory_paused')
          if (res.confirm) {
            const restoredDigits = []
            for (let i = 0; i < level; i++) {
              if (i < saved.userInput.length) {
                restoredDigits.push(Math.floor(saved.userInput[i] / 10))
                restoredDigits.push(saved.userInput[i] % 10)
              } else {
                restoredDigits.push(-1)
                restoredDigits.push(-1)
              }
            }
            this.setData({
              gameState: saved.gameState,
              sequence: saved.sequence,
              userInput: saved.userInput,
              currentSlotIndex: saved.userInput.length,
              currentDigitIndex: 0,
              currentTens: -1,
              digitFeedback: [],
              slotCorrect: [],
              displayDigits: restoredDigits,
              inputStartTime: Date.now() - saved.elapsedTime,
              inputTime: formatTime(saved.elapsedTime)
            })
            if (saved.gameState === 'input') {
              this.inputTimer = setInterval(() => {
                const elapsed = Date.now() - this.data.inputStartTime
                const seconds = Math.floor(elapsed / 1000)
                const ms = Math.floor((elapsed % 1000) / 10)
                this.setData({
                  inputTime: `00:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
                })
              }, 10)
            }
          }
        }
      })
    }

    // 加载玩法说明和新手引导
    const gameId = 'memory'
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
    this.clearTimers()
    const { gameState } = this.data
    if (gameState === 'showing' || gameState === 'input') {
      this.savePausedState()
    }
  },

  onHide() {
    const { gameState } = this.data
    if (gameState !== 'showing' && gameState !== 'input') return
    this.clearTimers()
    this.savePausedState()
    this.setData({ pausedAt: Date.now(), pausedState: gameState, gameState: 'paused' })
  },

  onShow() {
    if (this.data.gameState !== 'paused') return
    wx.showModal({
      title: '游戏暂停',
      content: '是否继续游戏？',
      confirmText: '继续',
      cancelText: '重新开始',
      success: (res) => {
        wx.removeStorageSync('memory_paused')
        if (res.confirm) this.resumeGame()
        else this.restart()
      }
    })
  },

  savePausedState() {
    const { level, sequence, userInput, inputStartTime, pausedState } = this.data
    const elapsedTime = pausedState === 'input' ? Date.now() - inputStartTime : 0
    wx.setStorageSync('memory_paused', {
      level, sequence, userInput, elapsedTime, gameState: pausedState
    })
  },

  resumeGame() {
    const { pausedState } = this.data
    if (pausedState === 'showing') {
      this.restart()
    } else {
      const pausedDuration = Date.now() - this.data.pausedAt
      this.setData({
        gameState: 'input',
        inputStartTime: this.data.inputStartTime + pausedDuration
      })
      this.inputTimer = setInterval(() => {
        const elapsed = Date.now() - this.data.inputStartTime
        const seconds = Math.floor(elapsed / 1000)
        const ms = Math.floor((elapsed % 1000) / 10)
        this.setData({
          inputTime: `00:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
        })
      }, 10)
    }
  },

  clearTimers() {
    if (this.showTimer) {
      clearInterval(this.showTimer)
      this.showTimer = null
    }
    if (this.inputTimer) {
      clearInterval(this.inputTimer)
      this.inputTimer = null
    }
  },

  // 更新显示用数字数组
  _updateDisplayDigits() {
    const { level, sequence, userInput, currentSlotIndex, currentDigitIndex, currentTens } = this.data
    const digits = []
    for (let i = 0; i < level; i++) {
      if (i < userInput.length) {
        // 已完成的数字
        digits.push(Math.floor(userInput[i] / 10))
        digits.push(userInput[i] % 10)
      } else if (i === currentSlotIndex && currentDigitIndex === 1 && currentTens >= 0) {
        // 当前正在输入个位，显示已输入的十位
        digits.push(currentTens)
        digits.push(-1) // 个位尚未输入
      } else {
        digits.push(-1)
        digits.push(-1)
      }
    }
    return digits
  },

  // 初始化游戏
  initGame() {
    const { level } = this.data
    const sequence = generateRandomSequence(level, 99)

    this.setData({
      sequence,
      userInput: [],
      currentSlotIndex: 0,
      currentDigitIndex: 0,
      digitFeedback: [],
      slotCorrect: [],
      currentTens: -1,
      displayDigits: Array(level * 2).fill(-1),
      gameState: 'ready',
      showIndex: -1,
      showTimer: Math.max(2, Math.ceil(level * 0.5)),
      inputTime: '00:00.00',
      isPerfect: false,
      isNewRecord: false,
      score: 0,
      rating: '',
      ratingColor: '',
      tappedKey: -1,
      tappedType: ''
    })

    this.clearTimers()
  },

  // 开始游戏
  startGame() {
    this.setData({
      gameState: 'showing',
      showIndex: 0
    })

    const { sequence } = this.data
    let index = 0

    this.showTimer = setInterval(() => {
      index++
      if (index < sequence.length) {
        this.setData({ showIndex: index })
      } else {
        clearInterval(this.showTimer)
        this.showTimer = null
        setTimeout(() => {
          this.startInputPhase()
        }, 500)
      }
    }, 600)
  },

  // 开始输入阶段
  startInputPhase() {
    this.setData({
      gameState: 'input',
      inputStartTime: Date.now(),
      showIndex: -1,
      currentSlotIndex: 0,
      currentDigitIndex: 0,
      digitFeedback: [],
      slotCorrect: [],
      currentTens: -1,
      displayDigits: Array(this.data.level * 2).fill(-1)
    })

    this.inputTimer = setInterval(() => {
      const elapsed = Date.now() - this.data.inputStartTime
      const seconds = Math.floor(elapsed / 1000)
      const ms = Math.floor((elapsed % 1000) / 10)
      this.setData({
        inputTime: `00:${seconds.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`
      })
    }, 10)
  },

  // 点击数字 - 逐位输入
  onDigitTap(e) {
    const { gameState, currentSlotIndex, currentDigitIndex, sequence, level, digitFeedback, userInput, slotCorrect } = this.data
    if (gameState !== 'input') return
    if (currentSlotIndex >= level) return

    const num = parseInt(e.currentTarget.dataset.num)
    const target = sequence[currentSlotIndex]
    const targetTens = Math.floor(target / 10)
    const targetOnes = target % 10

    this.setData({ tappedKey: num })

    // 判断当前位是否正确
    const isCorrect = currentDigitIndex === 0 ? (num === targetTens) : (num === targetOnes)
    const feedback = isCorrect ? 'correct' : 'wrong'
    const newDigitFeedback = [...digitFeedback, feedback]

    if (isCorrect) {
      vibrate('light')
      this.setData({ tappedType: 'success', digitFeedback: newDigitFeedback })
    } else {
      vibrate('heavy')
      this.setData({ tappedType: 'error', digitFeedback: newDigitFeedback })
    }

    if (currentDigitIndex === 0) {
      // 输入十位，记录并等待个位
      this.setData({
        currentDigitIndex: 1,
        currentTens: num,
        displayDigits: this._getDisplayDigits(currentSlotIndex, 1, num)
      })
    } else {
      // 个位输入完毕，确认整个数字
      const enteredNum = this.data.currentTens * 10 + num
      const newUserInput = [...userInput, enteredNum]
      const isSlotCorrect = (enteredNum === target)
      const newSlotCorrect = [...slotCorrect, isSlotCorrect]

      this.setData({
        userInput: newUserInput,
        slotCorrect: newSlotCorrect,
        currentTens: -1
      })

      if (currentSlotIndex + 1 >= level) {
        // 全部输入完毕
        setTimeout(() => {
          this.inputFinished(newSlotCorrect.every(v => v))
        }, 400)
      } else {
        // 进入下一个数字
        setTimeout(() => {
          this.setData({
            currentSlotIndex: currentSlotIndex + 1,
            currentDigitIndex: 0,
            displayDigits: this._getDisplayDigits(currentSlotIndex + 1, 0, -1)
          })
        }, 200)
      }
    }

    setTimeout(() => {
      this.setData({ tappedKey: -1, tappedType: '' })
    }, 150)
  },

  // 计算显示用数字数组
  _getDisplayDigits(slotIdx, digitIdx, tensVal) {
    const { level, userInput } = this.data
    const digits = []
    for (let i = 0; i < level; i++) {
      if (i < userInput.length) {
        digits.push(Math.floor(userInput[i] / 10))
        digits.push(userInput[i] % 10)
      } else if (i === slotIdx && digitIdx === 1 && tensVal >= 0) {
        digits.push(tensVal)
        digits.push(-1)
      } else {
        digits.push(-1)
        digits.push(-1)
      }
    }
    return digits
  },

  // 删除最后一位
  onDeleteTap() {
    const { gameState, currentSlotIndex, currentDigitIndex, userInput, slotCorrect, digitFeedback, level } = this.data
    if (gameState !== 'input') return

    vibrate('light')
    this.setData({ tappedKey: -2 })

    if (currentDigitIndex === 1) {
      // 删除当前数字的十位，回到十位输入状态
      this.setData({
        currentDigitIndex: 0,
        currentTens: -1,
        digitFeedback: digitFeedback.slice(0, -1),
        displayDigits: this._getDisplayDigits(currentSlotIndex, 0, -1)
      })
    } else if (currentSlotIndex > 0) {
      // 删除上一个已完成的数字
      const prevSlot = currentSlotIndex - 1
      const prevNum = userInput[prevSlot]
      const prevTens = Math.floor(prevNum / 10)
      this.setData({
        currentSlotIndex: prevSlot,
        currentDigitIndex: 1,
        currentTens: prevTens,
        userInput: userInput.slice(0, -1),
        slotCorrect: slotCorrect.slice(0, -1),
        digitFeedback: digitFeedback.slice(0, -2),
        displayDigits: this._getDisplayDigits(prevSlot, 1, prevTens)
      })
    }

    setTimeout(() => {
      this.setData({ tappedKey: -1 })
    }, 100)
  },

  // 输入完成
  inputFinished(isPerfect) {
    this.clearTimers()
    wx.removeStorageSync('memory_paused')

    const { sequence, userInput, level, inputStartTime } = this.data
    const inputTime = Date.now() - inputStartTime

    let correctCount = 0
    for (let i = 0; i < level; i++) {
      if (userInput[i] === sequence[i]) {
        correctCount++
      }
    }

    const accuracy = correctCount / level
    const score = Math.floor(accuracy * 100 + (isPerfect ? 50 : 0))
    const inputTimeSeconds = inputTime / 1000

    const isNewRecord = app.updateBestScore('memory', level, inputTime)

    // 计算评级和积分
    const rating = getMemoryRating(accuracy, isPerfect, inputTimeSeconds, level)
    const ratingColors = { 'S': '#D4A04A', 'A': '#7BAE7F', 'B': '#7BA5A0', 'C': '#D4A574', 'D': '#8A7E72' }
    const points = calcRankPoints('memory', level, rating)
    const rankResult = app.addRankPoints(points)

    app.globalData.userData.totalGames++
    app.saveUserData()
    app.syncScoreToCloud()

    this.setData({
      gameState: 'finished',
      isPerfect,
      isNewRecord,
      score,
      rating,
      ratingColor: ratingColors[rating],
      earnedPoints: points,
      doubleClaimed: false
    })

    app.tryShowInterstitial()

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
    if (claimed.date === today && claimed.games['memory']) {
      wx.showToast({ title: '今日已使用过双倍积分', icon: 'none' })
      return
    }
    const watched = await app.showRewardedAd()
    if (watched) {
      app.addRankPoints(this.data.earnedPoints)
      this.setData({ doubleClaimed: true })
      const record = claimed.date === today ? claimed : { date: today, games: {} }
      record.games['memory'] = true
      wx.setStorageSync('double_claimed_date', record)
      wx.showToast({ title: `+${this.data.earnedPoints} 积分`, icon: 'success' })
    }
  },

  // 重新开始
  restart() {
    wx.removeStorageSync('memory_paused')
    this.initGame()
  },

  // 下一难度
  nextLevel() {
    const nextLevel = Math.min(12, this.data.level + 1)
    this.setData({ level: nextLevel })
    this.initGame()
  },

  // 选择难度
  selectLevel(e) {
    const level = parseInt(e.currentTarget.dataset.level)
    this.setData({ level })
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
    markGuided('memory')
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
    const { level, isPerfect } = this.data
    return {
      title: `我${isPerfect ? '完美' : '成功'}记忆了${level}位数字序列！来挑战我的记忆力`,
      path: '/pages/index/index'
    }
  }
})
