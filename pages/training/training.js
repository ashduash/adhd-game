const app = getApp()
const { RANKS } = require('../../utils/util')
const { getSkin } = require('../../utils/skins')
const { TRAINING_DAYS, getCurrentDayIndex, isTodayCompleted } = require('../../utils/training')

Page({
  data: {
    trainingPlan: null,
    currentDay: null,
    dayIndex: 0,
    isCompleted: false,
    totalDays: 5,
    completedDays: 0,
    currentSkin: null,
    show: false
  },

  onLoad() {
    const savedSkin = wx.getStorageSync('skin') || 'night'
    this.setData({ currentSkin: getSkin(savedSkin) })
    this.loadTraining()
    setTimeout(() => { this.setData({ show: true }) }, 100)
  },

  onShow() {
    this.loadTraining()
  },

  loadTraining() {
    const userData = app.globalData.userData
    let trainingPlan = userData.trainingPlan

    // 初始化训练计划
    if (!trainingPlan || !trainingPlan.cycleStart) {
      const today = new Date()
      const cycleStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
      trainingPlan = {
        cycleStart,
        dayIndex: 0,
        completed: []
      }
      userData.trainingPlan = trainingPlan
      app.saveUserData()
    }

    const dayIndex = getCurrentDayIndex(trainingPlan)
    const currentDay = TRAINING_DAYS[dayIndex]
    const isCompleted = isTodayCompleted(trainingPlan)

    this.setData({
      trainingPlan,
      currentDay,
      dayIndex,
      isCompleted,
      completedDays: trainingPlan.completed.length
    })
  },

  startGame(e) {
    const { mode, level } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/${mode}/${mode}?level=${level}&training=true`
    })
  },

  goHome() {
    wx.navigateBack()
  },

  onShareAppMessage() {
    return {
      title: '我在专注风暴进行每日训练计划，来一起锻炼大脑！',
      path: '/pages/index/index'
    }
  }
})
