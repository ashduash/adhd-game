/**
 * 皮肤配置系统 - 适配Canvas版本
 * 移除CSS样式字符串，保留颜色值供Canvas使用
 */

const SKINS = {
  night: {
    id: 'night',
    name: '夜空',
    icon: '🌙',
    description: '温暖夜色主题',
    bgColors: ['#1C1715', '#2A2320'],
    bgAngle: 180,
    cell: {
      bg: 'rgba(245,237,230,0.07)',
      border: 'rgba(245,237,230,0.1)',
      activeBg: 'rgba(192,122,69,0.18)',
      activeBorder: 'rgba(192,122,69,0.45)',
      successBg: 'rgba(123,174,127,0.15)',
      successBorder: 'rgba(123,174,127,0.3)',
      text: '#F5EDE6',
      successText: '#7BAE7F'
    },
    accent: '#C07A45'
  },

  piano: {
    id: 'piano',
    name: '钢琴键',
    icon: '🎹',
    description: '黑白琴键风格',
    bgColors: ['#1a1a1a', '#2d2d2d'],
    bgAngle: 180,
    cell: {
      bg: '#f5f5f5',
      bgGradient: ['#f5f5f5', '#e0e0e0'],
      border: 'rgba(0,0,0,0.2)',
      activeBg: '#d4d4d4',
      activeBgGradient: ['#d4d4d4', '#b0b0b0'],
      activeBorder: 'rgba(0,0,0,0.3)',
      successBg: '#a8e6cf',
      successBgGradient: ['#a8e6cf', '#88d8b0'],
      successBorder: 'rgba(0,184,148,0.5)',
      text: '#1a1a1a',
      successText: '#006644'
    },
    accent: '#333333'
  },

  neon: {
    id: 'neon',
    name: '霓虹灯',
    icon: '💡',
    description: '炫彩霓虹风格',
    bgColors: ['#0a0a0a', '#1a0a2e'],
    bgAngle: 180,
    cell: {
      bg: 'rgba(255,255,255,0.05)',
      border: 'rgba(255,0,255,0.3)',
      activeBg: 'rgba(255,0,255,0.15)',
      activeBorder: 'rgba(255,0,255,0.6)',
      successBg: 'rgba(0,255,255,0.15)',
      successBorder: 'rgba(0,255,255,0.6)',
      text: '#ffffff',
      successText: '#00ffff'
    },
    accent: '#ff00ff'
  },

  forest: {
    id: 'forest',
    name: '森林',
    icon: '🌲',
    description: '清新自然风格',
    bgColors: ['#1a2e1a', '#0a1f0a'],
    bgAngle: 180,
    cell: {
      bg: 'rgba(46,125,50,0.15)',
      border: 'rgba(46,125,50,0.3)',
      activeBg: 'rgba(46,125,50,0.3)',
      activeBorder: 'rgba(46,125,50,0.6)',
      successBg: 'rgba(165,214,167,0.25)',
      successBorder: 'rgba(165,214,167,0.5)',
      text: '#c8e6c9',
      successText: '#a5d6a7'
    },
    accent: '#4caf50'
  },

  ocean: {
    id: 'ocean',
    name: '海洋',
    icon: '🌊',
    description: '深海蓝调风格',
    bgColors: ['#0a1628', '#0d2137'],
    bgAngle: 180,
    cell: {
      bg: 'rgba(33,150,243,0.1)',
      border: 'rgba(33,150,243,0.25)',
      activeBg: 'rgba(33,150,243,0.25)',
      activeBorder: 'rgba(33,150,243,0.5)',
      successBg: 'rgba(0,188,212,0.2)',
      successBorder: 'rgba(0,188,212,0.5)',
      text: '#b3e5fc',
      successText: '#80deea'
    },
    accent: '#2196f3'
  }
}

const getSkin = (skinId) => SKINS[skinId] || SKINS.night

const getAllSkins = () => Object.values(SKINS)

