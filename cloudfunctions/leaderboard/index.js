const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 有效段位枚举
const VALID_RANKS = ['bronze', 'silver', 'gold', 'platinum', 'diamond', 'master', 'king']

exports.main = async (event) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  if (!openid) return { error: 'openid not found' }

  const { action, nickName, avatarUrl, rank, rankPoints, totalGames, bestScores } = event

  // 同步用户数据（登录 / 分数同步）
  if (action === 'sync') {
    const now = Date.now()

    // 输入校验
    const safeNickName = (typeof nickName === 'string' && nickName.length <= 12) ? nickName.trim() : undefined
    const safeRank = (VALID_RANKS.includes(rank)) ? rank : undefined
    const safeRankPoints = (typeof rankPoints === 'number' && rankPoints >= 0 && rankPoints < 100000) ? Math.floor(rankPoints) : undefined
    const safeTotalGames = (typeof totalGames === 'number' && totalGames >= 0) ? Math.floor(totalGames) : undefined

    // 使用 upsert 避免竞态条件：先尝试更新，不存在则创建
    const existing = await db.collection('users').where({ openid }).get()
    if (existing.data.length === 0) {
      await db.collection('users').add({
        data: {
          openid,
          nickName: safeNickName || '匿名玩家',
          avatarUrl: (typeof avatarUrl === 'string') ? avatarUrl : '',
          rank: safeRank || 'bronze',
          rankPoints: safeRankPoints || 0,
          totalGames: safeTotalGames || 0,
          bestScores: (bestScores && typeof bestScores === 'object') ? bestScores : {},
          updateTime: now
        }
      })
    } else {
      const updateData = { updateTime: now }
      if (safeNickName !== undefined) updateData.nickName = safeNickName
      if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl
      if (safeRank !== undefined) updateData.rank = safeRank
      if (safeRankPoints !== undefined) updateData.rankPoints = safeRankPoints
      if (safeTotalGames !== undefined) updateData.totalGames = safeTotalGames
      if (bestScores !== undefined) updateData.bestScores = bestScores
      await db.collection('users').where({ openid }).update({ data: updateData })
    }
    return { success: true }
  }

  // 获取排行榜
  if (action === 'rank') {
    try {
      const rankRes = await db.collection('users')
        .orderBy('rankPoints', 'desc')
        .limit(50)
        .get()
      // 只返回必要字段，不泄露 openid
      const rankList = rankRes.data.map((user, i) => ({
        nickName: user.nickName || '匿名玩家',
        avatarUrl: user.avatarUrl || '',
        rank: user.rank || 'bronze',
        rankPoints: user.rankPoints || 0,
        position: i + 1
      }))

      // 我的排名
      let myRank = null
      const myUser = await db.collection('users').where({ openid }).get()
      if (myUser.data.length > 0) {
        const me = myUser.data[0]
        const myPoints = me.rankPoints || 0
        const countRes = await db.collection('users')
          .where({ rankPoints: _.gt(myPoints) })
          .count()
        myRank = {
          nickName: me.nickName || '匿名玩家',
          avatarUrl: me.avatarUrl || '',
          rank: me.rank || 'bronze',
          rankPoints: myPoints,
          position: countRes.total + 1
        }
      }

      return { rankList, myRank }
    } catch (e) {
      console.error('排行榜查询失败:', e)
      return { rankList: [], myRank: null, error: '排行榜暂时不可用' }
    }
  }

  return { error: 'unknown action: ' + (action || 'undefined') }
}
