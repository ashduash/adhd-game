/**
 * 底部 Tab 栏组件
 */
const THEME = require('../../config/theme')
const { fillRoundedRect } = require('../draw-utils')

class TabBar {
  constructor() {
    this.height = THEME.tabBarHeight
    this.tabs = [
      { name: 'home', text: '首页', icon: null, activeIcon: null },
      { name: 'rank', text: '排行', icon: null, activeIcon: null },
      { name: 'profile', text: '我的', icon: null, activeIcon: null }
    ]
    this.activeTab = 'home'
    this._iconsLoaded = false
  }

  // 加载图标
  loadIcons() {
    this.tabs.forEach(tab => {
      const img1 = wx.createImage()
      img1.src = `images/${tab.name}.png`
      img1.onload = () => { img1.loaded = true }
      tab.icon = img1

      const img2 = wx.createImage()
      img2.src = `images/${tab.name}-active.png`
      img2.onload = () => { img2.loaded = true }
      tab.activeIcon = img2
    })
    this._iconsLoaded = true
  }

  draw(ctx) {
    const sw = THEME.screenWidth
    const sh = THEME.screenHeight
    const y = sh - this.height
    const tabWidth = sw / 3

    // 背景（使用主题配置）
    ctx.fillStyle = THEME.tabBarBg
    ctx.fillRect(0, y, sw, this.height)

    // 顶部分隔线
    ctx.strokeStyle = THEME.tabBarDivider
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(sw, y)
    ctx.stroke()

    // Tab 项
    this.tabs.forEach((tab, i) => {
      const isActive = tab.name === this.activeTab
      const cx = tabWidth * i + tabWidth / 2
      const iconY = y + this.height * 0.28

      // 图标 - 使用更大的尺寸
      const img = isActive ? tab.activeIcon : tab.icon
      if (img && img.loaded) {
        const iconSize = 48 * THEME.rpx
        ctx.drawImage(img, cx - iconSize / 2, iconY - iconSize / 2, iconSize, iconSize)
      } else {
        // 图标未加载时用emoji代替，使用大尺寸
        const icons = { home: '🏠', rank: '🏆', profile: '👤' }
        ctx.font = `${48 * THEME.rpx}px ${THEME.fontFamily}`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = isActive ? THEME.primary : THEME.tabBarInactive
        ctx.fillText(icons[tab.name] || '●', cx, iconY)
      }

      // 文字 - 更大更清晰
      ctx.font = `${isActive ? '600' : '400'} ${22 * THEME.rpx}px ${THEME.fontFamily}`
      ctx.fillStyle = isActive ? THEME.primary : THEME.tabBarInactive
      ctx.textAlign = 'center'
      ctx.textBaseline = 'top'
      ctx.fillText(tab.text, cx, y + this.height * 0.58)

      // 选中指示器
      if (isActive) {
        const indicatorW = 32 * THEME.rpx
        const indicatorH = 4 * THEME.rpx
        const indicatorX = cx - indicatorW / 2
        const indicatorY = y + 4 * THEME.rpx
        fillRoundedRect(ctx, indicatorX, indicatorY, indicatorW, indicatorH, indicatorH / 2, THEME.primary)
      }
    })
  }

  hitTest(x, y) {
    return y >= THEME.screenHeight - this.height
  }

  getTabAt(x) {
    const tabWidth = THEME.screenWidth / 3
    const index = Math.max(0, Math.min(2, Math.floor(x / tabWidth)))
    return this.tabs[index] ? this.tabs[index].name : null
  }
}

module.exports = TabBar
