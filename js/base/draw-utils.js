/**
 * Canvas 绘制工具函数
 */
const THEME = require('../config/theme')

// 绘制圆角矩形路径
function roundedRect(ctx, x, y, w, h, r) {
  if (r > w / 2) r = w / 2
  if (r > h / 2) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y, x + w, y + r, r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x, y + h, x, y + h - r, r)
  ctx.lineTo(x, y + r)
  ctx.arcTo(x, y, x + r, y, r)
  ctx.closePath()
}

// 填充圆角矩形
function fillRoundedRect(ctx, x, y, w, h, r, color) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = color
  ctx.fill()
}

// 描边圆角矩形
function strokeRoundedRect(ctx, x, y, w, h, r, color, lineWidth) {
  roundedRect(ctx, x, y, w, h, r)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth || 1
  ctx.stroke()
}

// 绘制渐变圆角矩形
function fillGradientRoundedRect(ctx, x, y, w, h, r, angle, stops) {
  const rad = angle * Math.PI / 180
  const cx = x + w / 2
  const cy = y + h / 2
  const len = Math.max(w, h)
  const x1 = cx - Math.cos(rad) * len / 2
  const y1 = cy - Math.sin(rad) * len / 2
  const x2 = cx + Math.cos(rad) * len / 2
  const y2 = cy + Math.sin(rad) * len / 2
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  roundedRect(ctx, x, y, w, h, r)
  ctx.fillStyle = gradient
  ctx.fill()
}

// 绘制渐变文字
function drawGradientText(ctx, text, x, y, fontSize, fontWeight, stops, align, baseline) {
  ctx.font = `${fontWeight || '700'} ${fontSize}px ${THEME.fontFamily}`
  ctx.textAlign = align || 'left'
  ctx.textBaseline = baseline || 'top'
  const metrics = ctx.measureText(text)
  const gradient = ctx.createLinearGradient(x, y, x + metrics.width, y)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  ctx.fillStyle = gradient
  ctx.fillText(text, x, y)
}

