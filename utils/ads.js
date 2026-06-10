/**
 * 广告管理模块
 * 激励视频、插屏广告的统一管理
 *
 * ⚠️ 上线前请替换为真实的微信广告位 ID
 */

// 广告位 ID（占位，上线前替换）
const AD_UNIT_IDS = {
  rewarded: 'adunit-xxxxxxxxxxxx',       // 激励视频广告位
  interstitial: 'adunit-yyyyyyyyyyyy',   // 插屏广告位
  banner: 'adunit-zzzzzzzzzzzz'          // Banner 广告位
}

// 插屏广告频率控制
const INTERSTITIAL_INTERVAL = 3  // 每 N 局显示一次

// 激励视频广告实例（单例）
let rewardedAd = null
let rewardedAdLoaded = false

// 插屏广告实例（单例）
let interstitialAd = null
let interstitialAdLoaded = false

/**
 * 创建激励视频广告
 */
function createRewardedAd() {
  if (!wx.createRewardedVideoAd) return null
  // 占位符 ID 时跳过创建，避免框架报 SystemError
  if (!AD_UNIT_IDS.rewarded || AD_UNIT_IDS.rewarded.includes('xxx')) return null

  rewardedAd = wx.createRewardedVideoAd({ adUnitId: AD_UNIT_IDS.rewarded })

  rewardedAd.onLoad(() => {
    rewardedAdLoaded = true
  })

  rewardedAd.onError((err) => {
    rewardedAdLoaded = false
    console.warn('激励视频广告加载失败:', err)
  })

  rewardedAd.onClose((res) => {
    rewardedAdLoaded = false
    // 用户看完广告（点击了关闭按钮且观看了完整广告）
    if (res && res.isEnded) {
      if (rewardedAd._resolve) rewardedAd._resolve(true)
    } else {
      if (rewardedAd._resolve) rewardedAd._resolve(false)
    }
    rewardedAd._resolve = null
    // 预加载下一次
    rewardedAd.load().catch(() => {})
  })

  // 预加载
  rewardedAd.load().catch(() => {})
  return rewardedAd
}

/**
 * 显示激励视频广告
 * @returns {Promise<boolean>} 是否完整观看
 */
function showRewardedAd() {
  return new Promise((resolve) => {
    if (!rewardedAd) {
      wx.showToast({ title: '广告加载中，请稍后', icon: 'none' })
      resolve(false)
      return
    }

    rewardedAd._resolve = resolve

    rewardedAd.show().catch(() => {
      // 广告未加载好，尝试重新加载
      rewardedAd.load().then(() => {
        rewardedAd.show().catch(() => {
          wx.showToast({ title: '广告暂不可用', icon: 'none' })
          rewardedAd._resolve = null
          resolve(false)
        })
      }).catch(() => {
        wx.showToast({ title: '广告暂不可用', icon: 'none' })
        rewardedAd._resolve = null
        resolve(false)
      })
    })
  })
}

/**
 * 创建插屏广告
 */
function createInterstitialAd() {
  if (!wx.createInterstitialAd) return null
  // 占位符 ID 时跳过创建，避免框架报 SystemError
  if (!AD_UNIT_IDS.interstitial || AD_UNIT_IDS.interstitial.includes('yyy')) return null

  interstitialAd = wx.createInterstitialAd({ adUnitId: AD_UNIT_IDS.interstitial })

  interstitialAd.onLoad(() => {
    interstitialAdLoaded = true
  })

  interstitialAd.onError((err) => {
    interstitialAdLoaded = false
    console.warn('插屏广告加载失败:', err)
  })

  interstitialAd.onClose(() => {
    interstitialAdLoaded = false
    // 预加载下一次
    interstitialAd.load().catch(() => {})
  })

  // 预加载
  interstitialAd.load().catch(() => {})
  return interstitialAd
}

/**
 * 尝试显示插屏广告（带频率控制）
 * @param {number} gameCount 当前游戏总局数
 * @returns {boolean} 是否显示了广告
 */
function tryShowInterstitial(gameCount) {
  if (!interstitialAd || gameCount % INTERSTITIAL_INTERVAL !== 0) return false

  interstitialAd.show().catch(() => {})
  return true
}

/**
 * 获取 Banner 广告位 ID
 */
function getBannerAdId() {
  return AD_UNIT_IDS.banner
}

module.exports = {
  AD_UNIT_IDS,
  createRewardedAd,
  showRewardedAd,
  createInterstitialAd,
  tryShowInterstitial,
  getBannerAdId
}
