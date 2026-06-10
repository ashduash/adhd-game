/**
 * 专注风暴 - 微信小游戏入口
 * 所有UI通过Canvas绘制，替代原小程序的WXML/WXSS
 */

// 获取画布和上下文
const canvas = wx.createCanvas()
const ctx = canvas.getContext('2d')

// 获取屏幕信息
const { windowWidth, windowHeight, pixelRatio } = wx.getSystemInfoSync()

// 设置画布物理尺寸（DPR 适配解决模糊问题）
canvas.width = windowWidth * pixelRatio
canvas.height = windowHeight * pixelRatio
// 缩放绘制坐标系，使绘制逻辑保持使用逻辑像素
ctx.scale(pixelRatio, pixelRatio)

// 适配高刷屏（120Hz）
if (wx.setPreferredFramesPerSecond) {
  wx.setPreferredFramesPerSecond(120)
}

console.log(`画布物理尺寸: ${canvas.width}x${canvas.height}, 逻辑尺寸: ${windowWidth}x${windowHeight}, DPR: ${pixelRatio}`)

// 全局错误拦截：抑制 insertTextView/updateTextView/insertImageView 等非致命框架错误
// Canvas-only 小游戏无原生父容器，广告SDK和框架内部创建的原生视图会触发这些错误
const _NATIVE_VIEW_ERR = /insertTextView|updateTextView|insertImageView|updateImageView|appServiceSDKScriptError|:fail.*not found/
function _isNativeViewError(msg) {
  if (!msg) return false
  if (typeof msg === 'string') return _NATIVE_VIEW_ERR.test(msg)
  if (msg instanceof Error) return _NATIVE_VIEW_ERR.test(msg.message || '')
  if (typeof msg === 'object' && msg.errMsg) return _NATIVE_VIEW_ERR.test(msg.errMsg)
  return false
}
const _origConsoleError = console.error.bind(console)
console.error = function () {
  if (_isNativeViewError(arguments[0])) return
  _origConsoleError.apply(this, arguments)
}
const _origConsoleWarn = console.warn.bind(console)
console.warn = function () {
  if (_isNativeViewError(arguments[0])) return
  _origConsoleWarn.apply(this, arguments)
}
if (wx.onError) {
  wx.onError(function (msg) {
    // 抑制原生视图相关错误，其他错误正常输出
    if (!_isNativeViewError(msg)) console.error('[wx.onError]', msg)
  })
}
if (wx.onUncaughtError) {
  wx.onUncaughtError(function (res) {
    if (_isNativeViewError(res && res.message ? res.message : res)) return true
  })
}
// 引入模块
const SceneManager = require('./js/base/scene-manager')
const TabBar = require('./js/base/ui/tab-bar')
const Toast = require('./js/base/ui/toast')
const Modal = require('./js/base/ui/modal')
const app = require('./js/app')
const ads = require('./js/utils/ads')
const THEME = require('./js/config/theme')
const AudioManager = require('./js/utils/audio')

// 云开发延迟初始化（不在启动时调用，避免 insertTextView 崩溃）
// 在首帧渲染后再初始化，此时 Canvas 已稳定
GameGlobal._cloudReady = false
setTimeout(() => {
  if (wx.cloud) {
    try {
      // traceUser: false 避免框架创建 native view（Canvas-only 小游戏无 parent 节点）
      wx.cloud.init({ env: 'cloud1-d3g8g2icn594133d1', traceUser: false })
      GameGlobal._cloudReady = true
    } catch (e) {
      console.warn('云开发初始化失败，内容安全检测将使用服务端接口:', e)
    }
  }
}, 1000)

// 初始化全局状态
app.init()

// 初始化广告
ads.createRewardedAd()
ads.createInterstitialAd()

// 初始化音频管理器
const audioManager = new AudioManager()

// 创建场景管理器
const sceneManager = new SceneManager()

