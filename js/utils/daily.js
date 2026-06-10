// 每日挑战和连续打卡逻辑

function getTodayString() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function generateDailySeed() {
  const today = new Date()
  return today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
}

function calculateStreak(lastPlayDate, currentStreak) {
  const today = getTodayString()
  if (lastPlayDate === today) return currentStreak

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  if (lastPlayDate === yesterdayStr) return currentStreak + 1
  return 1
}

function getStreakMultiplier(streak) {
  if (streak >= 30) return 5
  if (streak >= 14) return 3
  if (streak >= 7) return 2
  return 1
}

function generateDailyChallenge() {
  const seed = generateDailySeed()
  const allModes = [
    { mode: 'schulte', levels: [3, 4, 5, 6], titles: ['3×3 数字风暴', '4×4 数字风暴', '5×5 数字风暴', '6×6 数字风暴'], targets: ['25秒内完成', '60秒内完成', '90秒内完成', '150秒内完成'] },
    { mode: 'memory', levels: [4, 6, 8, 10], titles: ['4位记忆还原', '6位记忆还原', '8位记忆还原', '10位记忆还原'], targets: ['完美还原', '完美还原', '完美还原', '完美还原'] },
    { mode: 'scan', levels: [15, 20, 25, 30], titles: ['15数闪电扫视', '20数闪电扫视', '25数闪电扫视', '30数闪电扫视'], targets: ['15秒内完成', '15秒内完成', '20秒内完成', '25秒内完成'] },
    { mode: 'stroop', levels: [15, 25, 35, 45], titles: ['15题斯特鲁普', '25题斯特鲁普', '35题斯特鲁普', '45题斯特鲁普'], targets: ['90%正确率', '85%正确率', '80%正确率', '75%正确率'] },
    { mode: 'react', levels: ['easy', 'normal', 'hard', 'expert'], titles: ['初级反应训练', '中级反应训练', '高级反应训练', '专家反应训练'], targets: ['20次命中', '25次命中', '30次命中', '35次命中'] },
    { mode: 'match', levels: [4, 5, 6, 7], titles: ['4×4色彩消除', '5×5色彩消除', '6×6色彩消除', '7×7色彩消除'], targets: ['消除20对', '消除30对', '消除40对', '消除50对'] },
    { mode: 'sort', levels: [6, 8, 10, 12], titles: ['6项序列排序', '8项序列排序', '10项序列排序', '12项序列排序'], targets: ['30秒内完成', '45秒内完成', '60秒内完成', '90秒内完成'] },
    { mode: 'dual', levels: ['easy', 'normal', 'hard', 'expert'], titles: ['初级双线任务', '中级双线任务', '高级双线任务', '专家双线任务'], targets: ['60%综合准确率', '65%综合准确率', '70%综合准确率', '75%综合准确率'] }
  ]

  const modeIndex = seed % allModes.length
  const modeConfig = allModes[modeIndex]
  const levelIndex = (seed * 7 + 3) % modeConfig.levels.length

  return {
    mode: modeConfig.mode,
    level: modeConfig.levels[levelIndex],
    title: modeConfig.titles[levelIndex],
    target: modeConfig.targets[levelIndex],
    participants: Math.floor(1000 + (seed % 5000))
  }
}

/**
 * 判断是否可以使用补签卡（昨天断签了）
 */
function canUseStreakFreeze(lastPlayDate) {
  if (!lastPlayDate) return false
  const today = getTodayString()
  if (lastPlayDate === today) return false

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  // 昨天已打卡，不需要补签
  if (lastPlayDate === yesterdayStr) return false
  // 前天及之前断签，可以补签
  return true
}

/**
 * 使用补签卡，将 lastPlayDate 设为昨天，恢复连续打卡
 */
function useStreakFreeze(lastPlayDate, currentStreak) {
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`

  // 返回补签后的状态
  return {
    lastPlayDate: yesterdayStr,
    streak: currentStreak > 0 ? currentStreak : 1
  }
}

module.exports = {
  getTodayString,
  generateDailySeed,
  calculateStreak,
  getStreakMultiplier,
  generateDailyChallenge,
  canUseStreakFreeze,
  useStreakFreeze
}
