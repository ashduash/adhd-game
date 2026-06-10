const http = require('http')
const https = require('https')
const fs = require('fs')
const path = require('path')
const { sanitizeNickName, checkLocal } = require('../utils/sensitive-filter')

const PORT = 3000
const DB_FILE = path.join(__dirname, 'db.json')
const UPLOADS_DIR = path.join(__dirname, 'uploads')

// 确保上传目录存在
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// 微信小程序/小游戏配置（优先读取环境变量）
const WX_APPID = process.env.WX_APPID || 'wx16490bb8f5ee8ba1'
const WX_SECRET = process.env.WX_SECRET || ''

// access_token 缓存（有效期 2 小时）
let accessTokenCache = { token: '', expiresAt: 0 }

// 获取微信 access_token
function getAccessToken() {
  const now = Date.now()
  if (accessTokenCache.token && now < accessTokenCache.expiresAt) {
    return Promise.resolve(accessTokenCache.token)
  }
  return new Promise((resolve, reject) => {
    const url = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${WX_APPID}&secret=${WX_SECRET}`
    https.get(url, (resp) => {
      let data = ''
      resp.on('data', chunk => data += chunk)
      resp.on('end', () => {
        try {
          const json = JSON.parse(data)
          if (json.access_token) {
            accessTokenCache = {
              token: json.access_token,
              expiresAt: now + (json.expires_in - 300) * 1000
            }
            resolve(json.access_token)
          } else {
            reject(new Error(json.errmsg || '获取 access_token 失败'))
          }
        } catch { reject(new Error('access_token 接口返回异常')) }
      })
    }).on('error', reject)
  })
}

// 内容安全检测辅助函数（内部复用，/api/check-content 和 /api/login 共用）
async function _checkContentWithWxApi(content) {
  if (!content || typeof content !== 'string') return { pass: false, reason: '内容不能为空' }
  const clean = content.trim()
  if (clean.length === 0 || clean.length > 12) return { pass: false, reason: '昵称不合规' }

  // 本地敏感词检测（第一道防线）
  const localResult = checkLocal(clean)
  if (!localResult.pass) return { pass: false, reason: localResult.reason }

  // 必须配置 appsecret 才能调用微信 API
  if (!WX_SECRET) {
    console.error('WX_SECRET 未配置，无法调用微信内容安全 API，拒绝内容')
    return { pass: false, reason: '内容检测服务未配置' }
  }

  // 调用微信 msgSecCheck API（权威检测）
  try {
    const token = await getAccessToken()
    const wxUrl = `https://api.weixin.qq.com/wxa/msg_sec_check?access_token=${token}`
    const postData = JSON.stringify({ openid: 'anonymous', scene: 2, version: 2, content: clean })
    const wxRes = await new Promise((resolve, reject) => {
      const r = https.request(wxUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (resp) => {
        let data = ''
        resp.on('data', chunk => data += chunk)
        resp.on('end', () => { try { resolve(JSON.parse(data)) } catch { reject(new Error('msgSecCheck 接口返回异常')) } })
      })
      r.on('error', reject)
      r.write(postData)
      r.end()
    })
    if (wxRes.errCode === 0) return { pass: true, reason: '' }
    console.warn('msgSecCheck 拒绝内容:', clean, 'errCode:', wxRes.errCode)
    return { pass: false, reason: '内容含有违规信息' }
  } catch (e) {
    console.error('msgSecCheck 调用失败:', e.message)
    return { pass: false, reason: '内容检测服务异常' }
  }
}

// 图片安全检测辅助函数（复用 imgSecCheck API）
async function _checkImageWithWxApi(imageBuffer) {
  if (!WX_SECRET) {
    return { pass: false, reason: '图片检测服务未配置' }
  }
  try {
    const boundary = '----WebKitFormBoundary' + Date.now().toString(16)
    const header = Buffer.from(
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="media"; filename="image.jpg"\r\n` +
      `Content-Type: image/jpeg\r\n\r\n`
    )
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
    const body = Buffer.concat([header, imageBuffer, footer])
    const token = await getAccessToken()
    const wxUrl = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`
    const wxRes = await new Promise((resolve, reject) => {
      const r = https.request(wxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': body.length
        }
      }, (resp) => {
        let data = ''
        resp.on('data', chunk => data += chunk)
        resp.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch { reject(new Error('imgSecCheck 接口返回异常')) }
        })
      })
      r.on('error', reject)
      r.write(body)
      r.end()
    })
    if (wxRes.errCode === 0) return { pass: true, reason: '' }
    return { pass: false, reason: '图片含有违规内容' }
  } catch (e) {
    return { pass: false, reason: '图片检测异常' }
  }
}

