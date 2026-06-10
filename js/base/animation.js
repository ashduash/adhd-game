/**
 * 动画系统 - Tween + 缓动函数
 */

// 缓动函数
const EASING = {
  linear: t => t,
  easeIn: t => t * t * t,
  easeOut: t => 1 - Math.pow(1 - t, 3),
  easeInOut: t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
  // 弹性回弹 (模拟 cubic-bezier(0.34, 1.56, 0.64, 1))
  spring: t => {
    if (t === 0 || t === 1) return t
    return 1 + 1.56 * Math.pow(t - 1, 3) + 0.34 * Math.pow(t - 1, 2)
  },
  elastic: t => {
    if (t === 0 || t === 1) return t
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1
  },
  bounce: t => {
    if (t < 1 / 2.75) return 7.5625 * t * t
    if (t < 2 / 2.75) return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75
    if (t < 2.5 / 2.75) return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375
    return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375
  },
  // 快速进入缓慢退出
  fastOut: t => 1 - Math.pow(1 - t, 4)
}

class Tween {
  constructor(target, props, duration, opts) {
    this.target = target
    this.props = props
    this.startProps = {}
    this.duration = duration
    this.delay = (opts && opts.delay) || 0
    this.easing = (opts && opts.easing) || 'easeOut'
    this.onComplete = (opts && opts.onComplete) || null
    this.onUpdate = (opts && opts.onUpdate) || null
    this.elapsed = 0
    this.started = false
    this.done = false
  }

  update(dt) {
    if (this.done) return
    this.elapsed += dt * 1000
    if (this.elapsed < this.delay) return

    if (!this.started) {
      this.started = true
      for (const key in this.props) {
        this.startProps[key] = this.target[key]
      }
    }

    const t = Math.min(1, (this.elapsed - this.delay) / this.duration)
    const easeFn = EASING[this.easing] || EASING.easeOut
    const easedT = easeFn(t)

    for (const key in this.props) {
      this.target[key] = this.startProps[key] + (this.props[key] - this.startProps[key]) * easedT
    }

    if (this.onUpdate) this.onUpdate(easedT)

    if (t >= 1) {
      this.done = true
      if (this.onComplete) this.onComplete()
    }
  }
}

// 脉冲动画（无限循环）
class PulseAnimator {
  constructor(target, prop, min, max, period) {
    this.target = target
    this.prop = prop
    this.min = min
    this.max = max
    this.period = period
    this.time = 0
    this.done = false
  }

  update(dt) {
    this.time += dt
    const t = (Math.sin(this.time / this.period * Math.PI * 2) + 1) / 2
    this.target[this.prop] = this.min + (this.max - this.min) * t
  }
}

// 浮动动画（无限循环）
class FloatAnimator {
  constructor(target, prop, base, amplitude, period) {
    this.target = target
    this.prop = prop
    this.base = base
    this.amplitude = amplitude
    this.period = period
    this.time = 0
    this.done = false
  }

  update(dt) {
    this.time += dt
    this.target[this.prop] = this.base + Math.sin(this.time / this.period * Math.PI * 2) * this.amplitude
  }
}

class AnimationManager {
  constructor() {
    this.animations = []
  }

  tween(target, props, duration, opts) {
    const tw = new Tween(target, props, duration, opts)
    this.animations.push(tw)
    return tw
  }

  pulse(target, prop, min, max, period) {
    const p = new PulseAnimator(target, prop, min, max, period)
    this.animations.push(p)
    return p
  }

  float(target, prop, base, amplitude, period) {
    const f = new FloatAnimator(target, prop, base, amplitude, period)
    this.animations.push(f)
    return f
  }

  update(dt) {
    this.animations = this.animations.filter(a => {
      a.update(dt)
      return !a.done
    })
  }

  clear() {
    this.animations = []
  }
}

module.exports = { Tween, PulseAnimator, FloatAnimator, AnimationManager, EASING }
