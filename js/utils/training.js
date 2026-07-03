// 训练计划生成器

const TRAINING_DAYS = [
  {
    theme: '专注力',
    icon: '🎯',
    desc: '提升注意力集中能力',
    games: [
      { mode: 'schulte', level: 4, skill: 'attention', name: '4×4数字风暴' },
      { mode: 'stroop', level: 15, skill: 'inhibition', name: '15题斯特鲁普' },
      { mode: 'scan', level: 20, skill: 'visual_search', name: '20数闪电扫视' }
    ]
  },
  {
    theme: '记忆力',
    icon: '🧠',
    desc: '锻炼工作记忆能力',
    games: [
      { mode: 'memory', level: 6, skill: 'working_memory', name: '6位记忆还原' },
      { mode: 'sort', level: 8, skill: 'sequential', name: '8项序列排序' },
      { mode: 'schulte', level: 5, skill: 'attention', name: '5×5数字风暴' }
    ]
  },
  {
    theme: '反应力',
    icon: '⚡',
    desc: '提高反应速度',
    games: [
      { mode: 'react', level: 'easy', skill: 'reaction', name: '初级反应训练' },
      { mode: 'scan', level: 25, skill: 'visual_search', name: '25数闪电扫视' },
      { mode: 'stroop', level: 25, skill: 'inhibition', name: '25题斯特鲁普' }
    ]
  },
  {
    theme: '规划力',
    icon: '📋',
    desc: '培养模式识别和规划能力',
    games: [
      { mode: 'match', level: 5, skill: 'pattern', name: '5×5色彩消除' },
      { mode: 'sort', level: 10, skill: 'sequential', name: '10项序列排序' },
      { mode: 'memory', level: 8, skill: 'working_memory', name: '8位记忆还原' }
    ]
  },
  {
    theme: '多任务',
    icon: '🔀',
    desc: '提升注意力分配能力',
    games: [
      { mode: 'dual', level: 'easy', skill: 'multitask', name: '初级双线任务' },
      { mode: 'react', level: 'normal', skill: 'reaction', name: '中级反应训练' },
      { mode: 'schulte', level: 6, skill: 'attention', name: '6×6数字风暴' }
    ]
  }
]

function getCurrentDayIndex(trainingPlan) {
  if (!trainingPlan || !trainingPlan.cycleStart) return 0
  // 使用本地时间解析避免时区偏移
  const parts = trainingPlan.cycleStart.split('-')
  const start = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]))
  const now = new Date()
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return diffDays % 5
}

function isTodayCompleted(trainingPlan) {
  if (!trainingPlan || !trainingPlan.completed) return false
  // 使用本地时间，避免 UTC 偏移导致日期错误
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return trainingPlan.completed.includes(today)
}

module.exports = {
  TRAINING_DAYS,
  getCurrentDayIndex,
  isTodayCompleted
}
