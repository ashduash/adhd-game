# 内容安全API接入检查清单

## API接入状态

### 1. msgSecCheck（文本安全检测）✅ 已接入

**用途**: 检测用户自定义昵称、聊天内容等文本信息

**接入位置**:
- 云函数: `cloudfunctions/contentCheck/index.js` 第83-103行
- 服务端: `server/server.js` `/api/check-content` 端点
- 客户端: `js/utils/sensitive-filter.js` `checkContent()` 函数

**调用流程**:
1. 客户端调用 `checkContent(text, serverUrl)`
2. 优先通过云函数调用 `cloud.openapi.security.msgSecCheck`
3. 云不可用时，回退到服务端HTTP接口
4. 服务端调用微信API: `https://api.weixin.qq.com/wxa/msg_sec_check`

**测试方法**:
```bash
curl -X POST http://localhost:3000/api/check-content \
  -H "Content-Type: application/json" \
  -d '{"content":"测试内容","openid":"test_user"}'
```

---

### 2. imgSecCheck（图片安全检测）✅ 已接入

**用途**: 检测用户上传的头像等图片内容

**接入位置**:
- 云函数: `cloudfunctions/contentCheck/index.js` 第37-81行
- 服务端: `server/server.js` `/api/check-image` 端点
- 客户端: `js/utils/sensitive-filter.js` `checkImage()` 函数

**调用流程**:
1. 客户端调用 `checkImage(imageBase64, serverUrl)`
2. 优先通过云函数调用 `cloud.openapi.security.imgSecCheck`
3. 云不可用时，回退到服务端HTTP接口
4. 服务端调用微信API: `https://api.weixin.qq.com/wxa/img_sec_check`

**测试方法**:
```bash
# 需要准备一个测试图片的base64编码
curl -X POST http://localhost:3000/api/check-image \
  -H "Content-Type: application/json" \
  -d '{"imageBase64":"/9j/4AAQ..."}'
```

---

### 3. mediaCheckAsync（异步媒体安全检测）✅ 已接入

**用途**: 异步检测图片、音频、视频等媒体内容（适用于大文件）

**接入位置**:
- 云函数: `cloudfunctions/contentCheck/index.js` 第14-35行
- 服务端: `server/server.js` `/api/check-media-async` 端点
- 客户端: `js/utils/sensitive-filter.js` `checkMediaAsync()` 函数

**调用流程**:
1. 客户端调用 `checkMediaAsync(mediaUrl, serverUrl)`
2. 优先通过云函数调用 `cloud.openapi.security.mediaCheckAsync`
3. 云不可用时，回退到服务端HTTP接口
4. 服务端调用微信API: `https://api.weixin.qq.com/wxa/media_check_async`
5. 返回 `traceId` 用于查询检测结果

**注意**: mediaCheckAsync 是异步API，提交后立即返回，实际检测结果通过回调通知

**测试方法**:
```bash
curl -X POST http://localhost:3000/api/check-media-async \
  -H "Content-Type: application/json" \
  -d '{"mediaUrl":"https://example.com/test.jpg","mediaType":2}'
```

---

## 部署前检查清单

### 1. 服务端配置 ✅

- [ ] 填写 `server/server.js` 第12行的 `WX_SECRET`
  ```javascript
  const WX_SECRET = 'your_appsecret_here' // 从微信公众平台获取
  ```

- [ ] 启动服务器
  ```bash
  node server/server.js
  ```

- [ ] 确保服务器公网可访问（审核时微信服务器需要能访问）

### 2. 云函数部署 ✅

- [ ] 部署 `contentCheck` 云函数
  ```bash
  cd cloudfunctions/contentCheck
  # 在微信开发者工具中右键上传部署
  ```

- [ ] 部署 `cleanSensitiveData` 云函数
  ```bash
  cd cloudfunctions/cleanSensitiveData
  # 在微信开发者工具中右键上传部署
  ```

### 3. 数据清理 ✅

- [ ] 运行 `cleanSensitiveData` 云函数清理已有违规数据
  - 在微信云开发控制台调用该函数
  - 或通过客户端调用

### 4. 测试验证 ✅

- [ ] 运行测试脚本验证API接入
  ```bash
  node test-content-security.js
  ```

- [ ] 测试敏感词拦截
  - 输入"习金瓶" → 应被拦截
  - 输入"dev_97upg0_mpwkj" → 应被拦截
  - 输入正常昵称 → 应通过

- [ ] 测试图片检测
  - 上传正常头像 → 应通过
  - 上传违规图片 → 应被拦截

---

## 常见问题

### Q1: 服务器未配置WX_SECRET会怎样？
A: 服务器会拒绝所有内容检测请求（fail-closed策略），确保不会漏检。

### Q2: 云函数未部署会怎样？
A: 客户端会自动回退到服务端HTTP接口，只要服务端配置正确即可。

### Q3: mediaCheckAsync的回调如何处理？
A: 需要在微信公众平台配置消息回调URL，或通过轮询查询检测结果。

### Q4: 如何获取WX_SECRET？
A: 登录微信公众平台 → 开发管理 → 开发设置 → AppSecret

---

## API调用示例

### 客户端JavaScript调用

```javascript
const { checkContent, checkImage, checkMediaAsync } = require('./js/utils/sensitive-filter')

// 文本检测
const textResult = await checkContent('用户昵称', serverUrl)
if (!textResult.pass) {
  wx.showToast({ title: textResult.reason })
  return
}

// 图片检测
const imageResult = await checkImage(imageBase64, serverUrl)
if (!imageResult.pass) {
  wx.showToast({ title: imageResult.reason })
  return
}

// 异步媒体检测
const mediaResult = await checkMediaAsync(mediaUrl, serverUrl)
if (!mediaResult.pass) {
  wx.showToast({ title: mediaResult.reason })
  return
}
console.log('检测已提交，traceId:', mediaResult.traceId)
```

---

## 联系支持

如遇问题，请检查：
1. 服务器日志输出
2. 微信云函数日志
3. 微信公众平台API调用统计