// 创建 Tab 栏
const tabBar = new TabBar()
tabBar.loadIcons()
sceneManager.setTabBar(tabBar)

// 创建全局 Toast
const toast = new Toast()

// 注册所有场景
// 使用延迟加载避免循环依赖
const sceneRegistry = {
  'home': () => require('./js/scenes/home-scene'),
  'rank': () => require('./js/scenes/rank-scene'),
  'profile': () => require('./js/scenes/profile-scene'),
  'schulte': () => require('./js/scenes/schulte-scene'),
  'memory': () => require('./js/scenes/memory-scene'),
  'scan': () => require('./js/scenes/scan-scene'),
  'stroop': () => require('./js/scenes/stroop-scene'),
  'react': () => require('./js/scenes/react-scene'),
  'match': () => require('./js/scenes/match-scene'),
  'sort': () => require('./js/scenes/sort-scene'),
  'dual': () => require('./js/scenes/dual-scene'),
  'training': () => require('./js/scenes/training-scene'),
  'about': () => require('./js/scenes/about-scene')
}

// 延迟注册场景类
for (const [name, loader] of Object.entries(sceneRegistry)) {
  sceneManager.register(name, loader())
}

// 设置 Tab 场景
sceneManager.setTabScenes({
  home: new (sceneRegistry.home())(),
  rank: new (sceneRegistry.rank())(),
  profile: new (sceneRegistry.profile())()
})
// 标记 Tab 场景
sceneManager.tabScenes.home._isTab = true
sceneManager.tabScenes.rank._isTab = true
sceneManager.tabScenes.profile._isTab = true

// 初始进入首页
sceneManager.switchTab('home')

// 全局暴露（供场景访问）
GameGlobal.app = app
GameGlobal.toast = toast
GameGlobal.sceneManager = sceneManager
GameGlobal.canvas = canvas
GameGlobal.ctx = ctx
GameGlobal.audio = audioManager

// 触摸事件处理
let _audioInited = false
wx.onTouchStart((e) => {
  if (e.touches.length > 0) {
    const touch = e.touches[0]
    sceneManager.dispatchTouch('TouchStart', touch.clientX, touch.clientY)
  }
  // 首次触摸初始化音频（Web Audio API 需要用户交互）
  if (!_audioInited) {
    _audioInited = true
    audioManager.init()
    audioManager.playBGM()
  }
})

wx.onTouchMove((e) => {
  if (e.touches.length > 0) {
    const touch = e.touches[0]
    sceneManager.dispatchTouch('TouchMove', touch.clientX, touch.clientY)
  }
})

wx.onTouchEnd((e) => {
  if (e.changedTouches.length > 0) {
    const touch = e.changedTouches[0]
    sceneManager.dispatchTouch('TouchEnd', touch.clientX, touch.clientY)
  }
})

// 暂停/恢复处理
wx.onShow(() => {
  // 重验证登录状态：若已失效，中断游戏返回首页显示登录遮罩
  if (!app.isLoggedIn()) {
    sceneManager.switchTab('home')
    return
  }
  audioManager.resumeBGM()
  const scene = sceneManager.top()
  if (scene && scene.onResume) scene.onResume()
})

wx.onHide(() => {
  audioManager.pauseBGM()
  const scene = sceneManager.top()
  if (scene && scene.onPause) scene.onPause()
})

// 游戏主循环
let lastTime = Date.now()

function gameLoop() {
  const now = Date.now()
  const dt = Math.min((now - lastTime) / 1000, 0.1) // 限制最大dt防止跳帧
  lastTime = now

  // 更新
  sceneManager.update(dt)
  toast.update(dt)

  // 渲染
  ctx.clearRect(0, 0, windowWidth, windowHeight)
  sceneManager.render(ctx)
  toast.draw(ctx)

  requestAnimationFrame(gameLoop)
}

// 启动游戏循环
requestAnimationFrame(gameLoop)

console.log('专注风暴小游戏已启动')
