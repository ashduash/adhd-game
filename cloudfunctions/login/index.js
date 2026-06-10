const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    return {
      openid: wxContext.OPENID,
      appid: wxContext.APPID,
      unionid: wxContext.UNIONID
    }
  } catch (e) {
    console.error('登录云函数异常:', e)
    return { error: '登录失败: ' + e.message }
  }
}
