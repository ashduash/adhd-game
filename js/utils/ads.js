/**
 * 广告管理模块 - 适配小游戏
 * 去掉Banner广告（小游戏无<ad>标签），保留激励视频和插屏
 *
 * 发布说明：
 *  - 把下面的 _AD_UNIT_IDS 替换为微信广告后台创建的真实单元 ID。
 *  - 占位符（含 xxx / yyy）模式下，激励视频会被"模拟"为成功，从而保证
 *    "看视频双倍积分 / 看视频领补签卡 / 看视频解锁皮肤"等奖励链路在开发期可用；
 *    插屏广告在占位符模式下不展示，避免打断体验。
 *  - 填入真实 ID 后，占位符判定自动失效，走真实广告逻辑；此时激励视频的
 *    成功/失败以用户是否完整观看为准。
 */

const _AD_UNIT_IDS = {
  rewarded: 'adunit-xxxxxxxxxxxx',       // TODO: 替换为真实激励视频广告单元 ID
  interstitial: 'adunit-yyyyyyyyyyyy'    // TODO: 替换为真实插屏广告单元 ID
}

// 占位符模式：单元 ID 仍为示例值，未接入真实广告
const _AD_PLACEHOLDER = (typeof _AD_UNIT_IDS.rewarded === 'string' && _AD_UNIT_IDS.rewarded.includes('xxx')) ||
  (typeof _AD_UNIT_IDS.interstitial === 'string' && _AD_UNIT_IDS.interstitial.includes('yyy'))

const INTERSTITIAL_INTERVAL = 3

let rewardedAd = null
let interstitialAd = null

function createRewardedAd() {
  if (_AD_PLACEHOLDER) return null // 占位符模式不创建真实广告
  if (!wx.createRewardedVideoAd) return null
  if (!_AD_UNIT_IDS.rewarded) return null

  rewardedAd = wx.createRewardedVideoAd({ adUnitId: _AD_UNIT_IDS.rewarded })

  rewardedAd.onError((err) => {
    console.warn('激励视频广告加载失败:', err)
  })

  rewardedAd.onClose((res) => {
    if (res && res.isEnded) {
      if (rewardedAd._resolve) rewardedAd._resolve(true)
    } else {
      if (rewardedAd._resolve) rewardedAd._resolve(false)
    }
    rewardedAd._resolve = null
    rewardedAd.load().catch(() => {})
  })

  rewardedAd.load().catch(() => {})
  return rewardedAd
}

function showRewardedAd() {
  return new Promise((resolve) => {
    // 占位符模式：模拟一次激励视频，让奖励链路可用（开发 / 未接入真实广告时）
    if (!rewardedAd) {
      if (_AD_PLACEHOLDER) {
        if (GameGlobal.toast) GameGlobal.toast.show('（模拟广告）奖励已发放', 1.5)
        setTimeout(() => resolve(true), 600)
        return
      }
      if (GameGlobal.toast) GameGlobal.toast.show('广告加载中，请稍后')
      resolve(false)
      return
    }
    rewardedAd._resolve = resolve
    rewardedAd.show().catch(() => {
      rewardedAd.load().then(() => {
        rewardedAd.show().catch(() => {
          if (GameGlobal.toast) GameGlobal.toast.show('广告暂不可用')
          rewardedAd._resolve = null
          resolve(false)
        })
      }).catch(() => {
        if (GameGlobal.toast) GameGlobal.toast.show('广告暂不可用')
        rewardedAd._resolve = null
        resolve(false)
      })
    })
  })
}

function createInterstitialAd() {
  if (_AD_PLACEHOLDER) return null // 占位符模式不创建真实广告
  if (!wx.createInterstitialAd) return null
  if (!_AD_UNIT_IDS.interstitial) return null

  interstitialAd = wx.createInterstitialAd({ adUnitId: _AD_UNIT_IDS.interstitial })

  interstitialAd.onError((err) => {
    console.warn('插屏广告加载失败:', err)
  })
  interstitialAd.onClose(() => {
    interstitialAd.load().catch(() => {})
  })

  interstitialAd.load().catch(() => {})
  return interstitialAd
}

function tryShowInterstitial(gameCount) {
  // 占位符模式不展示插屏，避免打断体验
  if (_AD_PLACEHOLDER) return false
  if (!interstitialAd || gameCount % INTERSTITIAL_INTERVAL !== 0) return false
  interstitialAd.show().catch(() => {})
  return true
}

module.exports = {
  createRewardedAd,
  showRewardedAd,
  createInterstitialAd,
  tryShowInterstitial
}
