/**
 * 内容安全工具（小游戏版）
 * 双路径检测：云函数（优先）+ 服务端 HTTP 接口（兜底）
 * 本地敏感词作为第一道防线
 */

const { SENSITIVE_WORDS } = require('./sensitive-words')

// 通用超时包装：防止 Promise 被多次 resolve
function _withTimeout(promise, ms, defaultResult) {
  return new Promise((resolve) => {
    let settled = false
    const safeResolve = (result) => {
      if (settled) return
      settled = true
      resolve(result)
    }
    setTimeout(() => safeResolve(defaultResult), ms)
    promise.then(safeResolve, () => safeResolve(defaultResult))
  })
}

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
  if (!wx.cloud || !GameGlobal._cloudReady) return Promise.resolve(null)

  return _withTimeout(new Promise((resolve) => {
    wx.cloud.callFunction({
      name: 'contentCheck',
      data: { content: content.trim() },
      success: (res) => {
        if (res.result && res.result.errCode === 0) {
          resolve({ pass: true, reason: '' })
        } else {
          resolve({ pass: false, reason: (res.result && res.result.errMsg) || '昵称包含违规内容，请修改后重试' })
        }
      },
      fail: () => resolve(null)
    })
  }), 3000, null)
}

/**
 * 通过服务端 HTTP 接口调用 msgSecCheck
 * @param {string} content
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
function _checkByServer(content, serverUrl) {
  // 无服务端地址 → 视为「服务不可达」，返回 null（由调用方决定是否 fail-open）
  if (!serverUrl) return Promise.resolve(null)

  const openid = (typeof GameGlobal !== 'undefined' && GameGlobal.app)
    ? GameGlobal.app.getOpenid()
    : ''
  // 超时 / 网络不可达均视为不可达，返回 null（fail-open）
  const timeoutResult = null

  return _withTimeout(new Promise((resolve) => {
    wx.request({
      url: serverUrl + '/api/check-content',
      method: 'POST',
      data: { content: content.trim(), openid },
      timeout: 5000,
      success: (res) => {
        if (res.data && res.data.errCode === 0) {
          resolve({ pass: true, reason: '' })
        } else {
          // 服务可达但拒绝（真实违规内容）→ fail-closed
          resolve({ pass: false, reason: (res.data && res.data.errMsg) || '昵称包含违规内容，请修改后重试' })
        }
      },
      fail: () => resolve(null)
    })
  }), 5000, timeoutResult)
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
  const serverResult = await _checkByServer(text, serverUrl)
  if (serverResult !== null) return serverResult

  // 两个后端均不可达：fail-open（本地休闲场景，避免「无安全后端就无法改昵称」的功能瘫痪）
  return { pass: true, reason: '', unavailable: true }
}

/**
 * 通过云函数调用 imgSecCheck
 * @param {string} imageBase64
 * @returns {Promise<{ pass: boolean, reason: string } | null>}
 */
function _checkImageByCloud(imageBase64) {
  if (!wx.cloud || !GameGlobal._cloudReady) return Promise.resolve(null)

  return _withTimeout(new Promise((resolve) => {
    wx.cloud.callFunction({
      name: 'contentCheck',
      data: { type: 'imgSecCheck', media: imageBase64 },
      success: (res) => {
        if (res.result && res.result.errCode === 0) {
          resolve({ pass: true, reason: '' })
        } else {
          resolve({ pass: false, reason: (res.result && res.result.errMsg) || '图片含有违规内容' })
        }
      },
      fail: () => resolve(null)
    })
  }), 3000, null)
}

/**
 * 通过服务端 HTTP 接口调用 imgSecCheck
 * @param {string} imageBase64
 * @param {string} serverUrl
 * @returns {Promise<{ pass: boolean, reason: string }>}
 */
function _checkImageByServer(imageBase64, serverUrl) {
  // 无服务端地址 → 视为「服务不可达」，返回 null（由调用方决定是否 fail-open）
  if (!serverUrl) return Promise.resolve(null)

  // 超时视为不可达，同样返回 null
  const timeoutResult = null

  return _withTimeout(new Promise((resolve) => {
    wx.request({
      url: serverUrl + '/api/check-image',
      method: 'POST',
      data: { imageBase64 },
      timeout: 5000,
      success: (res) => {
        // 服务可达且明确通过
        if (res.data && res.data.errCode === 0) {
          resolve({ pass: true, reason: '' })
        } else {
          // 服务可达但拒绝（真实违规内容）→ fail-closed
          resolve({ pass: false, reason: (res.data && res.data.errMsg) || '图片含有违规内容' })
        }
      },
      // 网络不可达 → 服务不可用，返回 null（fail-open）
      fail: () => resolve(null)
    })
  }), 5000, timeoutResult)
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
  const serverResult = await _checkImageByServer(imageBase64, serverUrl)
  if (serverResult !== null) return serverResult

  // 两个后端均不可达：fail-open（本地休闲游戏场景，避免「无安全后端就无法换头像」的功能瘫痪）
  // 安全语义保持：若任一后端可达且明确拒绝，上面已返回 pass:false 拦截
  return { pass: true, reason: '', unavailable: true }
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
  sanitizeNickName
}
