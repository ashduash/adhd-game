// 成就系统定义

const ACHIEVEMENTS = [
  // 坚持类
  { id: 'first_game', name: '初出茅庐', desc: '完成第一局游戏', icon: '🎯', category: '坚持', check: (u) => u.totalGames >= 1 },
  { id: 'ten_games', name: '小有经验', desc: '完成10局游戏', icon: '🎮', category: '坚持', check: (u) => u.totalGames >= 10 },
  { id: 'fifty_games', name: '资深玩家', desc: '完成50局游戏', icon: '🏆', category: '坚持', check: (u) => u.totalGames >= 50 },
  { id: 'hundred_games', name: '百战老兵', desc: '完成100局游戏', icon: '⭐', category: '坚持', check: (u) => u.totalGames >= 100 },
  { id: 'streak_3', name: '三日打卡', desc: '连续3天游玩', icon: '📅', category: '坚持', check: (u) => u.streak >= 3 },
  { id: 'streak_7', name: '一周不断', desc: '连续7天游玩', icon: '🔥', category: '坚持', check: (u) => u.streak >= 7 },
  { id: 'streak_30', name: '月度坚持', desc: '连续30天游玩', icon: '💪', category: '坚持', check: (u) => u.streak >= 30 },

  // 速度类
  { id: 'schulte_speed_5', name: '速度王', desc: '4×4数字风暴5秒内完成', icon: '⚡', category: '速度', check: (u) => u.bestScores.schulte[4] && u.bestScores.schulte[4] <= 5000 },
  { id: 'schulte_speed_10', name: '疾风手', desc: '5×5数字风暴10秒内完成', icon: '💨', category: '速度', check: (u) => u.bestScores.schulte[5] && u.bestScores.schulte[5] <= 10000 },
  { id: 'scan_all_25', name: '鹰眼', desc: '25个数字扫视全部找到', icon: '👁️', category: '速度', check: (u) => u.bestScores.scan[25] && u.bestScores.scan[25] > 0 },
  { id: 'react_combo_10', name: '连击达人', desc: '反应训练达到10连击', icon: '🎯', category: '速度', check: (u) => u.bestScores.react._maxCombo >= 10 },
  { id: 'stroop_perfect', name: '不受干扰', desc: '斯特鲁普测试零错误完成', icon: '🧠', category: '速度', check: (u) => u.bestScores.stroop._perfect },
  { id: 'sort_fast_12', name: '排序之王', desc: '12项排序30秒内完成', icon: '📊', category: '速度', check: (u) => u.bestScores.sort[12] && u.bestScores.sort[12] <= 30000 },

  // 技巧类
  { id: 'memory_perfect_6', name: '记忆新星', desc: '6位记忆还原零错误', icon: '🌟', category: '技巧', check: (u) => u.bestScores.memory._perfect6 },
  { id: 'memory_perfect_10', name: '完美记忆', desc: '10位记忆还原零错误', icon: '🧠', category: '技巧', check: (u) => u.bestScores.memory._perfect10 },
  { id: 'match_combo_10', name: '连锁大师', desc: '色彩消除达到10连击', icon: '🔗', category: '技巧', check: (u) => u.bestScores.match._maxCombo >= 10 },
  { id: 'match_clear', name: '清盘高手', desc: '色彩消除清空整个棋盘', icon: '🌈', category: '技巧', check: (u) => u.bestScores.match._cleared },
  { id: 'dual_expert', name: '分心大师', desc: '双线任务专家级获得S评级', icon: '🎯', category: '技巧', check: (u) => u.bestScores.dual.expert === 'S' },
  { id: 'react_expert', name: '闪电反射', desc: '专家级反应训练获得S评级', icon: '⚡', category: '技巧', check: (u) => u.bestScores.react.expert === 'S' },
  { id: 'all_modes', name: '全能战士', desc: '体验全部8种游戏模式', icon: '🏅', category: '技巧', check: (u) => {
    const modes = ['schulte', 'memory', 'scan', 'stroop', 'react', 'match', 'sort', 'dual']
    return modes.every(m => u.bestScores[m] && Object.keys(u.bestScores[m]).length > 0)
  }},
  { id: 'daily_7', name: '挑战达人', desc: '完成7次每日挑战', icon: '📆', category: '技巧', check: (u) => (u.dailyChallenge.completedCount || 0) >= 7 },

  // 段位类
  { id: 'rank_silver', name: '白银之路', desc: '达到白银段位', icon: '🥈', category: '段位', check: (u) => u.rankPoints >= 100 },
  { id: 'rank_gold', name: '黄金时代', desc: '达到黄金段位', icon: '🥇', category: '段位', check: (u) => u.rankPoints >= 300 },
  { id: 'rank_platinum', name: '铂金精英', desc: '达到铂金段位', icon: '💎', category: '段位', check: (u) => u.rankPoints >= 600 },
  { id: 'rank_diamond', name: '钻石传奇', desc: '达到钻石段位', icon: '💠', category: '段位', check: (u) => u.rankPoints >= 1000 },
  { id: 'rank_master', name: '大师风范', desc: '达到大师段位', icon: '👑', category: '段位', check: (u) => u.rankPoints >= 1500 },
  { id: 'rank_king', name: '王者归来', desc: '达到王者段位', icon: '🏆', category: '段位', check: (u) => u.rankPoints >= 2000 }
]

function getAchievementsByCategory() {
  const categories = {}
  for (const a of ACHIEVEMENTS) {
    if (!categories[a.category]) categories[a.category] = []
    categories[a.category].push(a)
  }
  return categories
}

module.exports = {
  getAchievementsByCategory
}
