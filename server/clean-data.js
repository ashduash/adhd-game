/**
 * 数据清理脚本 - 扫描并修复 db.json 中的违规昵称
 * 运行方式: node server/clean-data.js
 */
const fs = require('fs')
const path = require('path')
const { sanitizeNickName } = require('../utils/sensitive-filter')

const DB_FILE = path.join(__dirname, 'db.json')

if (!fs.existsSync(DB_FILE)) {
  console.log('db.json 不存在，无需清理')
  process.exit(0)
}

const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'))
let cleaned = 0

for (const openid of Object.keys(db.users || {})) {
  const user = db.users[openid]
  const original = user.nickName
  const safe = sanitizeNickName(original)
  if (original !== safe) {
    console.log(`[清理] ${original} -> ${safe}`)
    user.nickName = safe
    cleaned++
  }
}

if (cleaned > 0) {
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2))
  console.log(`\n清理完成，共修复 ${cleaned} 个违规昵称`)
} else {
  console.log('所有昵称均合规，无需清理')
}
