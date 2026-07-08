/**
 * 社交分享模块 - 分享给好友 / 朋友圈 / 挑战好友深链 / 订阅消息召回
 *
 * 设计原则（与 ads.js 一致的优雅降级）：
 *  - 无 wx 环境（本地/语法校验）直接安全返回，不抛错；
 *  - 占位模板 ID（含 xxx / yyy / TEMPLATE_ID）时跳过真实调用，仅给提示；
 *  - 所有 wx 调用包 try/catch，单点异常不影响主流程。
 *
 * 真实上线只需把下方 _SHARE_CONF 的占位替换为微信公众平台配置即可。
 */

const { MODES } = require('../config/modes')

// 占位配置：部署后端 / 公众号平台后替换为真实值
const _SHARE_CONF = {
  // 订阅消息模板 ID（微信公众平台「订阅消息」配置），占位时跳过真实订阅
  subscribeTemplateId: 'TEMPLATE_ID_xxx',
  // 分享卡片配图（本地 images/ 路径或网络图），留空则用微信默认截图
  shareImageUrl: ''
}

// 模块内当前分享上下文：胶囊菜单(被动转发)与朋友圈分享都读取它
let _currentPayload = null

function _isPlaceholder(v) {
  return !v || typeof v !== 'string' || v.indexOf('xxx') >= 0 || v.indexOf('yyy') >= 0 || v.indexOf('TEMPLATE_ID') >= 0
}

function _hasWx() {
  return typeof wx !== 'undefined' && wx && typeof wx.shareAppMessage === 'function'
}

function _modeName(mode) {
  const m = MODES.find(x => x.id === mode)
  return m ? m.name : '专注力'
}

// 构造挑战深链 query：mode + score + rating + level + challenge=1
function buildChallengeQuery(opts) {
  const q = []
  if (opts && opts.mode) q.push('mode=' + encodeURIComponent(opts.mode))
  if (opts && opts.score != null) q.push('score=' + encodeURIComponent(String(opts.score)))
  if (opts && opts.rating) q.push('rating=' + encodeURIComponent(opts.rating))
  if (opts && opts.level != null) q.push('level=' + encodeURIComponent(String(opts.level)))
  q.push('challenge=1')
  return q.join('&')
}

// 默认分享文案（首页/通用分享用）
function defaultPayload() {
  return {
    title: '专注风暴 · 训练专注力，挑战你的反应极限！',
    imageUrl: _SHARE_CONF.shareImageUrl || '',
    query: ''
  }
}

// 设置胶囊菜单(被动转发)与朋友圈的当前分享内容
function setSharePayload(payload) {
  _currentPayload = payload || defaultPayload()
}

function _safeImageUrl(url) {
  return url && !_isPlaceholder(url) ? url : undefined
}

// 启动期注册：开启分享菜单 + 被动转发/朋友圈回调
function registerGlobalShare() {
  if (!_hasWx()) return
  try {
    if (wx.showShareMenu) {
      wx.showShareMenu({ menus: ['shareAppMessage', 'shareTimeline'] })
    }
  } catch (e) { /* 忽略 */ }
  try {
    wx.onShareAppMessage(function () {
      return _currentPayload || defaultPayload()
    })
  } catch (e) { /* 忽略 */ }
  if (wx.onShareTimeline) {
    try {
      wx.onShareTimeline(function () {
        const p = _currentPayload || defaultPayload()
        return { title: p.title, query: p.query, imageUrl: _safeImageUrl(p.imageUrl) }
      })
    } catch (e) { /* 忽略 */ }
  }
}

// 主动调起转发面板（分享给好友）。返回是否成功触发
function shareToFriend(payload) {
  if (typeof GameGlobal !== 'undefined' && GameGlobal.toast) {
    // 先记录当前 payload，保证朋友圈/胶囊也能拿到这次上下文
  }
  if (payload) setSharePayload(payload)
  if (!_hasWx()) {
    if (typeof GameGlobal !== 'undefined' && GameGlobal.toast) GameGlobal.toast.show('当前环境不支持分享')
    return false
  }
  try {
    const p = Object.assign({ title: '专注风暴', query: '' }, payload || {})
    p.imageUrl = _safeImageUrl(p.imageUrl)
    // 主动转发 API（微信小游戏支持直接调用以弹出转发面板）
    wx.shareAppMessage(p)
    return true
  } catch (e) {
    console.warn('[share] shareToFriend failed:', e && e.message)
    return false
  }
}

// 分享「挑战好友」深链：好友打开即进入同模式并带上你的分数
function shareChallenge(opts) {
  const query = buildChallengeQuery(opts)
  const name = _modeName(opts && opts.mode)
  const title = (opts && opts.score != null)
    ? `我在「${name}」拿了 ${opts.score} 分，敢来挑战我吗？`
    : `我在「${name}」等你来挑战！`
  return shareToFriend({ title, query, imageUrl: _SHARE_CONF.shareImageUrl })
}

// 解析启动/onshow query 中的挑战参数，无则返回 null
function parseLaunchQuery(query) {
  if (!query) return null
  const c = query.challenge
  if (c !== '1' && c !== 1 && c !== 'true' && c !== true) return null
  return {
    challenge: true,
    mode: query.mode || null,
    score: query.score != null ? Number(query.score) : null,
    rating: query.rating || null,
    level: query.level != null ? Number(query.level) : null
  }
}

// 订阅消息召回：返回 Promise<{ ok, placeholder? }>
// 占位模板或未配置时走 placeholder 分支，不弹真实授权
function requestSubscribe(templateId) {
  const tid = templateId || _SHARE_CONF.subscribeTemplateId
  if (_isPlaceholder(tid)) {
    if (typeof GameGlobal !== 'undefined' && GameGlobal.toast) {
      GameGlobal.toast.show('订阅模板未配置，召回功能即将上线')
    }
    return Promise.resolve({ ok: false, placeholder: true })
  }
  if (!_hasWx() || typeof wx.requestSubscribeMessage !== 'function') {
    return Promise.resolve({ ok: false })
  }
  return new Promise(function (resolve) {
    wx.requestSubscribeMessage({
      tmplIds: [tid],
      success: function (res) { resolve({ ok: !!(res && res[tid] === 'accept'), res: res }) },
      fail: function () { resolve({ ok: false }) }
    })
  })
}

module.exports = {
  registerGlobalShare,
  setSharePayload,
  shareToFriend,
  shareChallenge,
  parseLaunchQuery,
  requestSubscribe,
  defaultPayload,
  buildChallengeQuery
}