// 获取指定状态的格子颜色
const getCellColors = (skin, state) => {
  const { cell } = skin
  switch (state) {
    case 'active':
      return {
        bg: cell.activeBg,
        bgGradient: cell.activeBgGradient || null,
        border: cell.activeBorder,
        text: cell.text
      }
    case 'success':
      return {
        bg: cell.successBg,
        bgGradient: cell.successBgGradient || null,
        border: cell.successBorder,
        text: cell.successText
      }
    default:
      return {
        bg: cell.bg,
        bgGradient: cell.bgGradient || null,
        border: cell.border,
        text: cell.text
      }
  }
}

// 绘制皮肤背景到Canvas
const drawSkinBackground = (ctx, skin, width, height) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, height)
  gradient.addColorStop(0, skin.bgColors[0])
  gradient.addColorStop(1, skin.bgColors[1])
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)
}

// 各游戏专属皮肤数据
const GAME_SKINS = {
  night: {
    schulte: {
      cell: {
        bg: 'rgba(245,237,230,0.07)', bgGradient: null, border: 'rgba(245,237,230,0.1)', text: '#F5EDE6',
        activeBg: 'rgba(192,122,69,0.18)', activeBgGradient: null, activeBorder: 'rgba(192,122,69,0.45)',
        successBg: 'rgba(123,174,127,0.15)', successBgGradient: null, successBorder: 'rgba(123,174,127,0.3)', successText: '#7BAE7F'
      }
    },
    scan: {
      cell: {
        default: { bg: 'rgba(245,237,230,0.07)', border: 'rgba(245,237,230,0.1)', text: '#F5EDE6' },
        found: { bg: 'rgba(123,174,127,0.15)', border: 'rgba(123,174,127,0.3)', text: '#7BAE7F' },
        active: { bg: 'rgba(192,122,69,0.18)', border: 'rgba(192,122,69,0.45)', text: '#F5EDE6' }
      }
    },
    stroop: {
      wordCard: { bg: 'rgba(245,237,230,0.06)', border: 'rgba(245,237,230,0.1)' },
      option: { bg: 'rgba(245,237,230,0.07)', border: 'rgba(245,237,230,0.1)' }
    },
    react: {
      target: { bg: 'rgba(192,122,69,0.55)', glow: 'rgba(192,122,69,0.35)' },
      fake: { bg: 'rgba(192,112,112,0.5)', border: 'rgba(192,112,112,0.3)' },
      hitColor: '#7BAE7F'
    },
    match: {
      blocks: ['rgba(192,112,112,0.7)', 'rgba(123,165,160,0.7)', 'rgba(123,174,127,0.7)', 'rgba(212,165,116,0.7)', 'rgba(155,142,196,0.7)', 'rgba(192,122,69,0.7)', 'rgba(123,196,190,0.7)'],
      selectedBorder: '#F5EDE6'
    },
    sort: {
      cell: {
        default: { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.1)', text: '#ffffff' },
        done: { bg: 'rgba(0,184,148,0.15)', border: 'rgba(0,184,148,0.3)', text: '#00B894' }
      }
    },
    dual: {
      top: { bg: 'rgba(116,185,255,0.15)', glow: 'rgba(116,185,255,0.4)' },
      bottom: { bg: 'rgba(255,107,107,0.15)', glow: 'rgba(255,107,107,0.4)' }
    },
    memory: {
      digitBg: 'rgba(192,122,69,0.12)',
      digitBorder: 'rgba(192,122,69,0.25)',
      slotBg: 'rgba(245,237,230,0.07)',
      slotBorder: 'rgba(245,237,230,0.1)',
      slotActive: 'rgba(192,122,69,0.18)',
      slotActiveBorder: 'rgba(192,122,69,0.45)',
      slotText: '#F5EDE6',
      slotFilledText: '#7BAE7F'
    }
  },

  piano: {
    schulte: {
      cell: {
        bg: '#f5f5f5', bgGradient: ['#f5f5f5', '#e0e0e0'], border: 'rgba(0,0,0,0.2)', text: '#1a1a1a',
        activeBg: '#d4d4d4', activeBgGradient: ['#d4d4d4', '#b0b0b0'], activeBorder: 'rgba(0,0,0,0.3)',
        successBg: '#a8e6cf', successBgGradient: ['#a8e6cf', '#88d8b0'], successBorder: 'rgba(0,184,148,0.5)', successText: '#006644'
      }
    },
    scan: {
      cell: {
        default: { bg: '#f5f5f5', border: 'rgba(0,0,0,0.15)', text: '#1a1a1a' },
        found: { bg: '#a8e6cf', border: 'rgba(0,184,148,0.5)', text: '#006644' },
        active: { bg: '#d4d4d4', border: 'rgba(0,0,0,0.3)', text: '#1a1a1a' }
      }
    },
    stroop: {
      wordCard: { bg: 'rgba(255,255,255,0.95)', border: 'rgba(0,0,0,0.15)' },
      option: { bg: 'rgba(240,240,240,0.95)', border: 'rgba(0,0,0,0.12)' }
    },
    react: {
      target: { bg: 'rgba(50,50,50,0.7)', glow: 'rgba(0,0,0,0.3)' },
      fake: { bg: 'rgba(180,180,180,0.6)', border: 'rgba(100,100,100,0.4)' },
      hitColor: '#4caf50'
    },
    match: {
      blocks: ['rgba(255,182,193,0.9)', 'rgba(173,216,230,0.9)', 'rgba(144,238,144,0.9)', 'rgba(255,218,185,0.9)', 'rgba(221,160,221,0.9)', 'rgba(176,224,230,0.9)', 'rgba(255,228,196,0.9)'],
      selectedBorder: '#333333'
    },
    sort: {
      cell: {
        default: { bg: 'rgba(255,255,255,0.9)', border: 'rgba(0,0,0,0.12)', text: '#1a1a1a' },
        done: { bg: '#a8e6cf', border: 'rgba(0,184,148,0.5)', text: '#006644' }
      }
    },
    dual: {
      top: { bg: 'rgba(173,216,230,0.25)', glow: 'rgba(100,149,237,0.3)' },
      bottom: { bg: 'rgba(255,182,193,0.25)', glow: 'rgba(220,20,60,0.3)' }
    },
    memory: {
      digitBg: 'rgba(240,240,240,0.95)',
      digitBorder: 'rgba(0,0,0,0.15)',
      slotBg: 'rgba(245,245,245,0.9)',
      slotBorder: 'rgba(0,0,0,0.1)',
      slotActive: 'rgba(200,200,200,0.9)',
      slotActiveBorder: 'rgba(0,0,0,0.25)',
      slotText: '#1a1a1a',
      slotFilledText: '#006644'
    }
  },

  neon: {
    schulte: {
      cell: {
        bg: 'rgba(255,255,255,0.05)', bgGradient: null, border: 'rgba(255,0,255,0.3)', text: '#ffffff',
        activeBg: 'rgba(255,0,255,0.15)', activeBgGradient: null, activeBorder: 'rgba(255,0,255,0.6)',
        successBg: 'rgba(0,255,255,0.15)', successBgGradient: null, successBorder: 'rgba(0,255,255,0.6)', successText: '#00ffff'
      }
    },
    scan: {
      cell: {
        default: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,0,255,0.3)', text: '#ffffff' },
        found: { bg: 'rgba(0,255,255,0.15)', border: 'rgba(0,255,255,0.6)', text: '#00ffff' },
        active: { bg: 'rgba(255,0,255,0.15)', border: 'rgba(255,0,255,0.6)', text: '#ffffff' }
      }
    },
    stroop: {
      wordCard: { bg: 'rgba(255,0,255,0.08)', border: 'rgba(255,0,255,0.3)' },
      option: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,0,255,0.25)' }
    },
    react: {
      target: { bg: 'rgba(255,0,255,0.5)', glow: 'rgba(255,0,255,0.5)' },
      fake: { bg: 'rgba(255,0,0,0.4)', border: 'rgba(255,0,0,0.4)' },
      hitColor: '#00ffff'
    },
    match: {
      blocks: ['rgba(255,0,100,0.8)', 'rgba(0,255,255,0.8)', 'rgba(255,255,0,0.8)', 'rgba(0,255,100,0.8)', 'rgba(100,0,255,0.8)', 'rgba(255,100,0,0.8)', 'rgba(0,200,255,0.8)'],
      selectedBorder: '#ffffff'
    },
    sort: {
      cell: {
        default: { bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,0,255,0.3)', text: '#ffffff' },
        done: { bg: 'rgba(0,255,255,0.15)', border: 'rgba(0,255,255,0.6)', text: '#00ffff' }
      }
    },
    dual: {
      top: { bg: 'rgba(255,0,255,0.12)', glow: 'rgba(255,0,255,0.5)' },
      bottom: { bg: 'rgba(0,255,255,0.12)', glow: 'rgba(0,255,255,0.5)' }
    },
    memory: {
      digitBg: 'rgba(255,0,255,0.12)',
      digitBorder: 'rgba(255,0,255,0.4)',
      slotBg: 'rgba(255,255,255,0.05)',
      slotBorder: 'rgba(255,0,255,0.2)',
      slotActive: 'rgba(255,0,255,0.15)',
      slotActiveBorder: 'rgba(255,0,255,0.5)',
      slotText: '#ffffff',
      slotFilledText: '#00ffff'
    }
  },

  forest: {
    schulte: {
      cell: {
        bg: 'rgba(46,125,50,0.15)', bgGradient: null, border: 'rgba(46,125,50,0.3)', text: '#c8e6c9',
        activeBg: 'rgba(46,125,50,0.3)', activeBgGradient: null, activeBorder: 'rgba(46,125,50,0.6)',
        successBg: 'rgba(165,214,167,0.25)', successBgGradient: null, successBorder: 'rgba(165,214,167,0.5)', successText: '#a5d6a7'
      }
    },
    scan: {
      cell: {
        default: { bg: 'rgba(46,125,50,0.15)', border: 'rgba(46,125,50,0.3)', text: '#c8e6c9' },
        found: { bg: 'rgba(165,214,167,0.25)', border: 'rgba(165,214,167,0.5)', text: '#a5d6a7' },
        active: { bg: 'rgba(46,125,50,0.3)', border: 'rgba(46,125,50,0.6)', text: '#c8e6c9' }
      }
    },
    stroop: {
      wordCard: { bg: 'rgba(46,125,50,0.15)', border: 'rgba(46,125,50,0.3)' },
      option: { bg: 'rgba(46,125,50,0.12)', border: 'rgba(46,125,50,0.25)' }
    },
    react: {
      target: { bg: 'rgba(76,175,80,0.6)', glow: 'rgba(76,175,80,0.4)' },
      fake: { bg: 'rgba(255,152,0,0.5)', border: 'rgba(255,152,0,0.3)' },
      hitColor: '#a5d6a7'
    },
    match: {
      blocks: ['rgba(129,199,132,0.8)', 'rgba(165,214,167,0.8)', 'rgba(76,175,80,0.8)', 'rgba(200,230,201,0.8)', 'rgba(102,187,106,0.8)', 'rgba(174,213,129,0.8)', 'rgba(129,212,179,0.8)'],
      selectedBorder: '#ffffff'
    },
    sort: {
      cell: {
        default: { bg: 'rgba(46,125,50,0.12)', border: 'rgba(46,125,50,0.25)', text: '#c8e6c9' },
        done: { bg: 'rgba(165,214,167,0.25)', border: 'rgba(165,214,167,0.5)', text: '#a5d6a7' }
      }
    },
    dual: {
      top: { bg: 'rgba(76,175,80,0.15)', glow: 'rgba(76,175,80,0.4)' },
      bottom: { bg: 'rgba(255,152,0,0.15)', glow: 'rgba(255,152,0,0.4)' }
    },
    memory: {
      digitBg: 'rgba(46,125,50,0.15)',
      digitBorder: 'rgba(46,125,50,0.35)',
      slotBg: 'rgba(46,125,50,0.08)',
      slotBorder: 'rgba(46,125,50,0.2)',
      slotActive: 'rgba(46,125,50,0.25)',
      slotActiveBorder: 'rgba(46,125,50,0.5)',
      slotText: '#c8e6c9',
      slotFilledText: '#a5d6a7'
    }
  },

  ocean: {
    schulte: {
      cell: {
        bg: 'rgba(33,150,243,0.1)', bgGradient: null, border: 'rgba(33,150,243,0.25)', text: '#b3e5fc',
        activeBg: 'rgba(33,150,243,0.25)', activeBgGradient: null, activeBorder: 'rgba(33,150,243,0.5)',
        successBg: 'rgba(0,188,212,0.2)', successBgGradient: null, successBorder: 'rgba(0,188,212,0.5)', successText: '#80deea'
      }
    },
    scan: {
      cell: {
        default: { bg: 'rgba(33,150,243,0.1)', border: 'rgba(33,150,243,0.25)', text: '#b3e5fc' },
        found: { bg: 'rgba(0,188,212,0.2)', border: 'rgba(0,188,212,0.5)', text: '#80deea' },
        active: { bg: 'rgba(33,150,243,0.25)', border: 'rgba(33,150,243,0.5)', text: '#b3e5fc' }
      }
    },
    stroop: {
      wordCard: { bg: 'rgba(33,150,243,0.12)', border: 'rgba(33,150,243,0.3)' },
      option: { bg: 'rgba(33,150,243,0.08)', border: 'rgba(33,150,243,0.2)' }
    },
    react: {
      target: { bg: 'rgba(33,150,243,0.6)', glow: 'rgba(33,150,243,0.4)' },
      fake: { bg: 'rgba(0,188,212,0.4)', border: 'rgba(0,188,212,0.3)' },
      hitColor: '#80deea'
    },
    match: {
      blocks: ['rgba(33,150,243,0.7)', 'rgba(0,188,212,0.7)', 'rgba(38,166,154,0.7)', 'rgba(100,181,246,0.7)', 'rgba(79,195,247,0.7)', 'rgba(128,203,196,0.7)', 'rgba(144,202,249,0.7)'],
      selectedBorder: '#ffffff'
    },
    sort: {
      cell: {
        default: { bg: 'rgba(33,150,243,0.08)', border: 'rgba(33,150,243,0.2)', text: '#b3e5fc' },
        done: { bg: 'rgba(0,188,212,0.2)', border: 'rgba(0,188,212,0.5)', text: '#80deea' }
      }
    },
    dual: {
      top: { bg: 'rgba(33,150,243,0.15)', glow: 'rgba(33,150,243,0.4)' },
      bottom: { bg: 'rgba(0,188,212,0.15)', glow: 'rgba(0,188,212,0.4)' }
    },
    memory: {
      digitBg: 'rgba(33,150,243,0.12)',
      digitBorder: 'rgba(33,150,243,0.3)',
      slotBg: 'rgba(33,150,243,0.06)',
      slotBorder: 'rgba(33,150,243,0.15)',
      slotActive: 'rgba(33,150,243,0.2)',
      slotActiveBorder: 'rgba(33,150,243,0.45)',
      slotText: '#b3e5fc',
      slotFilledText: '#80deea'
    }
  }
}

// 获取某游戏的皮肤数据
const getGameSkin = (gameId, skinId) => {
  const skinSet = GAME_SKINS[skinId] || GAME_SKINS.night
  return skinSet[gameId] || (GAME_SKINS.night && GAME_SKINS.night[gameId])
}

module.exports = {
  SKINS,
  GAME_SKINS,
  getSkin,
  getAllSkins,
  getCellColors,
  getGameSkin,
  drawSkinBackground
}
