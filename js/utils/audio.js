/**
 * 音频管理器 - 程序化生成音效和背景音乐
 * 使用 Web Audio API，无需外部音频文件
 */

class AudioManager {
  constructor() {
    this._ctx = null
    this._initialized = false
    this._muted = false
    this._bgmPlaying = false
    this._bgmShouldResume = false
    this._bgmNodes = []
    this._bgmGain = null
    this._sfxVolume = 0.6
    this._bgmVolume = 0.15
    this._bgmTimer = null
    // 从本地存储恢复设置
    const saved = wx.getStorageSync('soundEnabled')
    if (saved === false) this._muted = true
  }

  /**
   * 延迟初始化 AudioContext（需在用户交互后调用）
   */
  init() {
    if (this._initialized) return
    try {
      this._ctx = wx.createWebAudioContext()
      this._initialized = true
      console.log('[Audio] Web Audio Context 已创建')
    } catch (e) {
      console.warn('[Audio] Web Audio API 不可用:', e.message)
    }
  }

  _ensureCtx() {
    if (!this._initialized) this.init()
    // iOS/微信 AudioContext 可能处于 suspended 状态，需要 resume
    if (this._ctx && this._ctx.state === 'suspended') {
      this._ctx.resume().catch(() => {})
    }
    return this._ctx !== null
  }

  // ============ 音效 (SFX) ============

  playSFX(type) {
    if (this._muted || !this._ensureCtx()) return
    const ctx = this._ctx
    const now = ctx.currentTime

    switch (type) {
      case 'success': this._playSuccess(ctx, now); break
      case 'fail': this._playFail(ctx, now); break
      case 'tap': this._playTap(ctx, now); break
      case 'combo': this._playCombo(ctx, now); break
      case 'start': this._playStart(ctx, now); break
      case 'finish': this._playFinish(ctx, now); break
      case 'newRecord': this._playNewRecord(ctx, now); break
      case 'rankUp': this._playRankUp(ctx, now); break
      case 'countdown': this._playCountdown(ctx, now); break
    }
  }

  _createOsc(ctx, type, freq, startTime, duration, volume) {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(volume * this._sfxVolume, startTime)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(startTime)
    osc.stop(startTime + duration)
    return { osc, gain }
  }

  _playNote(ctx, type, freq, start, dur, vol) {
    this._createOsc(ctx, type, freq, start, dur, vol || 0.3)
  }

  // 成功：上升音阶 C5-E5-G5
  _playSuccess(ctx, now) {
    this._playNote(ctx, 'sine', 523, now, 0.1, 0.25)
    this._playNote(ctx, 'sine', 659, now + 0.08, 0.1, 0.25)
    this._playNote(ctx, 'sine', 784, now + 0.16, 0.15, 0.3)
  }

  // 失败：低沉短音
  _playFail(ctx, now) {
    this._playNote(ctx, 'square', 200, now, 0.15, 0.15)
    this._playNote(ctx, 'square', 160, now + 0.05, 0.12, 0.1)
  }

  // 普通点击
  _playTap(ctx, now) {
    this._playNote(ctx, 'sine', 800, now, 0.05, 0.2)
  }

  // 连击：高亮清脆音
  _playCombo(ctx, now) {
    this._playNote(ctx, 'sine', 1047, now, 0.06, 0.3)
    this._playNote(ctx, 'sine', 1319, now + 0.03, 0.05, 0.2)
  }

  // 游戏开始：三音上升序列 A4-C#5-E5
  _playStart(ctx, now) {
    this._playNote(ctx, 'sine', 440, now, 0.12, 0.25)
    this._playNote(ctx, 'sine', 554, now + 0.1, 0.12, 0.25)
    this._playNote(ctx, 'sine', 659, now + 0.2, 0.18, 0.3)
  }

  // 游戏结算：C-E-G 和弦
  _playFinish(ctx, now) {
    this._playNote(ctx, 'sine', 523, now, 0.4, 0.2)
    this._playNote(ctx, 'sine', 659, now, 0.4, 0.15)
    this._playNote(ctx, 'sine', 784, now, 0.4, 0.15)
  }

