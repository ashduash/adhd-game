/**
 * 皮肤配置系统
 */

const SKINS = {
  // 默认皮肤 - 夜空
  night: {
    id: 'night',
    name: '夜空',
    icon: '🌙',
    description: '深邃夜空主题',
    background: 'linear-gradient(180deg, #0F0F1A 0%, #1A1A2E 100%)',
    cell: {
      bg: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.1)',
      activeBg: 'rgba(108, 92, 231, 0.2)',
      activeBorder: 'rgba(108, 92, 231, 0.5)',
      successBg: 'rgba(0, 184, 148, 0.15)',
      successBorder: 'rgba(0, 184, 148, 0.3)',
      text: '#ffffff',
      successText: '#00B894'
    },
    accent: '#C07A45'
  },

  // 钢琴键皮肤
  piano: {
    id: 'piano',
    name: '钢琴键',
    icon: '🎹',
    description: '黑白琴键风格',
    background: 'linear-gradient(180deg, #1a1a1a 0%, #2d2d2d 100%)',
    cell: {
      bg: 'linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%)',
      border: 'rgba(0, 0, 0, 0.2)',
      activeBg: 'linear-gradient(180deg, #d4d4d4 0%, #b0b0b0 100%)',
      activeBorder: 'rgba(0, 0, 0, 0.3)',
      successBg: 'linear-gradient(180deg, #a8e6cf 0%, #88d8b0 100%)',
      successBorder: 'rgba(0, 184, 148, 0.5)',
      text: '#1a1a1a',
      successText: '#006644'
    },
    accent: '#333333'
  },

  // 霓虹灯皮肤
  neon: {
    id: 'neon',
    name: '霓虹灯',
    icon: '💡',
    description: '炫彩霓虹风格',
    background: 'linear-gradient(180deg, #0a0a0a 0%, #1a0a2e 100%)',
    cell: {
      bg: 'rgba(255, 255, 255, 0.05)',
      border: 'rgba(255, 0, 255, 0.3)',
      activeBg: 'rgba(255, 0, 255, 0.15)',
      activeBorder: 'rgba(255, 0, 255, 0.6)',
      successBg: 'rgba(0, 255, 255, 0.15)',
      successBorder: 'rgba(0, 255, 255, 0.6)',
      text: '#ffffff',
      successText: '#00ffff'
    },
    accent: '#ff00ff'
  },

  // 森林皮肤
  forest: {
    id: 'forest',
    name: '森林',
    icon: '🌲',
    description: '清新自然风格',
    background: 'linear-gradient(180deg, #1a2e1a 0%, #0a1f0a 100%)',
    cell: {
      bg: 'rgba(46, 125, 50, 0.15)',
      border: 'rgba(46, 125, 50, 0.3)',
      activeBg: 'rgba(46, 125, 50, 0.3)',
      activeBorder: 'rgba(46, 125, 50, 0.6)',
      successBg: 'rgba(165, 214, 167, 0.25)',
      successBorder: 'rgba(165, 214, 167, 0.5)',
      text: '#c8e6c9',
      successText: '#a5d6a7'
    },
    accent: '#4caf50'
  },

  // 海洋皮肤
  ocean: {
    id: 'ocean',
    name: '海洋',
    icon: '🌊',
    description: '深海蓝调风格',
    background: 'linear-gradient(180deg, #0a1628 0%, #0d2137 100%)',
    cell: {
      bg: 'rgba(33, 150, 243, 0.1)',
      border: 'rgba(33, 150, 243, 0.25)',
      activeBg: 'rgba(33, 150, 243, 0.25)',
      activeBorder: 'rgba(33, 150, 243, 0.5)',
      successBg: 'rgba(0, 188, 212, 0.2)',
      successBorder: 'rgba(0, 188, 212, 0.5)',
      text: '#b3e5fc',
      successText: '#80deea'
    },
    accent: '#2196f3'
  }
}

// 获取皮肤
const getSkin = (skinId) => {
  return SKINS[skinId] || SKINS.night
}

// 获取所有皮肤列表
const getAllSkins = () => {
  return Object.values(SKINS)
}

// 生成动态样式
const generateCellStyle = (skin, state = 'default') => {
  const { cell } = skin
  let style = ''

  switch (state) {
    case 'active':
      style = `
        background: ${cell.activeBg};
        border-color: ${cell.activeBorder};
      `
      break
    case 'success':
      style = `
        background: ${cell.successBg};
        border-color: ${cell.successBorder};
      `
      break
    default:
      style = `
        background: ${cell.bg};
        border-color: ${cell.border};
      `
  }

  return style
}

module.exports = {
  SKINS,
  getSkin,
  getAllSkins,
  generateCellStyle
}
