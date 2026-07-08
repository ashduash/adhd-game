/**
 * Canvas 头像加载工具
 * 支持直接 HTTP URL 和云存储 fileID，带内存缓存
 */

const cache = new Map()
const loading = new Map()

const DEFAULT_AVATAR_EMOJI = '👤'

/**
 * 加载头像图片（Canvas 用）
 * @param {string} url - 头像 URL（http://... 或 cloud://...）
 * @param {function} callback - 加载完成回调 (image | null)
 */
function loadAvatar(url, callback) {
  if (!url || typeof url !== 'string') {
    callback(null)
    return
  }

  // 已缓存且加载完成
  const cached = cache.get(url)
  if (cached && cached.loaded) {
    callback(cached)
    return
  }

  // 正在加载中，排队等待
  if (loading.has(url)) {
    loading.get(url).push(callback)
    return
  }

  // 开始加载
  loading.set(url, [callback])

  // 直接 HTTP URL（服务端上传的头像）
  if (url.startsWith('http://') || url.startsWith('https://')) {
    const img = wx.createImage()
    img.onload = () => {
      img.loaded = true
      cache.set(url, img)
      _notifyAll(url, img)
    }
    img.onerror = () => {
      _notifyAll(url, null)
    }
    img.src = url
    return
  }

  // 云存储 fileID（兼容旧数据）
  if (url.startsWith('cloud://') && typeof wx !== 'undefined' && wx.cloud) {
    wx.cloud.getTempFileURL({
      fileList: [url],
      success: (res) => {
        const fileInfo = res.fileList && res.fileList[0]
        if (!fileInfo || fileInfo.status !== 0) {
          _notifyAll(url, null)
          return
        }

        const img = wx.createImage()
        img.onload = () => {
          img.loaded = true
          cache.set(url, img)
          _notifyAll(url, img)
        }
        img.onerror = () => {
          _notifyAll(url, null)
        }
        img.src = fileInfo.tempFileURL
      },
      fail: () => {
        _notifyAll(url, null)
      }
    })
    return
  }

  // base64 data URL（本地游客 / 无后端兜底）
  if (url.startsWith('data:')) {
    const img = wx.createImage()
    img.onload = () => {
      img.loaded = true
      cache.set(url, img)
      _notifyAll(url, img)
    }
    img.onerror = () => {
      _notifyAll(url, null)
    }
    img.src = url
    return
  }

  // 无法识别的 URL 格式
  _notifyAll(url, null)
}

function _notifyAll(url, img) {
  const callbacks = loading.get(url) || []
  loading.delete(url)
  for (const cb of callbacks) {
    cb(img)
  }
}

module.exports = {
  loadAvatar,
  DEFAULT_AVATAR_EMOJI
}
