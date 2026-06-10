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
  const start = new Date(trainingPlan.cycleStart)
  const now = new Date()
  const diffDays = Math.floor((now - start) / (1000 * 60 * 60 * 24))
  return diffDays % 5
}

function getTodayTraining(trainingPlan) {
  const dayIndex = getCurrentDayIndex(trainingPlan)
  return TRAINING_DAYS[dayIndex]
}

function isTodayCompleted(trainingPlan) {
  if (!trainingPlan || !trainingPlan.completed) return false
  const dayIndex = getCurrentDayIndex(trainingPlan)
  return trainingPlan.completed.some(c => c.dayIndex === dayIndex)
}

function generateRadarData(completedGames) {
  const skills = {
    attention: 0,
    working_memory: 0,
    reaction: 0,
    pattern: 0,
    multitask: 0,
    inhibition: 0,
    visual_search: 0,
    sequential: 0
  }

  const counts = {}
  for (const key of Object.keys(skills)) {
    counts[key] = 0
  }

  for (const game of completedGames) {
    if (game.skill && skills[game.skill] !== undefined) {
      const ratingScore = { 'S': 100, 'A': 80, 'B': 60, 'C': 40, 'D': 20 }
      skills[game.skill] += ratingScore[game.rating] || 50
      counts[game.skill]++
    }
  }

  for (const key of Object.keys(skills)) {
    if (counts[key] > 0) {
      skills[key] = Math.min(100, skills[key] / counts[key])
    }
  }

  return {
    attention: Math.round((skills.attention + skills.visual_search) / 2),
    memory: Math.round((skills.working_memory + skills.sequential) / 2),
    speed: Math.round((skills.reaction + skills.inhibition) / 2),
    pattern: Math.round(skills.pattern),
    multitask: Math.round(skills.multitask)
  }
}

module.exports = {
  TRAINING_DAYS,
  getCurrentDayIndex,
  getTodayTraining,
  isTodayCompleted,
  generateRadarData
}
