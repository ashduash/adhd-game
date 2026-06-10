const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

/**
 * 内容安全检测云函数
 * 支持：
 *   - msgSecCheck：文本安全检测（昵称等）
 *   - imgSecCheck：图片安全检测（头像等）
 *   - mediaCheckAsync：异步媒体安全检测（图片/音频/视频）
 */
exports.main = async (event, context) => {
  const { type, content, media, mediaUrl } = event

  // ===== 异步媒体检测（mediaCheckAsync）=====
  if (type === 'mediaCheckAsync') {
    if (!mediaUrl) {
      return { errCode: -1, errMsg: '媒体URL不能为空' }
    }
    try {
      const result = await cloud.openapi.security.mediaCheckAsync({
        openid: cloud.getWXContext().OPENID,
        scene: 1,
        version: 2,
        media_url: mediaUrl,
        media_type: 2 // 图片
      })
      if (result.errCode === 0) {
        return { errCode: 0, errMsg: '媒体已提交检测', traceId: result.traceId }
      }
      return { errCode: result.errCode, errMsg: '媒体检测提交失败', detail: result }
    } catch (err) {
      console.error('mediaCheckAsync 调用失败:', err)
      return { errCode: -1, errMsg: '媒体检测服务异常，请稍后重试' }
    }
  }

  // ===== 图片安全检测（imgSecCheck）=====
  if (type === 'imgSecCheck') {
    if (!media) {
      return { errCode: -1, errMsg: '图片数据不能为空' }
    }
    try {
      const result = await cloud.openapi.security.imgSecCheck({
        media: {
          contentType: 'image/png',
          value: Buffer.from(media, 'base64')
        }
      })
      if (result.errCode === 0) {
        return { errCode: 0, errMsg: '图片安全', detail: result.detail }
      }
      return { errCode: result.errCode, errMsg: '图片含有违规内容', detail: result.detail }
    } catch (err) {
      console.error('imgSecCheck 调用失败:', err)
      // imgSecCheck 失败时，尝试使用 mediaCheckAsync 作为备选
      try {
        const uploadRes = await cloud.uploadFile({
          cloudPath: `temp_check/${Date.now()}.png`,
          fileContent: Buffer.from(media, 'base64')
        })
        const fileRes = await cloud.getTempFileURL({ fileList: [uploadRes.fileID] })
        if (fileRes.fileList && fileRes.fileList[0] && fileRes.fileList[0].tempFileURL) {
          const asyncResult = await cloud.openapi.security.mediaCheckAsync({
            openid: cloud.getWXContext().OPENID,
            scene: 1,
            version: 2,
            media_url: fileRes.fileList[0].tempFileURL,
            media_type: 2
          })
          // 清理临时文件
          cloud.deleteFile({ fileList: [uploadRes.fileID] }).catch(() => {})
          if (asyncResult.errCode === 0) {
            return { errCode: 0, errMsg: '图片已提交异步检测', traceId: asyncResult.traceId }
          }
        }
      } catch (fallbackErr) {
        console.error('mediaCheckAsync 备选方案也失败:', fallbackErr)
      }
      return { errCode: -1, errMsg: '图片检测服务异常，请稍后重试' }
    }
  }

  // ===== 文本安全检测（msgSecCheck，默认）=====
  if (!content || typeof content !== 'string') {
    return { errCode: -1, errMsg: '内容不能为空' }
  }

  try {
    const result = await cloud.openapi.security.msgSecCheck({
      openid: cloud.getWXContext().OPENID,
      scene: 2, // 2=评论，适用于昵称等用户输入场景
      version: 2,
      content: content
    })

    if (result.errCode === 0) {
      return { errCode: 0, errMsg: '内容安全', detail: result.detail }
    }
    return { errCode: result.errCode, errMsg: '内容含有违规信息', detail: result.detail }
  } catch (err) {
    console.error('msgSecCheck 调用失败:', err)
    return { errCode: -1, errMsg: '内容检测服务异常，请稍后重试' }
  }
}
