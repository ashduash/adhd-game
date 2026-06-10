const app = getApp()
const { RANKS } = require('../../utils/util')
const { checkContent, checkLocal } = require('../../utils/sensitive-filter')

Page({
  data: {
    currentTab: 'points',
    rankList: [],
    myRank: null,
    isLoggedIn: false,
    userInfo: null,
    loading: true,
    show: false
  },

  onLoad() {
    this.checkLogin()
    setTimeout(() => { this.setData({ show: true }) }, 100)
  },

  onShow() {
    if (this.data.isLoggedIn) {
      this.loadRankData()
    }
  },

  // 检查是否已登录
  checkLogin() {
    const nickName = wx.getStorageSync('nickName')
    if (nickName) {
      this.setData({
        isLoggedIn: true,
        userInfo: { nickName, avatarUrl: wx.getStorageSync('avatarUrl') || '' },
        loading: false
      })
      this.loadRankData()
    } else {
      this.setData({ loading: false })
    }
  },

  // 输入昵称
  onInputNickname(e) {
    this.setData({ 'userInfo.nickName': e.detail.value })
  },

  // 确认登录
  async onConfirmLogin() {
    const { userInfo } = this.data
    if (!userInfo || !userInfo.nickName) {
      wx.showToast({ title: '请输入昵称', icon: 'none' })
      return
    }

    wx.showLoading({ title: '内容检测中...' })

    // 内容安全检查（本地 + 服务端 msgSecCheck）
    const check = await checkContent(userInfo.nickName, app.globalData.serverUrl)
    if (!check.pass) {
      wx.hideLoading()
      wx.showToast({ title: check.reason, icon: 'none' })
      return
    }

    // 保存到本地
    wx.setStorageSync('nickName', userInfo.nickName)
    wx.setStorageSync('avatarUrl', userInfo.avatarUrl || '')

    // 注册到服务器
    await app.loginToServer(userInfo.nickName, userInfo.avatarUrl || '')

    // 同步当前分数
    app.syncScoreToCloud()

    this.setData({ isLoggedIn: true })
    wx.hideLoading()
    this.loadRankData()
  },

  // 加载排行榜数据
  async loadRankData() {
    this.setData({ loading: true })

    const data = await app.getRankList()
    if (!data) {
      this.setData({ loading: false })
      wx.showToast({ title: '连接服务器失败', icon: 'none' })
      return
    }

    const { RANKS } = require('../../utils/util')

    const rankList = (data.rankList || []).map((user, index) => ({
      id: user.openid,
      // 过滤敏感词昵称
      name: this.filterSensitiveName(user.nickName),
      avatar: this.getRandomAvatar(),
      avatarUrl: user.avatarUrl || '',
      score: user.rankPoints || 0,
      rank: user.rank || 'bronze',
      rankInfo: RANKS[user.rank] || RANKS.bronze,
      position: index + 1,
      isMe: user.openid === app.globalData.openid
    }))

    let myRank = null
    if (data.myRank) {
      myRank = {
        position: data.myRank.position,
        name: this.filterSensitiveName(data.myRank.nickName) || '我',
        avatarUrl: data.myRank.avatarUrl || '',
        score: data.myRank.rankPoints || 0,
        rank: data.myRank.rank || 'bronze',
        rankInfo: RANKS[data.myRank.rank] || RANKS.bronze
      }
    }

    this.setData({ rankList, myRank, loading: false })
  },

  // 过滤敏感词昵称
  filterSensitiveName(nickName) {
    if (!nickName) return '匿名玩家'
    const check = checkLocal(nickName)
    return check.pass ? nickName : '匿名玩家'
  },

  getRandomAvatar() {
    const avatars = ['😊', '🎮', '🧠', '⚡', '🎯', '🌟', '🔥', '💎']
    return avatars[Math.floor(Math.random() * avatars.length)]
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({ currentTab: tab })
  },

  viewUser() {
    wx.showToast({ title: '功能开发中', icon: 'none' })
  }
})