// 初始化数据库
function loadDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify({ users: {} }, null, 2))
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
}

function saveDB(db) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
}

// 解析请求体
function parseBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(body)) }
      catch { resolve({}) }
    })
  })
}

  // 安全校验：仅允许合法的微信 openid 格式
  function isValidOpenid(s) {
    return typeof s === 'string' && /^[a-zA-Z0-9_-]{28,40}$/.test(s)
  }

  // 路由处理
async function handleRequest(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')

  if (req.method === 'OPTIONS') {
    res.writeHead(200)
    res.end()
    return
  }

  const url = req.url

  // 登录/注册
  if (url === '/api/login' && req.method === 'POST') {
    const { openid, nickName, avatarUrl } = await parseBody(req)
    if (!openid || !isValidOpenid(openid)) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'openid required' }))
      return
    }

    // 服务端内容安全校验（API + 本地双重检测，fail-closed）
    const checkResult = await _checkContentWithWxApi(nickName)
    if (!checkResult.pass) {
      res.writeHead(200)
      res.end(JSON.stringify({ error: checkResult.reason }))
      return
    }
    const safeNickName = sanitizeNickName(nickName)
    const contentRejected = nickName && nickName.trim() !== safeNickName

    const db = loadDB()
    if (!db.users[openid]) {
      db.users[openid] = {
        openid,
        nickName: safeNickName,
        avatarUrl: avatarUrl || '',
        rank: 'bronze',
        rankPoints: 0,
        totalGames: 0,
        bestScores: {},
        updateTime: Date.now()
      }
    } else {
      if (nickName) db.users[openid].nickName = safeNickName
      if (avatarUrl) db.users[openid].avatarUrl = avatarUrl
      db.users[openid].updateTime = Date.now()
    }
    saveDB(db)

    res.writeHead(200)
    res.end(JSON.stringify({ success: true, user: db.users[openid], contentRejected }))
    return
  }

  // 同步分数
  if (url === '/api/sync' && req.method === 'POST') {
    const body = await parseBody(req)
    const { openid } = body
    if (!openid || !isValidOpenid(openid)) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'openid required' }))
      return
    }

    // 服务端内容安全校验（API + 本地双重检测）
    const safeNickName = sanitizeNickName(body.nickName)

    const db = loadDB()
    if (db.users[openid]) {
      Object.assign(db.users[openid], {
        rank: body.rank || db.users[openid].rank,
        rankPoints: body.rankPoints ?? db.users[openid].rankPoints,
        totalGames: body.totalGames ?? db.users[openid].totalGames,
        bestScores: body.bestScores || db.users[openid].bestScores,
        updateTime: Date.now()
      })
      // 如果同步了昵称，也要校验
      if (body.nickName) db.users[openid].nickName = safeNickName
    } else {
      db.users[openid] = {
        openid,
        nickName: safeNickName,
        avatarUrl: body.avatarUrl || '',
        rank: body.rank || 'bronze',
        rankPoints: body.rankPoints || 0,
        totalGames: body.totalGames || 0,
        bestScores: body.bestScores || {},
        updateTime: Date.now()
      }
    }
    saveDB(db)

    res.writeHead(200)
    res.end(JSON.stringify({ success: true }))
    return
  }

  // 微信登录（用 code 换 openid）
  if (url === '/api/wxlogin' && req.method === 'POST') {
    const { code } = await parseBody(req)
    if (!code) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'code required' }))
      return
    }

    if (!WX_SECRET) {
      // 未配置 appsecret，返回错误
      res.writeHead(500)
      res.end(JSON.stringify({ error: '服务端未配置 appsecret，请联系开发者' }))
      return
    }

    // 调用微信 jscode2session 接口换取 openid
    const wxUrl = `https://api.weixin.qq.com/sns/jscode2session?appid=${WX_APPID}&secret=${WX_SECRET}&js_code=${code}&grant_type=authorization_code`

    try {
      const wxRes = await new Promise((resolve, reject) => {
        https.get(wxUrl, (resp) => {
          let data = ''
          resp.on('data', chunk => data += chunk)
          resp.on('end', () => {
            try { resolve(JSON.parse(data)) }
            catch { reject(new Error('微信接口返回异常')) }
          })
        }).on('error', reject)
      })

      if (wxRes.openid) {
        res.writeHead(200)
        // session_key 不下发到客户端，由服务端管理
        res.end(JSON.stringify({ openid: wxRes.openid }))
      } else {
        res.writeHead(400)
        res.end(JSON.stringify({ error: '微信登录失败', detail: wxRes }))
      }
    } catch (e) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: '服务端请求微信接口失败: ' + e.message }))
    }
    return
  }

  // 内容安全检查（复用 _checkContentWithWxApi）
  if (url === '/api/check-content' && req.method === 'POST') {
    const { content } = await parseBody(req)
    const result = await _checkContentWithWxApi(content)
    res.writeHead(200)
    if (result.pass) {
      res.end(JSON.stringify({ errCode: 0, errMsg: '内容安全' }))
    } else {
      res.end(JSON.stringify({ errCode: -1, errMsg: result.reason }))
    }
    return
  }

  // 异步媒体安全检查（调用微信官方 mediaCheckAsync API）
  if (url === '/api/check-media-async' && req.method === 'POST') {
    if (!WX_SECRET) {
      res.writeHead(200)
      res.end(JSON.stringify({ errCode: -1, errMsg: '媒体检测服务未配置，暂无法验证内容安全性' }))
      return
    }

    try {
      const { mediaUrl, mediaType } = await parseBody(req)
      if (!mediaUrl) {
        res.writeHead(400)
        res.end(JSON.stringify({ errCode: -1, errMsg: '媒体URL不能为空' }))
        return
      }

      const token = await getAccessToken()
      const wxUrl = `https://api.weixin.qq.com/wxa/media_check_async?access_token=${token}`
      const postData = JSON.stringify({
        version: 2,
        openid: 'anonymous',
        scene: 1,
        media_url: mediaUrl,
        media_type: mediaType || 2 // 默认图片
      })

      const wxRes = await new Promise((resolve, reject) => {
        const r = https.request(wxUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' } }, (resp) => {
          let data = ''
          resp.on('data', chunk => data += chunk)
          resp.on('end', () => {
            try { resolve(JSON.parse(data)) }
            catch { reject(new Error('mediaCheckAsync 接口返回异常')) }
          })
        })
        r.on('error', reject)
        r.write(postData)
        r.end()
      })

      if (wxRes.errCode === 0) {
        res.writeHead(200)
        res.end(JSON.stringify({ errCode: 0, errMsg: '媒体已提交检测', traceId: wxRes.traceId }))
      } else {
        res.writeHead(200)
        res.end(JSON.stringify({ errCode: wxRes.errCode || -1, errMsg: '媒体检测提交失败' }))
      }
    } catch (e) {
      console.error('mediaCheckAsync 调用失败:', e.message)
      res.writeHead(200)
      res.end(JSON.stringify({ errCode: -1, errMsg: '媒体检测服务异常，请稍后重试' }))
    }
    return
  }

  // 图片安全检查（调用微信官方 imgSecCheck API）
  if (url === '/api/check-image' && req.method === 'POST') {
    if (!WX_SECRET) {
      res.writeHead(200)
      res.end(JSON.stringify({ errCode: -1, errMsg: '图片检测服务未配置，暂无法验证内容安全性' }))
      return
    }

    try {
      // 接收 base64 图片数据
      const { imageBase64 } = await parseBody(req)
      if (!imageBase64) {
        res.writeHead(400)
        res.end(JSON.stringify({ errCode: -1, errMsg: '图片数据不能为空' }))
        return
      }

      const imageBuffer = Buffer.from(imageBase64, 'base64')
      const boundary = '----WebKitFormBoundary' + Date.now().toString(16)

      // 构建 multipart/form-data
      const header = Buffer.from(
        `--${boundary}\r\n` +
        `Content-Disposition: form-data; name="media"; filename="image.jpg"\r\n` +
        `Content-Type: image/jpeg\r\n\r\n`
      )
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`)
      const body = Buffer.concat([header, imageBuffer, footer])

      const token = await getAccessToken()
      const wxUrl = `https://api.weixin.qq.com/wxa/img_sec_check?access_token=${token}`

      const wxRes = await new Promise((resolve, reject) => {
        const r = https.request(wxUrl, {
          method: 'POST',
          headers: {
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length
          }
        }, (resp) => {
          let data = ''
          resp.on('data', chunk => data += chunk)
          resp.on('end', () => {
            try { resolve(JSON.parse(data)) }
            catch { reject(new Error('imgSecCheck 接口返回异常')) }
          })
        })
        r.on('error', reject)
        r.write(body)
        r.end()
      })

      if (wxRes.errCode === 0) {
        res.writeHead(200)
        res.end(JSON.stringify({ errCode: 0, errMsg: '图片安全' }))
      } else {
        res.writeHead(200)
        res.end(JSON.stringify({ errCode: wxRes.errCode || -1, errMsg: '图片含有违规内容' }))
      }
    } catch (e) {
      res.writeHead(200)
      res.end(JSON.stringify({ errCode: -1, errMsg: '图片检测异常，请稍后重试' }))
    }
    return
  }

  // 排行榜
  if (url === '/api/rank' && req.method === 'POST') {
    const { openid } = await parseBody(req)
    const db = loadDB()

    // 按积分排序
    const sorted = Object.values(db.users)
      .sort((a, b) => b.rankPoints - a.rankPoints)

    const rankList = sorted.slice(0, 50).map((user, i) => ({
      ...user,
      position: i + 1
    }))

    // 查找当前用户排名
    let myRank = null
    if (openid && db.users[openid]) {
      const myPoints = db.users[openid].rankPoints || 0
      const position = sorted.filter(u => u.rankPoints > myPoints).length + 1
      myRank = { ...db.users[openid], position }
    }

    res.writeHead(200)
    res.end(JSON.stringify({ rankList, myRank }))
    return
  }

  // 头像上传
  if (url === '/api/upload-avatar' && req.method === 'POST') {
    const { openid, imageBase64 } = await parseBody(req)
    if (!openid || !imageBase64) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'openid and imageBase64 required' }))
      return
    }
    // 校验 openid 格式，防止路径穿越
    if (!isValidOpenid(openid)) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: 'openid 格式不合法' }))
      return
    }
    // 上传前进行图片安全检测（fail-closed：检测不通过或异常时拒绝保存）
    try {
      const imageBuffer = Buffer.from(imageBase64, 'base64')
      const checkResult = await _checkImageWithWxApi(imageBuffer)
      if (!checkResult.pass) {
        res.writeHead(200)
        res.end(JSON.stringify({ error: checkResult.reason || '图片含有违规内容' }))
        return
      }
    } catch (_) {
      res.writeHead(200)
      res.end(JSON.stringify({ error: '图片安全检测失败' }))
      return
    }
    // 安全检测通过，保存文件
    try {
      const buffer = Buffer.from(imageBase64, 'base64')
      const filename = `${openid}_${Date.now()}.jpg`
      const filepath = path.join(UPLOADS_DIR, filename)
      fs.writeFileSync(filepath, buffer)

      const avatarUrl = `/uploads/${filename}`
      res.writeHead(200)
      res.end(JSON.stringify({ success: true, avatarUrl }))
    } catch (e) {
      res.writeHead(500)
      res.end(JSON.stringify({ error: '头像上传失败: ' + e.message }))
    }
    return
  }

  // 静态文件服务（头像等）
  if (url.startsWith('/uploads/') && req.method === 'GET') {
    const filename = url.replace('/uploads/', '')
    // 防止路径穿越：禁止含 ..、/、\ 的文件名
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      res.writeHead(400)
      res.end(JSON.stringify({ error: '请求路径不合法' }))
      return
    }
    const filepath = path.join(UPLOADS_DIR, filename)
    // 双重校验：解析后的路径必须仍在 UPLOADS_DIR 内
    if (!filepath.startsWith(path.resolve(UPLOADS_DIR))) {
      res.writeHead(403)
      res.end(JSON.stringify({ error: '禁止访问' }))
      return
    }
    if (fs.existsSync(filepath)) {
      const ext = path.extname(filename).toLowerCase()
      const mimeTypes = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.gif': 'image/gif' }
      const contentType = mimeTypes[ext] || 'application/octet-stream'
      res.setHeader('Content-Type', contentType)
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.writeHead(200)
      res.end(fs.readFileSync(filepath))
    } else {
      res.writeHead(404)
      res.end('not found')
    }
    return
  }

  res.writeHead(404)
  res.end(JSON.stringify({ error: 'not found' }))
}

const server = http.createServer(handleRequest)
server.listen(PORT, () => {
  console.log(`排行榜服务器已启动: http://localhost:${PORT}`)
  console.log('保持此终端运行，小程序需要连接此服务器')
})