  // 新纪录：快速上升闪烁
  _playNewRecord(ctx, now) {
    const freqs = [880, 1109, 1319, 1568]
    freqs.forEach((f, i) => {
      this._playNote(ctx, 'sine', f, now + i * 0.06, 0.12, 0.25)
    })
  }

  // 段位晋升：庆祝上升
  _playRankUp(ctx, now) {
    const freqs = [523, 659, 784, 1047]
    freqs.forEach((f, i) => {
      this._playNote(ctx, 'sine', f, now + i * 0.1, 0.2, 0.3)
    })
    // 叠加和弦结尾
    this._playNote(ctx, 'sine', 523, now + 0.4, 0.5, 0.15)
    this._playNote(ctx, 'sine', 784, now + 0.4, 0.5, 0.12)
  }

  // 倒计时：短促滴答
  _playCountdown(ctx, now) {
    this._playNote(ctx, 'square', 1000, now, 0.05, 0.15)
  }

  // ============ 背景音乐 (BGM) ============

  playBGM() {
    if (this._muted || !this._ensureCtx()) return
    if (this._bgmPlaying) return
    this._bgmPlaying = true
    this._bgmLoop()
  }

  _bgmLoop() {
    if (!this._bgmPlaying || this._muted) return
    const ctx = this._ctx
    const now = ctx.currentTime

    // BGM 和弦进行：C major → F major → G major → C major
    const chords = [
      [261.63, 329.63, 392.00],  // C4 E4 G4
      [349.23, 440.00, 523.25],  // F4 A4 C5
      [392.00, 493.88, 587.33],  // G4 B4 D5
      [261.63, 329.63, 392.00]   // C4 E4 G4
    ]

    const chordDuration = 2.0
    const totalDuration = chords.length * chordDuration

    // 使用持久的 master gain 节点，音量变更即时生效
    if (!this._bgmGain) {
      this._bgmGain = ctx.createGain()
      this._bgmGain.connect(ctx.destination)
    }
    this._bgmGain.gain.setValueAtTime(this._bgmVolume, now)

    chords.forEach((chord, ci) => {
      const startTime = now + ci * chordDuration
      chord.forEach(freq => {
        const osc = ctx.createOscillator()
        const noteGain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        // 柔和的音量包络
        noteGain.gain.setValueAtTime(0, startTime)
        noteGain.gain.linearRampToValueAtTime(0.08, startTime + 0.3)
        noteGain.gain.linearRampToValueAtTime(0.06, startTime + chordDuration * 0.7)
        noteGain.gain.linearRampToValueAtTime(0, startTime + chordDuration)
        osc.connect(noteGain)
        noteGain.connect(this._bgmGain)
        osc.start(startTime)
        osc.stop(startTime + chordDuration + 0.01)
        this._bgmNodes.push(osc)
      })
    })

    // 循环：totalDuration 秒后重新开始
    this._bgmTimer = setTimeout(() => {
      this._bgmNodes = []
      this._bgmLoop()
    }, totalDuration * 1000)
  }

  stopBGM() {
    this._bgmPlaying = false
    if (this._bgmTimer) {
      clearTimeout(this._bgmTimer)
      this._bgmTimer = null
    }
    this._bgmNodes.forEach(osc => {
      try { osc.stop() } catch (e) { /* already stopped */ }
    })
    this._bgmNodes = []
    if (this._bgmGain) {
      try { this._bgmGain.disconnect() } catch (e) {}
      this._bgmGain = null
    }
  }

  pauseBGM() {
    if (this._bgmPlaying) {
      this._bgmShouldResume = true
      this.stopBGM()
    }
  }

  resumeBGM() {
    if (this._bgmShouldResume && !this._muted) {
      this._bgmShouldResume = false
      this.playBGM()
    }
  }

  // ============ 设置 ============

  setMuted(muted) {
    this._muted = muted
    wx.setStorageSync('soundEnabled', !muted)
    if (muted) {
      this.stopBGM()
    } else {
      this.playBGM()
    }
  }

  isMuted() {
    return this._muted
  }

  destroy() {
    this.stopBGM()
    if (this._ctx) {
      try { this._ctx.close() } catch (e) {}
      this._ctx = null
    }
    this._initialized = false
  }
}

module.exports = AudioManager
