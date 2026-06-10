/**
 * 内容安全工具
 * 微信 msgSecCheck API 为主，本地基础过滤为辅
 */

const { SENSITIVE_WORDS } = require('./sensitive-words')

// 模式匹配规则（正则）
const BLOCKED_PATTERNS = [
  /^dev_/i,           // 开发环境 ID
  /^user_/i,          // 伪 openid
  /^test/i,           // 测试账号
  /^admin/i,          // 管理员
  /openid/i,          // 包含 openid 字样
  /cloud:\/\//i,      // 云存储 fileID
  /^\d{10,}$/,        // 纯数字长串（疑似 ID）
]

/**
 * 本地基础过滤（兜底，仅拦截明显违规词）
 * @param {string} text
 * @returns {{ pass: boolean, reason: string }}
 */
function checkLocal(text) {
  if (!text || typeof text !== 'string') {
    return { pass: true, reason: '' }
  }

  const cleanText = text.trim()

  if (cleanText.length === 0) {
    return { pass: false, reason: '昵称不能为空' }
  }
  if (cleanText.length > 12) {
    return { pass: false, reason: '昵称不能超过12个字符' }
  }

  // 模式匹配（dev_ 开头的 ID 等）
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(cleanText)) {
      return { pass: false, reason: '昵称不合规，请修改' }
    }
  }

  // 敏感词匹配
  const lowerText = cleanText.toLowerCase()
  for (const word of SENSITIVE_WORDS) {
    if (lowerText.includes(word.toLowerCase())) {
      return { pass: false, reason: '昵称包含违规内容，请修改' }
    }
  }

  return { pass: true, reason: '' }
}

/**
 * 调用微信 msgSecCheck API（通过服务端接口）
 * 超时或失败时拒绝（fail-closed），不回退到本地检测
 * @param {string} content
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
function checkByApi(content, serverUrl) {
  return new Promise((resolve) => {
    if (!content || typeof content !== 'string') {
      resolve({ pass: true, reason: '' })
      return
    }

    if (!serverUrl) {
      resolve({ pass: false, reason: '内容检测服务不可用，请稍后重试' })
      return
    }

    let settled = false
    const safeResolve = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    // 超时拒绝（fail-closed）
    setTimeout(() => safeResolve({ pass: false, reason: '内容检测超时，请稍后重试' }), 5000)

    const openid = (typeof GameGlobal !== 'undefined' && GameGlobal.app)
      ? GameGlobal.app.getOpenid()
      : (typeof getApp === 'function' ? getApp().getOpenid() : '')

    wx.request({
      url: serverUrl + '/api/check-content',
      method: 'POST',
      data: { content: content.trim(), openid },
      timeout: 5000,
      success: (res) => {
        if (res.data && res.data.errCode === 0) {
          safeResolve({ pass: true, reason: '' })
        } else {
          safeResolve({ pass: false, reason: (res.data && res.data.errMsg) || '昵称包含违规内容，请修改后重试' })
        }
      },
      fail: () => safeResolve({ pass: false, reason: '内容检测服务不可用，请稍后重试' })
    })
  })
}

/**
 * 综合内容安全检查
 * 优先使用微信 msgSecCheck API，API 不可用时回退到本地检测
 * @param {string} text
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
async function checkContent(text, serverUrl) {
  // 先调 API（权威检测）
  const apiResult = await checkByApi(text, serverUrl)
  return apiResult
}

/**
 * 图片安全检查（调用微信 imgSecCheck API）
 * @param {string} imageBase64 - 图片的 base64 编码
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
function checkImage(imageBase64, serverUrl) {
  return new Promise((resolve) => {
    if (!imageBase64) {
      resolve({ pass: false, reason: '图片数据不能为空' })
      return
    }
    if (!serverUrl) {
      resolve({ pass: false, reason: '图片检测服务不可用，请稍后重试' })
      return
    }

    let settled = false
    const safeResolve = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    // 超时拒绝（fail-closed）
    setTimeout(() => safeResolve({ pass: false, reason: '图片检测超时，请稍后重试' }), 5000)

    wx.request({
      url: serverUrl + '/api/check-image',
      method: 'POST',
      data: { imageBase64 },
      timeout: 5000,
      success: (res) => {
        if (res.data && res.data.errCode === 0) {
          safeResolve({ pass: true, reason: '' })
        } else {
          safeResolve({ pass: false, reason: (res.data && res.data.errMsg) || '图片含有违规内容' })
        }
      },
      fail: () => safeResolve({ pass: false, reason: '图片检测服务不可用，请稍后重试' })
    })
  })
}


/**
 * 异步媒体安全检查（mediaCheckAsync）
 * 通过服务端 HTTP 接口调用
 * @param {string} mediaUrl - 媒体文件URL
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string, traceId?: string }>}
 */
function checkMediaAsync(mediaUrl, serverUrl) {
  return new Promise((resolve) => {
    if (!mediaUrl) {
      resolve({ pass: false, reason: '媒体URL不能为空' })
      return
    }
    if (!serverUrl) {
      resolve({ pass: false, reason: '媒体检测服务不可用，请稍后重试' })
      return
    }

    let settled = false
    const safeResolve = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    setTimeout(() => safeResolve({ pass: false, reason: '媒体检测超时，请稍后重试' }), 5000)

    wx.request({
      url: serverUrl + '/api/check-media-async',
      method: 'POST',
      data: { mediaUrl, mediaType: 2 },
      timeout: 5000,
      success: (res) => {
        if (res.data && res.data.errCode === 0) {
          safeResolve({ pass: true, reason: '', traceId: res.data.traceId })
        } else {
          safeResolve({ pass: false, reason: (res.data && res.data.errMsg) || '媒体检测失败' })
        }
      },
      fail: () => safeResolve({ pass: false, reason: '媒体检测服务不可用，请稍后重试' })
    })
  })
}

/**
 * 清洗昵称（用于服务端）
 * @param {string} nickName
 * @returns {string}
 */
function sanitizeNickName(nickName) {
  if (!nickName || typeof nickName !== 'string') {
    return '匿名玩家'
  }

  const result = checkLocal(nickName)
  if (!result.pass) {
    return '匿名玩家'
  }

  return nickName.trim().substring(0, 12)
}

module.exports = {
  checkLocal,
  checkByApi,
  checkContent,
  checkImage,
  checkMediaAsync,
  sanitizeNickName
}
