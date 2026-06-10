/**
 * 内容安全API接入验证脚本
 * 运行方式: node test-content-security.js
 */

const http = require('http')

const SERVER_URL = 'http://localhost:3000'

// 测试用例
const testCases = [
  {
    name: 'msgSecCheck - 正常内容',
    endpoint: '/api/check-content',
    data: { content: '玩家昵称', openid: 'test_user' },
    expect: { errCode: 0 }
  },
  {
    name: 'msgSecCheck - 敏感词（政治）',
    endpoint: '/api/check-content',
    data: { content: '习近平', openid: 'test_user' },
    expect: { errCode: -1 }
  },
  {
    name: 'msgSecCheck - 敏感词（色情）',
    endpoint: '/api/check-content',
    data: { content: '色情网站', openid: 'test_user' },
    expect: { errCode: -1 }
  },
  {
    name: 'msgSecCheck - dev_开头ID',
    endpoint: '/api/check-content',
    data: { content: 'dev_97upg0_mpwkj', openid: 'test_user' },
    expect: { errCode: -1 }
  },
  {
    name: 'imgSecCheck - 无图片数据',
    endpoint: '/api/check-image',
    data: {},
    expect: { errCode: -1 }
  },
  {
    name: 'mediaCheckAsync - 无媒体URL',
    endpoint: '/api/check-media-async',
    data: {},
    expect: { errCode: -1 }
  },
  {
    name: 'mediaCheckAsync - 正常请求',
    endpoint: '/api/check-media-async',
    data: { mediaUrl: 'https://example.com/test.jpg', mediaType: 2 },
    expect: { errCode: 0 } // 如果WX_SECRET配置正确
  }
]

// 发送测试请求
function sendRequest(testCase) {
  return new Promise((resolve) => {
    const postData = JSON.stringify(testCase.data)
    const url = new URL(SERVER_URL + testCase.endpoint)

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    const req = http.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => data += chunk)
      res.on('end', () => {
        try {
          const result = JSON.parse(data)
          resolve({ success: true, result })
        } catch (e) {
          resolve({ success: false, error: 'Invalid JSON response' })
        }
      })
    })

    req.on('error', (e) => {
      resolve({ success: false, error: e.message })
    })

    req.setTimeout(10000, () => {
      req.destroy()
      resolve({ success: false, error: 'Timeout' })
    })

    req.write(postData)
    req.end()
  })
}

// 运行测试
async function runTests() {
  console.log('=== 内容安全API接入验证 ===\n')
  console.log('服务器地址: ' + SERVER_URL + '\n')

  let passed = 0
  let failed = 0

  for (const testCase of testCases) {
    process.stdout.write(`测试: ${testCase.name} ... `)

    const response = await sendRequest(testCase)

    if (!response.success) {
      console.log(`❌ 失败 (${response.error})`)
      failed++
      continue
    }

    const result = response.result
    const errCodeMatch = result.errCode === testCase.expect.errCode

    if (errCodeMatch) {
      console.log(`✅ 通过 (errCode: ${result.errCode})`)
      passed++
    } else {
      console.log(`❌ 失败 (期望: ${testCase.expect.errCode}, 实际: ${result.errCode})`)
      console.log(`   响应: ${JSON.stringify(result)}`)
      failed++
    }
  }

  console.log(`\n=== 测试结果 ===`)
  console.log(`通过: ${passed}/${testCases.length}`)
  console.log(`失败: ${failed}/${testCases.length}`)

  if (failed > 0) {
    console.log('\n⚠️  存在失败的测试用例，请检查服务器配置')
    console.log('确保 server/server.js 中的 WX_SECRET 已正确配置')
  } else {
    console.log('\n✅ 所有测试通过！内容安全API接入正常')
  }
}

// 检查服务器是否运行
async function checkServer() {
  return new Promise((resolve) => {
    const req = http.get(SERVER_URL, (res) => {
      resolve(true)
    })
    req.on('error', () => resolve(false))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve(false)
    })
  })
}

// 主函数
async function main() {
  const serverRunning = await checkServer()

  if (!serverRunning) {
    console.log('❌ 服务器未运行')
    console.log('请先启动服务器: node server/server.js')
    process.exit(1)
  }

  await runTests()
}

main().catch(console.error)
