/**
 * 场景管理器 - 管理场景栈、导航、生命周期
 */
const THEME = require('../config/theme')

class SceneManager {
  constructor() {
    this.stack = []
    this.sceneClasses = {}
    this.tabScenes = {}
    this.activeTab = 'home'
    this.tabBar = null
    this._transitionAlpha = 0
    this._transitioning = false
    // 触摸锁定：场景切换后短暂屏蔽触摸事件，防止穿透
    this._touchLockedUntil = 0
  }

  // 注册场景类
  register(name, SceneClass) {
    this.sceneClasses[name] = SceneClass
  }

  // 设置 Tab 场景
  setTabScenes(tabs) {
    this.tabScenes = tabs
  }

  // 设置 Tab 栏
  setTabBar(tabBar) {
    this.tabBar = tabBar
  }

  // 压入场景（替代 wx.navigateTo）
  push(sceneName, params) {
    this._lockTouch()
    const current = this.top()
    if (current) current.onHide()

    const SceneClass = this.sceneClasses[sceneName]
    if (!SceneClass) {
      console.error('场景未注册:', sceneName)
      return
    }
    const scene = new SceneClass(params)
    scene.onEnter()
    this.stack.push(scene)
  }

  // 弹出场景（替代 wx.navigateBack）
  pop() {
    if (this.stack.length <= 1) return
    this._lockTouch()
    console.log('[SceneManager] pop, stack depth:', this.stack.length, 'popping:', this.top()?.constructor?.name)
    const top = this.stack.pop()
    try {
      if (top) top.onExit()
      const newTop = this.top()
      if (newTop) newTop.onShow()
    } catch (e) {
      console.error('pop error:', e)
      this.stack.push(top)
    }
  }

  // 切换 Tab（替代 wx.switchTab）
  switchTab(tabName) {
    // 未登录时禁止切换到排行/个人页
    if (tabName !== 'home' && GameGlobal.app && !GameGlobal.app.isLoggedIn()) {
      if (GameGlobal.toast) GameGlobal.toast.show('请先登录')
      return
    }
    this._lockTouch()
    console.log('[switchTab] 目标:', tabName, '当前栈:', this.stack.map(s => s.constructor.name).join(' → '))
    // 弹出所有非 Tab 场景
    while (this.stack.length > 1 && !this.stack[this.stack.length - 1]._isTab) {
      const scene = this.stack.pop()
      console.log('[switchTab] 弹出:', scene.constructor.name)
      try { scene.onExit() } catch (e) { console.error('switchTab onExit error:', e) }
    }
    console.log('[switchTab] 弹出后栈:', this.stack.map(s => s.constructor.name).join(' → '))

    const current = this.top()
    if (current) current.onHide()

    this.activeTab = tabName
    if (this.tabBar) this.tabBar.activeTab = tabName

    // 将 Tab 场景设为栈顶
    const tabScene = this.tabScenes[tabName]
    if (tabScene) {
      const isFirstShow = !tabScene._hasEntered
      // 检查是否已在栈中
      const idx = this.stack.indexOf(tabScene)
      if (idx >= 0) {
        this.stack.splice(idx, 1)
      }
      this.stack.push(tabScene)
      if (isFirstShow) {
        tabScene._hasEntered = true
        tabScene.onEnter()
      } else {
        tabScene.onShow()
      }
    }
  }

  // 锁定触摸事件（防止场景切换时触摸穿透）
  _lockTouch(ms) {
    this._touchLockedUntil = Date.now() + (ms || 300)
  }

  // 获取栈顶场景
  top() {
    return this.stack[this.stack.length - 1]
  }

  // 每帧更新
  update(dt) {
    const scene = this.top()
    if (scene) scene.update(dt)
  }

  // 每帧渲染
  render(ctx) {
    const scene = this.top()
    if (scene) {
      scene.render(ctx)
    }

    // 绘制 Tab 栏（仅 Tab 场景显示）
    if (this.tabBar && this.top() && this.top()._isTab) {
      this.tabBar.draw(ctx)
    }
  }

  // 分发触摸事件
  dispatchTouch(type, x, y) {
    // 触摸锁定期间忽略所有触摸事件（防止场景切换时触摸穿透）
    if (Date.now() < this._touchLockedUntil) {
      return
    }

    // Tab 栏拦截 - 所有触摸类型都拦截，防止穿透到场景
    if (this.tabBar && this.top() && this.top()._isTab) {
      if (this.tabBar.hitTest(x, y)) {
        if (type === 'TouchEnd') {
          const tab = this.tabBar.getTabAt(x)
          if (tab && tab !== this.activeTab) {
            this.switchTab(tab)
          }
        }
        return // 拦截所有tab区域的触摸事件，不转发给场景
      }
    }

    // 转发给当前场景
    const scene = this.top()
    if (!scene) return

    switch (type) {
      case 'TouchStart': scene.onTouchStart(x, y); break
      case 'TouchMove': scene.onTouchMove(x, y); break
      case 'TouchEnd': scene.onTouchEnd(x, y); break
    }
  }
}

module.exports = SceneManager
