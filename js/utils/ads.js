/**
 * 广告管理模块 - 适配小游戏
 * 去掉Banner广告（小游戏无<ad>标签），保留激励视频和插屏
 */

// 注意：发布前必须替换为真实的广告单元 ID（在微信广告后台创建后填入）
const AD_UNIT_IDS = {
  rewarded: 'adunit-xxxxxxxxxxxx',       // TODO: 替换为真实激励视频广告单元 ID
  interstitial: 'adunit-yyyyyyyyyyyy'    // TODO: 替换为真实插屏广告单元 ID
}

const INTERSTITIAL_INTERVAL = 3

let rewardedAd = null
let interstitialAd = null

function createRewardedAd() {
  if (!wx.createRewardedVideoAd) return null
  // 占位符 ID 时跳过创建，避免框架报 SystemError
  if (!AD_UNIT_IDS.rewarded || AD_UNIT_IDS.rewarded.includes('xxx')) return null

  rewardedAd = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_IDS.rewarded })

  rewardedAd.onLoad(() => {})

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
    if (!rewardedAd) {
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
  if (!wx.createInterstitialAd) return null
  // 占位符 ID 时跳过创建，避免框架报 SystemError
  if (!AD_UNIT_IDS.interstitial || AD_UNIT_IDS.interstitial.includes('yyy')) return null

  interstitialAd = wx.createInterstitialAd({ adUnitId: AD_UNIT_IDS.interstitial })

  interstitialAd.onLoad(() => {})
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
  if (!interstitialAd || gameCount % INTERSTITIAL_INTERVAL !== 0) return false
  interstitialAd.show().catch(() => {})
  return true
}

module.exports = {
  AD_UNIT_IDS,
  createRewardedAd,
  showRewardedAd,
  createInterstitialAd,
  tryShowInterstitial
}
