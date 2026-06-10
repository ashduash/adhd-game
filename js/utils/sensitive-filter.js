/**
 * 内容安全工具（小游戏版）
 * 双路径检测：云函数（优先）+ 服务端 HTTP 接口（兜底）
 * 本地敏感词作为第一道防线
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
 * 本地基础过滤（第一道防线）
 * @param {string} text
 * @returns {{ pass: boolean, reason: string }}
 */
function checkLocal(text) {
  if (!text || typeof text !== 'string') {
    return { pass: false, reason: '内容不能为空' }
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
 * 通过云函数调用 msgSecCheck
 * @param {string} content
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
function _checkByCloud(content) {
  return new Promise((resolve) => {
    if (!wx.cloud || !GameGlobal._cloudReady) {
      resolve(null) // 云不可用，返回 null 表示需要回退
      return
    }

    let settled = false
    const safeResolve = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    setTimeout(() => safeResolve(null), 3000)

    wx.cloud.callFunction({
      name: 'contentCheck',
      data: { content: content.trim() },
      success: (res) => {
        if (res.result && res.result.errCode === 0) {
          safeResolve({ pass: true, reason: '' })
        } else {
          safeResolve({ pass: false, reason: (res.result && res.result.errMsg) || '昵称包含违规内容，请修改后重试' })
        }
      },
      fail: () => safeResolve(null)
    })
  })
}

/**
 * 通过服务端 HTTP 接口调用 msgSecCheck
 * @param {string} content
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
function _checkByServer(content, serverUrl) {
  return new Promise((resolve) => {
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

    setTimeout(() => safeResolve({ pass: false, reason: '内容检测超时，请稍后重试' }), 5000)

    const openid = (typeof GameGlobal !== 'undefined' && GameGlobal.app)
      ? GameGlobal.app.getOpenid()
      : ''

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
 * 优先云函数 → 回退服务端 HTTP → 最终拒绝
 * @param {string} text
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
async function checkContent(text, serverUrl) {
  // 优先尝试云函数
  const cloudResult = await _checkByCloud(text)
  if (cloudResult !== null) return cloudResult

  // 云不可用，回退到服务端 HTTP
  return await _checkByServer(text, serverUrl)
}

/**
 * 通过云函数调用 imgSecCheck
 * @param {string} imageBase64
 * @returns {Promise<{ pass: boolean, reason: string } | null>}
 */
function _checkImageByCloud(imageBase64) {
  return new Promise((resolve) => {
    if (!wx.cloud || !GameGlobal._cloudReady) {
      resolve(null)
      return
    }

    let settled = false
    const safeResolve = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    setTimeout(() => safeResolve(null), 3000)

    wx.cloud.callFunction({
      name: 'contentCheck',
      data: { type: 'imgSecCheck', media: imageBase64 },
      success: (res) => {
        if (res.result && res.result.errCode === 0) {
          safeResolve({ pass: true, reason: '' })
        } else {
          safeResolve({ pass: false, reason: (res.result && res.result.errMsg) || '图片含有违规内容' })
        }
      },
      fail: () => safeResolve(null)
    })
  })
}

/**
 * 通过服务端 HTTP 接口调用 imgSecCheck
 * @param {string} imageBase64
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
function _checkImageByServer(imageBase64, serverUrl) {
  return new Promise((resolve) => {
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
 * 通过云函数调用 mediaCheckAsync（异步媒体检测）
 * @param {string} mediaUrl - 媒体文件URL
 * @returns {Promise<{ pass: boolean, reason: string, traceId?: string } | null>}
 */
function _checkMediaByCloud(mediaUrl) {
  return new Promise((resolve) => {
    if (!wx.cloud || !GameGlobal._cloudReady) {
      resolve(null)
      return
    }

    let settled = false
    const safeResolve = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }

    setTimeout(() => safeResolve(null), 3000)

    wx.cloud.callFunction({
      name: 'contentCheck',
      data: { type: 'mediaCheckAsync', mediaUrl },
      success: (res) => {
        if (res.result && res.result.errCode === 0) {
          safeResolve({ pass: true, reason: '', traceId: res.result.traceId })
        } else {
          safeResolve({ pass: false, reason: (res.result && res.result.errMsg) || '媒体检测失败' })
        }
      },
      fail: () => safeResolve(null)
    })
  })
}

/**
 * 通过服务端 HTTP 接口调用 mediaCheckAsync
 * @param {string} mediaUrl - 媒体文件URL
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string, traceId?: string }>}
 */
function _checkMediaByServer(mediaUrl, serverUrl) {
  return new Promise((resolve) => {
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
 * 异步媒体安全检查（mediaCheckAsync）
 * 优先云函数 → 回退服务端 HTTP → 最终拒绝
 * @param {string} mediaUrl - 媒体文件URL
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string, traceId?: string }>}
 */
async function checkMediaAsync(mediaUrl, serverUrl) {
  if (!mediaUrl) {
    return { pass: false, reason: '媒体URL不能为空' }
  }

  // 优先尝试云函数
  const cloudResult = await _checkMediaByCloud(mediaUrl)
  if (cloudResult !== null) return cloudResult

  // 云不可用，回退到服务端 HTTP
  return await _checkMediaByServer(mediaUrl, serverUrl)
}

/**
 * 图片安全检查
 * 优先云函数 → 回退服务端 HTTP → 最终拒绝
 * @param {string} imageBase64 - 图片的 base64 编码
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
async function checkImage(imageBase64, serverUrl) {
  if (!imageBase64) {
    return { pass: false, reason: '图片数据不能为空' }
  }

  // 优先尝试云函数
  const cloudResult = await _checkImageByCloud(imageBase64)
  if (cloudResult !== null) return cloudResult

  // 云不可用，回退到服务端 HTTP
  return await _checkImageByServer(imageBase64, serverUrl)
}

/**
 * 清洗昵称
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
  checkContent,
  checkImage,
  checkMediaAsync,
  sanitizeNickName
}
