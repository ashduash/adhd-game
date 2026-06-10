// 新游戏评分标准

// Stroop评级：基于正确率和时间
function getStroopRating(accuracy, timeUsed, questionCount) {
  const timeThresholds = {
    15: [7, 14, 22, 32],
    25: [12, 22, 36, 55],
    35: [17, 32, 50, 75],
    45: [22, 42, 65, 95],
    60: [28, 52, 82, 120]
  }
  const thresholds = timeThresholds[questionCount] || timeThresholds[15]

  if (accuracy >= 100 && timeUsed <= thresholds[0]) return 'S'
  if (accuracy >= 97 && timeUsed <= thresholds[1]) return 'A'
  if (accuracy >= 90 && timeUsed <= thresholds[2]) return 'B'
  if (accuracy >= 75 && timeUsed <= thresholds[3]) return 'C'
  return 'D'
}

// React评级：基于命中率和误点率
function getReactRating(hits, totalTargets, falsePositives) {
  const hitRate = totalTargets > 0 ? hits / totalTargets : 0
  const fpRate = hits + falsePositives > 0 ? falsePositives / (hits + falsePositives) : 0

  if (hitRate >= 0.95 && fpRate < 0.03) return 'S'
  if (hitRate >= 0.85 && fpRate < 0.08) return 'A'
  if (hitRate >= 0.7) return 'B'
  if (hitRate >= 0.5) return 'C'
  return 'D'
}

// Match评级：基于分数和网格大小
function getMatchRating(score, gridSize) {
  const thresholds = {
    4: [300, 200, 120, 70],
    5: [600, 400, 250, 150],
    6: [1050, 700, 400, 240],
    7: [1500, 1000, 600, 360],
    8: [2100, 1400, 840, 500]
  }
  const t = thresholds[gridSize] || thresholds[4]

  if (score >= t[0]) return 'S'
  if (score >= t[1]) return 'A'
  if (score >= t[2]) return 'B'
  if (score >= t[3]) return 'C'
  return 'D'
}

// Sort评级：基于时间
function getSortRating(timeUsed, itemCount) {
  const timeThresholds = {
    9: [4, 8, 15, 26],
    16: [7, 15, 28, 48],
    25: [13, 26, 45, 75],
    36: [21, 42, 72, 115]
  }
  const t = timeThresholds[itemCount] || timeThresholds[9]

  if (timeUsed <= t[0]) return 'S'
  if (timeUsed <= t[1]) return 'A'
  if (timeUsed <= t[2]) return 'B'
  if (timeUsed <= t[3]) return 'C'
  return 'D'
}

// Dual评级：基于综合准确率
function getDualRating(topAccuracy, bottomAccuracy) {
  const combined = (topAccuracy + bottomAccuracy) / 2

  if (combined >= 95) return 'S'
  if (combined >= 85) return 'A'
  if (combined >= 70) return 'B'
  if (combined >= 55) return 'C'
  return 'D'
}

// 评级对应基础积分
function getRatingPoints(rating) {
  const points = { 'S': 30, 'A': 20, 'B': 15, 'C': 10, 'D': 5 }
  return points[rating] || 5
}

// 难度系数表
const DIFFICULTY_MULTIPLIER = {
  schulte: { 3: 0.5, 4: 0.6, 5: 0.8, 6: 1.0, 7: 1.2, 8: 1.4, 9: 1.7, 10: 2.0 },
  memory:  { 4: 0.5, 5: 0.6, 6: 0.7, 7: 0.8, 8: 1.0, 9: 1.2, 10: 1.5, 11: 1.8, 12: 2.0 },
  scan:    { 16: 0.5, 25: 0.7, 36: 1.0, 49: 1.5, 64: 1.8 },
  stroop:  { 15: 0.5, 25: 0.7, 35: 1.0, 45: 1.5, 60: 1.8 },
  react:   { easy: 0.6, normal: 0.8, hard: 1.0, expert: 1.5, master: 2.0 },
  match:   { 4: 0.6, 5: 0.8, 6: 1.0, 7: 1.5, 8: 2.0 },
  sort:    { 9: 0.6, 16: 0.8, 25: 1.2, 36: 1.8 },
  dual:    { easy: 0.6, normal: 0.8, hard: 1.0, expert: 1.5, master: 2.0 }
}

// 统一计算段位积分（基础分 × 难度系数）
function calcRankPoints(gameMode, level, rating) {
  const base = getRatingPoints(rating)
  const table = DIFFICULTY_MULTIPLIER[gameMode]
  const multiplier = table ? (table[level] || 1.0) : 1.0
  return Math.max(1, Math.round(base * multiplier))
}

// Memory评级：基于准确率、是否完美、用时
function getMemoryRating(accuracy, isPerfect, inputTime, level) {
  // 完美通关的用时阈值（秒），按位数递增
  const perfectTimeThresholds = { 4: 3, 5: 5, 6: 8, 7: 12, 8: 17, 9: 24, 10: 32, 11: 42, 12: 55 }
  const timeThreshold = perfectTimeThresholds[level] || 20

  if (isPerfect && inputTime <= timeThreshold) return 'S'
  if (isPerfect) return 'A'
  if (accuracy >= 0.95) return 'A'
  if (accuracy >= 0.85) return 'B'
  if (accuracy >= 0.7) return 'C'
  return 'D'
}

module.exports = {
  getStroopRating,
  getReactRating,
  getMatchRating,
  getSortRating,
  getDualRating,
  getRatingPoints,
  calcRankPoints,
  getMemoryRating
}
