/**
 * Voice input recorder.
 *
 * The ASR endpoint (`POST /v1/tools/asr`) accepts **16-bit PCM WAV or Ogg Opus**
 * only — but a WebView's MediaRecorder produces WebM/Opus or MP4/AAC depending
 * on the device. Rather than betting on `decodeAudioData` container support, we
 * capture raw PCM straight from the Web Audio graph, resample to 16 kHz mono and
 * write a canonical WAV header ourselves. That works identically on every
 * Android WebView and keeps the payload tiny (16 kHz mono ≈ 32 KB/s).
 */

const TARGET_SAMPLE_RATE = 16000
/** ASR limit is 120 s; leave headroom for upload. */
export const MAX_RECORDING_MS = 110_000

export interface RecordingResult {
  blob: Blob
  durationMs: number
  sampleRate: number
}

export class VoiceRecorder {
  private ctx: AudioContext | null = null
  private stream: MediaStream | null = null
  private source: MediaStreamAudioSourceNode | null = null
  private processor: ScriptProcessorNode | null = null
  private silentGain: GainNode | null = null
  private chunks: Float32Array[] = []
  private recordedSamples = 0
  private startedAt = 0
  private level = 0
  private active = false

  get isActive(): boolean {
    return this.active
  }

  get durationMs(): number {
    return this.active ? Date.now() - this.startedAt : 0
  }

  /** Current input level, 0…1 (RMS), for the waveform indicator. */
  getLevel(): number {
    return this.level
  }

  async start(): Promise<void> {
    if (this.active) return
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('当前环境不支持录音')
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
    } catch (err) {
      const name = (err as { name?: string })?.name
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new Error('麦克风权限被拒绝，请在系统设置中允许本应用使用麦克风')
      }
      if (name === 'NotFoundError') {
        throw new Error('没有找到可用的麦克风')
      }
      throw new Error('无法启动录音，请稍后重试')
    }

    const AudioContextCtor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new AudioContextCtor()
    await ctx.resume().catch(() => undefined)

    const source = ctx.createMediaStreamSource(stream)
    const processor = ctx.createScriptProcessor(4096, 1, 1)
    const silentGain = ctx.createGain()
    // Keep the graph alive without echoing the mic back to the speaker.
    silentGain.gain.value = 0

    this.chunks = []
    this.recordedSamples = 0
    this.level = 0

    processor.onaudioprocess = (event) => {
      if (!this.active) return
      const input = event.inputBuffer.getChannelData(0)
      const copy = new Float32Array(input.length)
      copy.set(input)
      this.chunks.push(copy)
      this.recordedSamples += copy.length

      // Cheap RMS without allocating.
      let sum = 0
      for (let i = 0; i < copy.length; i += 8) sum += copy[i] * copy[i]
      const rms = Math.sqrt(sum / (copy.length / 8))
      this.level = Math.min(1, rms * 4.2)
    }

    source.connect(processor)
    processor.connect(silentGain)
    silentGain.connect(ctx.destination)

    this.ctx = ctx
    this.stream = stream
    this.source = source
    this.processor = processor
    this.silentGain = silentGain
    this.startedAt = Date.now()
    this.active = true
  }

  /** Stop, tear down the audio graph and return an encoded 16 kHz WAV. */
  async stop(): Promise<RecordingResult> {
    if (!this.active) throw new Error('录音尚未开始')
    const durationMs = Date.now() - this.startedAt
    const sourceRate = this.ctx?.sampleRate ?? 48000
    const chunks = this.chunks
    this.teardown()
    this.active = false

    const merged = mergeChunks(chunks)
    if (merged.length === 0) throw new Error('没有录到声音，请重试')
    const resampled = resample(merged, sourceRate, TARGET_SAMPLE_RATE)
    const blob = encodeWav16(resampled, TARGET_SAMPLE_RATE)
    return { blob, durationMs, sampleRate: TARGET_SAMPLE_RATE }
  }

  cancel(): void {
    this.teardown()
    this.active = false
  }

  private teardown() {
    try {
      if (this.processor) this.processor.onaudioprocess = null
    } catch {
      /* ignore */
    }
    this.processor?.disconnect()
    this.source?.disconnect()
    this.silentGain?.disconnect()
    this.stream?.getTracks().forEach((track) => track.stop())
    void this.ctx?.close().catch(() => undefined)
    this.processor = null
    this.source = null
    this.silentGain = null
    this.stream = null
    this.ctx = null
    this.chunks = []
    this.recordedSamples = 0
    this.level = 0
  }
}

function mergeChunks(chunks: Float32Array[]): Float32Array {
  const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const merged = new Float32Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.length
  }
  return merged
}

/** Linear-interpolation resampler — plenty for 16 kHz speech recognition. */
function resample(input: Float32Array, fromRate: number, toRate: number): Float32Array {
  if (fromRate === toRate) return input
  const ratio = fromRate / toRate
  const outLength = Math.floor(input.length / ratio)
  const out = new Float32Array(outLength)
  for (let i = 0; i < outLength; i += 1) {
    const position = i * ratio
    const index = Math.floor(position)
    const next = Math.min(index + 1, input.length - 1)
    const fraction = position - index
    out[i] = input[index] * (1 - fraction) + input[next] * fraction
  }
  return out
}

/** Minimal 16-bit PCM mono WAV writer (44-byte canonical header). */
export function encodeWav16(samples: Float32Array, sampleRate: number): Blob {
  const bytesPerSample = 2
  const dataSize = samples.length * bytesPerSample
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // PCM chunk size
  view.setUint16(20, 1, true) // audio format: PCM
  view.setUint16(22, 1, true) // channels: mono
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * bytesPerSample, true) // byte rate
  view.setUint16(32, bytesPerSample, true) // block align
  view.setUint16(34, 16, true) // bits per sample
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const clamped = Math.max(-1, Math.min(1, samples[i]))
    // Asymmetric scaling avoids clipping at -1.0.
    view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true)
    offset += bytesPerSample
  }

  return new Blob([buffer], { type: 'audio/wav' })
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${`${seconds}`.padStart(2, '0')}`
}
