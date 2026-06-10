const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()

// 敏感词库（与主项目保持一致）
const SENSITIVE_WORDS = [
  // 侮辱性
  '傻逼', '操你', '狗日', '死全家', '草泥马', '尼玛',
  '妈逼', '你妈', '卧槽', '我操', 'fuck', 'shit',
  '煞笔', '沙比', '逼样', '贱人', '贱货', '王八蛋',
  '狗娘', '畜生', '混蛋', '白痴', '弱智', '脑残',
  '婊子', '贱婢', '狗杂种', '杂种', '去死', '滚蛋',
  '傻b', 'sb', 'nmsl', '你妈死', 'cnm', 'nmb',
  'tmd', 'mdzz', 'zz', '智障', '废物', '蠢货',
  '二逼', '逗比', '装逼', '牛逼', '撕逼',
  // 涉黄
  '色情', '裸体', '淫秽', '卖淫', '嫖娼', '约炮',
  '一夜情', '性交', '口交', '自慰', '淫荡', '骚货',
  '妓女', '鸡巴', '阴茎', '阴道', '乳房', '做爱',
  '操逼', '日逼', '干逼', '骚逼', '贱逼', '烂逼',
  '阴蒂', '睾丸', '高潮', '叫床', '春药', '催情',
  '迷药', '迷奸', '轮奸', '强奸', '性虐',
  '援交', '包养', '小三', '情妇', '偷情', '出轨',
  'av', '黄片', '毛片', '黄网', '成人网', '黄色网站',
  '裸聊', '裸照', '私密照', '艳照', '性服务',
  '成人用品', '情趣用品', '飞机杯', '充气娃娃',
  '阴唇', '私处', '下体', '下半身',
  // 涉暴
  '恐怖袭击', '炸弹', '枪击', '杀人', '砍人', '自杀',
  '自残', '跳楼', '割腕', '上吊', '投毒', '放火',
  '爆炸', '绑架', '劫持', '暗杀', '屠杀', '灭门',
  '连环杀手', '变态杀手', '虐杀', '分尸', '肢解',
  '活埋', '溺死', '勒死', '捅死', '砍死', '打死',
  '枪毙', '行刑', '酷刑', '凌迟', '活摘器官',
  '校园暴力', '霸凌', '欺凌', '群殴', '械斗',
  // 赌博
  '赌博', '赌场', '赌球', '赌马', '老虎机', '百家乐',
  '德州扑克', '梭哈', '押注', '下注', '博彩', '彩票',
  '六合彩', '时时彩', '北京赛车', '幸运飞艇',
  '网赌', '线上赌博', '赌博网站', '赌博app',
  '庄家', '赌徒', '赌资', '赌债', '翻本', '赢钱',
  '开奖', '投注', '赔率', '盘口', '外围',
  // 毒品/违禁品
  '毒品', '贩毒', '吸毒', '冰毒', '海洛因', '大麻',
  '摇头丸', 'k粉', '可卡因', '鸦片', '吗啡',
  '制毒', '运毒', '藏毒', '戒毒', '毒贩',
  '枪支', '弹药', '军火', '走私', '贩卖人口',
  // 违法犯罪
  '传销', '诈骗', '洗钱', '拐卖', '猥亵',
  '入室盗窃', '抢劫', '抢夺', '飞车抢夺',
  '电信诈骗', '网络诈骗', '杀猪盘', '杀鱼盘',
  '钓鱼网站', '木马', '黑客攻击', 'ddos',
  '非法集资', '非法经营', '偷税漏税', '行贿受贿',
  '伪造', '造假', '假币', '假证', '代办证件',
  // 政治敏感
  '习近平', '习金瓶', '习进平', '习大大', '习主席',
  '毛泽东', '共产党', '六四', '天安门',
  '法轮功', '藏独', '疆独', '台独', '港独',
  '文化大革命', '大跃进', '反右', '文革',
  '六四事件', '天安门事件', '民主运动',
  '达赖喇嘛', '达赖', '热比娅', '东突',
  '民运', '维权', '上访', '请愿', '示威',
  '颠覆', '推翻', '政变', '革命', '暴动',
  '政治犯', '异见人士', '良心犯',
  '国民党', '民进党', '中华民国',
  '西藏独立', '新疆独立', '台湾独立',
  '赤化', '共匪', '党匪', '土共', '共惨党',
  '江泽民', '胡锦涛', '邓小平', '华国锋',
  '赵紫阳', '胡耀邦', '林彪', '四人帮',
  '六四镇压', '天安门屠杀', '坦克人',
  '反华', '辱华', '精日', '恨国',
  '共产党执政', '一党专政', '独裁',
  '血债', '镇压', '迫害', '压迫',
  '政治迫害', '人权', '自由民主',
  '西藏流亡', '新疆集中营', '再教育营',
  '香港示威', '反送中', '光复香港',
  '台独分子', '台湾独立', '两国论',
  '钓鱼岛', '尖阁诸岛', '南海仲裁',
  // 歧视/仇恨
  '黑鬼', '白猪', '支那', '东亚病夫', '贱民',
  '三等公民', '劣等民族', '蛮夷',
  '地域歧视',
  '女权癌', '直男癌', '娘炮', '人妖',
  '残废', '瘸子', '瞎子', '聋子', '哑巴',
  // 邪教/迷信
  '邪教', '全能神', '呼喊派', '门徒会',
  '血水圣灵', '观音法门', '统一教',
  '算命', '占卜', '风水大师', '转运',
  // 广告/引流
  '加微信', '加QQ', '免费领', '扫码', '点击链接',
  '代充', '外挂', '私服', '破解版',
  '刷单', '兼职', '日赚', '月入', '躺赚',
  '优惠券', '内部价', '代理', '招商',
  '微信号', 'qq号', '加好友', '私聊',
  '低价出售', '便宜卖', '转让', '回收',
  // 其他违规
  '人肉搜索', '开盒', '曝光隐私', '泄露信息',
  '代孕', '卖卵', '买肾', '器官买卖',
  '换头术', '克隆人', '人体实验',
]