// 绘制居中渐变文字
function drawCenteredGradientText(ctx, text, cx, y, fontSize, fontWeight, stops) {
  ctx.font = `${fontWeight || '700'} ${fontSize}px ${THEME.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const metrics = ctx.measureText(text)
  const x = cx - metrics.width / 2
  const gradient = ctx.createLinearGradient(x, y, x + metrics.width, y)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  ctx.fillStyle = gradient
  ctx.fillText(text, cx, y)
}

// 绘制渐变背景
function drawGradientBg(ctx, w, h, angle, stops) {
  const rad = angle * Math.PI / 180
  const cx = w / 2
  const cy = h / 2
  const len = Math.max(w, h)
  const x1 = cx - Math.cos(rad) * len / 2
  const y1 = cy - Math.sin(rad) * len / 2
  const x2 = cx + Math.cos(rad) * len / 2
  const y2 = cy + Math.sin(rad) * len / 2
  const gradient = ctx.createLinearGradient(x1, y1, x2, y2)
  stops.forEach(([offset, color]) => gradient.addColorStop(offset, color))
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, w, h)
}

// 绘制圆形
function fillCircle(ctx, cx, cy, r, color) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()
}

// 绘制圆环（弧线）
function drawArc(ctx, cx, cy, r, startAngle, endAngle, color, lineWidth) {
  ctx.beginPath()
  ctx.arc(cx, cy, r, startAngle, endAngle)
  ctx.strokeStyle = color
  ctx.lineWidth = lineWidth || 2
  ctx.stroke()
}

// 绘制文字（简化调用）
function drawText(ctx, text, x, y, opts) {
  opts = opts || {}
  ctx.font = `${opts.fontWeight || '400'} ${opts.fontSize || 28}px ${opts.fontFamily || THEME.fontFamily}`
  ctx.fillStyle = opts.color || '#ffffff'
  ctx.textAlign = opts.align || 'left'
  ctx.textBaseline = opts.baseline || 'top'
  ctx.fillText(text, x, y)
}

// 绘制居中文字
function drawCenteredText(ctx, text, cx, y, opts) {
  opts = opts || {}
  ctx.font = `${opts.fontWeight || '400'} ${opts.fontSize || 28}px ${opts.fontFamily || THEME.fontFamily}`
  ctx.fillStyle = opts.color || '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = opts.baseline || 'top'
  ctx.fillText(text, cx, y)
}

// 测量文字宽度
function measureText(ctx, text, fontSize, fontWeight) {
  ctx.font = `${fontWeight || '400'} ${fontSize}px ${THEME.fontFamily}`
  return ctx.measureText(text).width
}

// 点是否在矩形内
function pointInRect(px, py, x, y, w, h) {
  return px >= x && px <= x + w && py >= y && py <= y + h
}

// 点是否在圆内
function pointInCircle(px, py, cx, cy, r) {
  const dx = px - cx
  const dy = py - cy
  return dx * dx + dy * dy <= r * r
}

// 绘制删除线文字
function drawStrikethroughText(ctx, text, x, y, opts) {
  drawText(ctx, text, x, y, opts)
  const w = measureText(ctx, text, opts.fontSize || 28, opts.fontWeight)
  const textY = y + (opts.fontSize || 28) / 2
  ctx.beginPath()
  ctx.moveTo(x, textY)
  ctx.lineTo(x + w, textY)
  ctx.strokeStyle = opts.strikeColor || 'rgba(255,255,255,0.5)'
  ctx.lineWidth = opts.strikeWidth || 2
  ctx.stroke()
}

// 文字自动换行
function wrapText(ctx, text, maxWidth, fontSize, fontWeight) {
  ctx.font = `${fontWeight || '400'} ${fontSize}px ${THEME.fontFamily}`
  const lines = []
  let line = ''
  for (let i = 0; i < text.length; i++) {
    const testLine = line + text[i]
    if (ctx.measureText(testLine).width > maxWidth && line.length > 0) {
      lines.push(line)
      line = text[i]
    } else {
      line = testLine
    }
  }
  if (line) lines.push(line)
  return lines
}

// 绘制带阴影的圆角矩形
function fillShadowRoundedRect(ctx, x, y, w, h, r, color, shadowColor, blur, offsetX, offsetY) {
  ctx.save()
  ctx.shadowColor = shadowColor || 'rgba(0,0,0,0.3)'
  ctx.shadowBlur = blur || 10
  ctx.shadowOffsetX = offsetX || 0
  ctx.shadowOffsetY = offsetY || 2
  fillRoundedRect(ctx, x, y, w, h, r, color)
  ctx.restore()
}

// 绘制发光圆形
function fillGlowCircle(ctx, cx, cy, r, color, glowColor, blur) {
  ctx.save()
  ctx.shadowColor = glowColor || color
  ctx.shadowBlur = blur || 20
  fillCircle(ctx, cx, cy, r, color)
  ctx.restore()
}

// 绘制发光圆环
function drawGlowArc(ctx, cx, cy, r, startAngle, endAngle, color, lineWidth, glowBlur) {
  ctx.save()
  ctx.shadowColor = color
  ctx.shadowBlur = glowBlur || 15
  drawArc(ctx, cx, cy, r, startAngle, endAngle, color, lineWidth)
  ctx.restore()
}

// 绘制噪点纹理叠加（预留接口，当前版本使用暖光代替）
function drawNoiseOverlay(ctx, w, h) {
  // 暖色调背景已有足够质感，不再叠加噪点
}

// 绘制柔和内阴影（卡片凹陷感）
function drawSoftInnerShadow(ctx, x, y, w, h, r, color, blur) {
  ctx.save()
  ctx.beginPath()
  roundedRect(ctx, x, y, w, h, r)
  ctx.clip()
  ctx.shadowColor = color || 'rgba(0,0,0,0.12)'
  ctx.shadowBlur = blur || 8
  ctx.shadowOffsetY = 2
  ctx.fillStyle = 'rgba(0,0,0,0)'
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

// 绘制居中文字（支持 middle baseline）
function drawCenteredTextV(ctx, text, cx, cy, opts) {
  opts = opts || {}
  ctx.font = `${opts.fontWeight || '400'} ${opts.fontSize || 28}px ${opts.fontFamily || THEME.fontFamily}`
  ctx.fillStyle = opts.color || '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, cy)
}

module.exports = {
  roundedRect,
  fillRoundedRect,
  strokeRoundedRect,
  fillGradientRoundedRect,
  drawGradientText,
  drawCenteredGradientText,
  drawGradientBg,
  fillCircle,
  drawArc,
  drawText,
  drawCenteredText,
  drawCenteredTextV,
  measureText,
  pointInRect,
  pointInCircle,
  drawStrikethroughText,
  wrapText,
  fillShadowRoundedRect,
  fillGlowCircle,
  drawGlowArc,
  drawNoiseOverlay,
  drawSoftInnerShadow
}
