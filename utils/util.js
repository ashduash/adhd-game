/**
 * 工具函数
 */

// 格式化时间 (毫秒 -> 分:秒.毫秒)
const formatTime = (ms) => {
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.floor((ms % 60000) / 1000)
  const milliseconds = Math.floor((ms % 1000) / 10)
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`
}

// 格式化秒数
const formatSeconds = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}分${secs}秒`
  }
  return `${secs}秒`
}

// 生成随机数组 (1~n)
const shuffleArray = (n) => {
  const arr = Array.from({ length: n }, (_, i) => i + 1)
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

// 生成随机数字序列
const generateRandomSequence = (length, max = 99) => {
  const numbers = new Set()
  while (numbers.size < length) {
    numbers.add(Math.floor(Math.random() * max) + 1)
  }
  return Array.from(numbers)
}

// 计算评级
const calculateRating = (time, thresholds) => {
  if (time <= thresholds[0]) return 'S'
  if (time <= thresholds[1]) return 'A'
  if (time <= thresholds[2]) return 'B'
  if (time <= thresholds[3]) return 'C'
  return 'D'
}

// 获取评级颜色
const getRatingColor = (rating) => {
  const colors = {
    'S': '#D4A04A',
    'A': '#7BAE7F',
    'B': '#7BA5A0',
    'C': '#D4A574',
    'D': '#8A7E72'
  }
  return colors[rating] || '#F5EDE6'
}

// 段位信息
const RANKS = {
  bronze: { name: '青铜', color: '#CD7F32', icon: '🥉', minPoints: 0 },
  silver: { name: '白银', color: '#C0C0C0', icon: '🥈', minPoints: 100 },
  gold: { name: '黄金', color: '#FFD700', icon: '🥇', minPoints: 300 },
  platinum: { name: '铂金', color: '#00CED1', icon: '💎', minPoints: 600 },
  diamond: { name: '钻石', color: '#B9F2FF', icon: '💠', minPoints: 1000 },
  master: { name: '大师', color: '#FF6B6B', icon: '👑', minPoints: 1500 },
  king: { name: '王者', color: '#FFD700', icon: '🏆', minPoints: 2000 }
}

// 获取段位进度
const getRankProgress = (rank, points) => {
  const ranks = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'king']
  const pointsNeeded = [0, 100, 300, 600, 1000, 1500, 2000]
  const currentIndex = ranks.indexOf(rank)

  if (currentIndex >= ranks.length - 1) {
    return { progress: 1, nextRank: null, pointsNeeded: 0 }
  }

  const currentMin = pointsNeeded[currentIndex]
  const nextMin = pointsNeeded[currentIndex + 1]
  const progress = (points - currentMin) / (nextMin - currentMin)

  return {
    progress: Math.min(1, Math.max(0, progress)),
    nextRank: ranks[currentIndex + 1],
    pointsNeeded: nextMin - points
  }
}

// 震动反馈
const vibrate = (type = 'light') => {
  if (wx.vibrateShort) {
    wx.vibrateShort({ type })
  }
}

// 显示提示
const showToast = (title, icon = 'none') => {
  wx.showToast({
    title,
    icon,
    duration: 1500
  })
}

// 节流函数
const throttle = (fn, delay) => {
  let timer = null
  return function (...args) {
    if (!timer) {
      timer = setTimeout(() => {
        fn.apply(this, args)
        timer = null
      }, delay)
    }
  }
}

module.exports = {
  formatTime,
  formatSeconds,
  shuffleArray,
  generateRandomSequence,
  calculateRating,
  getRatingColor,
  RANKS,
  getRankProgress,
  vibrate,
  showToast,
  throttle
}
