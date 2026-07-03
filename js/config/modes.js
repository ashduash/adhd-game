/**
 * 游戏模式共享常量
 */
const MODES = [
  { id: 'schulte', name: '数字风暴', desc: '经典舒尔特方格', icon: '⚡', gradient: ['#C07A45', '#D4A574'] },
  { id: 'memory', name: '记忆还原', desc: '挑战你的工作记忆', icon: '🧠', gradient: ['#7BAE7F', '#9CCF9F'] },
  { id: 'scan', name: '闪电扫视', desc: '极速视觉搜索', icon: '👁️', gradient: ['#D4915C', '#E8B87C'] },
  { id: 'stroop', name: '斯特鲁普', desc: '认知抑制挑战', icon: '🎭', gradient: ['#C77D8A', '#E0A0AC'] },
  { id: 'react', name: '极速反应', desc: '反应速度训练', icon: '🎯', gradient: ['#7BA5A0', '#9CC5C0'] },
  { id: 'match', name: '色彩消除', desc: '消除配对挑战', icon: '🌈', gradient: ['#D4A574', '#C8965C'] },
  { id: 'sort', name: '序列排序', desc: '顺序还原挑战', icon: '📊', gradient: ['#9B8EC4', '#B5AAD4'] },
  { id: 'dual', name: '双线任务', desc: '多线程注意力', icon: '🔀', gradient: ['#C07A70', '#D49088'] }
]

// 按 id 索引的快捷查找表
const MODE_MAP = {}
for (const m of MODES) MODE_MAP[m.id] = m

module.exports = { MODES, MODE_MAP }
