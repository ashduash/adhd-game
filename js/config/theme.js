/**
 * 主题配置 - 支持深色/白色主题切换
 */
const sysInfo = wx.getSystemInfoSync()
const windowWidth = sysInfo.windowWidth
const rpx = windowWidth / 750

// 安全区域适配（刘海屏、底部横条）
const safeArea = sysInfo.safeArea || { top: 0, bottom: sysInfo.windowHeight }
const safeAreaInsets = sysInfo.safeAreaInsets || { top: 0, right: 0, bottom: 0, left: 0 }
// 底部安全区域高度（iPhone X 及以上有 Home Indicator）
const bottomSafeArea = safeAreaInsets.bottom || Math.max(0, sysInfo.windowHeight - safeArea.bottom)

// 深色主题 — 暖岩调
const DARK_COLORS = {
  bgGradient: ['#1C1715', '#2A2320'],
  bgColor: '#1C1715',
  bgLight: '#2A2320',
  textPrimary: '#F5EDE6',
  textSecondary: 'rgba(245,237,230,0.5)',
  textAccent: '#D4A574',
  cardBg: 'rgba(245,237,230,0.07)',
  cardBgLight: 'rgba(245,237,230,0.04)',
  cardBorder: 'rgba(245,237,230,0.1)',
  cardBorderLight: 'rgba(245,237,230,0.06)',
  btnSecondaryBg: 'rgba(245,237,230,0.08)',
  btnSecondaryBorder: 'rgba(245,237,230,0.15)',
  overlayBg: 'rgba(15,12,10,0.78)',
  modalBg: 'rgba(38,32,28,0.98)',
  tabBarBg: 'rgba(28,23,21,0.96)',
  tabBarDivider: 'rgba(245,237,230,0.08)',
  tabBarInactive: 'rgba(245,237,230,0.35)'
}

// 浅色主题 — 暖纸调
const WHITE_COLORS = {
  bgGradient: ['#F7F2ED', '#EDE5DC'],
  bgColor: '#F7F2ED',
  bgLight: '#EDE5DC',
  textPrimary: '#3D2E22',
  textSecondary: 'rgba(61,46,34,0.5)',
  textAccent: '#A0673F',
  cardBg: 'rgba(255,255,255,0.88)',
  cardBgLight: 'rgba(255,255,255,0.65)',
  cardBorder: 'rgba(61,46,34,0.08)',
  cardBorderLight: 'rgba(61,46,34,0.04)',
  btnSecondaryBg: 'rgba(61,46,34,0.05)',
  btnSecondaryBorder: 'rgba(61,46,34,0.1)',
  overlayBg: 'rgba(30,22,16,0.45)',
  modalBg: 'rgba(255,252,249,0.98)',
  tabBarBg: 'rgba(247,242,237,0.96)',
  tabBarDivider: 'rgba(61,46,34,0.08)',
  tabBarInactive: 'rgba(61,46,34,0.35)'
}

let currentTheme = 'dark'

const THEME = {
  // rpx 转 px 比例
  rpx,

  // 屏幕尺寸
  screenWidth: windowWidth,
  screenHeight: sysInfo.windowHeight,

  // 安全区域
  safeArea,
  safeAreaInsets,
  bottomSafeArea,

  // 状态栏安全区域
  statusBarHeight: sysInfo.statusBarHeight || 20,

  // 主题色（两个主题共用 — 暖调琥珀）
  primaryStart: '#C07A45',
  primaryEnd: '#D4A574',
  primary: '#C07A45',
  primaryLight: '#D4A574',
  btnPrimaryGradient: ['#C07A45', '#D4A574'],
  btnShadow: 'rgba(192,122,69,0.35)',

  // 段位颜色
  rankColors: {
    bronze: '#CD7F32',
    silver: '#B0A898',
    gold: '#D4A04A',
    platinum: '#7BA5A0',
    diamond: '#9CC5C0',
    master: '#C07A70',
    king: '#D4A04A'
  },

  // 评级颜色
  ratingColors: {
    S: '#D4A04A',
    A: '#7BAE7F',
    B: '#7BA5A0',
    C: '#D4A574',
    D: '#8A7E72'
  },

  // 渐变文字色
  gradientTextStart: '#C07A45',
  gradientTextEnd: '#D4A574',

  // 字体
  fontFamily: "'PingFang SC', 'Noto Sans SC', 'Source Han Sans SC', 'Microsoft YaHei', sans-serif",

  // 常用尺寸（增大字号提升可读性）
  fontSize: {
    xs: 24 * rpx,
    sm: 28 * rpx,
    md: 32 * rpx,
    lg: 36 * rpx,
    xl: 42 * rpx,
    xxl: 52 * rpx,
    title: 64 * rpx
  },

  // 右上角安全距离（避开微信菜单按钮，约44px）
  rightSafePad: Math.max(safeAreaInsets.right, 100 * rpx),

  // 卡片和按钮
  cardRadius: 32 * rpx,
  cardPadding: 32 * rpx,
  btnRadius: 24 * rpx,

  // Tab 栏高度
  tabBarHeight: 120 * rpx + bottomSafeArea,

  // 导航栏高度
  navBarHeight: 88 * rpx,

  // 内容区顶部安全距离（避开退出按钮）
  contentTopPadding: 24 * rpx,

  // 间距
  spacing: {
    xs: 8 * rpx,
    sm: 12 * rpx,
    md: 16 * rpx,
    lg: 24 * rpx,
    xl: 32 * rpx,
    xxl: 48 * rpx
  },

  // 当前主题名称
  get currentTheme() { return currentTheme }
}

// 应用主题颜色到 THEME 对象
function applyColors(colors) {
  Object.keys(colors).forEach(key => {
    THEME[key] = colors[key]
  })
}

// 设置主题
function setTheme(themeName) {
  currentTheme = themeName
  const colors = themeName === 'white' ? WHITE_COLORS : DARK_COLORS
  applyColors(colors)
}

// 获取当前主题名称
function getTheme() {
  return currentTheme
}

// 初始化默认主题
setTheme('dark')

module.exports = THEME
module.exports.setTheme = setTheme
module.exports.getTheme = getTheme