function isSensitive(text) {
  if (!text || typeof text !== 'string') return false
  const lowerText = text.toLowerCase()
  for (const word of SENSITIVE_WORDS) {
    if (lowerText.includes(word.toLowerCase())) return true
  }
  return false
}

// 调用微信 msgSecCheck API 进行深度检测
async function checkByApi(content) {
  try {
    const result = await cloud.openapi.security.msgSecCheck({
      openid: 'system_audit',
      scene: 2,
      version: 2,
      content: content.trim()
    })
    return result.errCode !== 0
  } catch (err) {
    console.error('msgSecCheck 调用失败:', err)
    // API 失败时回退到本地检测
    return isSensitive(content)
  }
}

exports.main = async (event, context) => {
  const result = { cleaned: 0, total: 0, apiChecked: 0, apiBlocked: 0, errors: [] }

  try {
    // 获取所有用户数据
    const countRes = await db.collection('users').count()
    const total = countRes.total
    result.total = total

    // 分批获取数据（云开发每次最多20条）
    const batchSize = 20
    const batches = Math.ceil(total / batchSize)

    for (let i = 0; i < batches; i++) {
      const skip = i * batchSize
      const listRes = await db.collection('users')
        .skip(skip)
        .limit(batchSize)
        .get()

      for (const user of listRes.data) {
        if (!user.nickName) continue

        // 第一层：本地敏感词检测
        if (isSensitive(user.nickName)) {
          try {
            await db.collection('users').doc(user._id).update({
              data: { nickName: '匿名玩家' }
            })
            result.cleaned++
            console.log(`[本地清理] ${user.nickName} -> 匿名玩家`)
          } catch (e) {
            result.errors.push({ openid: user.openid, error: e.message })
          }
          continue
        }

        // 第二层：微信 msgSecCheck API 深度检测
        result.apiChecked++
        const isBlocked = await checkByApi(user.nickName)
        if (isBlocked) {
          try {
            await db.collection('users').doc(user._id).update({
              data: { nickName: '匿名玩家' }
            })
            result.apiBlocked++
            result.cleaned++
            console.log(`[API清理] ${user.nickName} -> 匿名玩家`)
          } catch (e) {
            result.errors.push({ openid: user.openid, error: e.message })
          }
        }
      }
    }

    return { success: true, ...result }
  } catch (err) {
    console.error('清理失败:', err)
    return { success: false, error: err.message, ...result }
  }
}
