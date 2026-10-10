export const VISUALIZER_MODES = Object.freeze(['bars', 'wave', 'radial']);

const FFT_SIZE = 2048;
const BAR_COUNT = 64;
const MIN_FREQUENCY_BIN = 2;
const PEAK_FALL_PER_FRAME = 0.012;
const MIN_VISIBLE_LEVEL = 0.02;

/**
 * Real-time audio visualization through the Web Audio API (AnalyserNode).
 * The audio graph is created lazily, on first start, because an AudioContext
 * should be created in response to playback. Colors come from CSS custom properties.
 */
export class AudioVisualizer extends EventTarget {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {HTMLMediaElement} media
   */
  constructor(canvas, media, mode = 'bars') {
    super();
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.media = media;
    this.mode = VISUALIZER_MODES.includes(mode) ? mode : VISUALIZER_MODES[0];
    this.audioContext = null;
    this.analyser = null;
    this.frequencyData = null;
    this.waveformData = null;
    this.peaks = new Float32Array(BAR_COUNT);
    this.frameId = 0;
    this.colors = null;
    new ResizeObserver(() => this.resize()).observe(canvas);
  }

  ensureAudioGraph() {
    if (this.analyser) return;
    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaElementSource(this.media);
    this.analyser = Object.assign(this.audioContext.createAnalyser(), {
      fftSize: FFT_SIZE,
      smoothingTimeConstant: 0.8,
    });
    source.connect(this.analyser).connect(this.audioContext.destination);
    this.frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.waveformData = new Uint8Array(this.analyser.fftSize);
  }

  setVisible(isVisible) {
    this.canvas.hidden = !isVisible;
    if (isVisible) this.resize();
  }

  setRunning(isRunning) {
    if (isRunning && !this.frameId) {
      this.ensureAudioGraph();
      this.audioContext.resume();
      this.loop();
    } else if (!isRunning && this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = 0;
    }
  }

  setMode(mode) {
    if (!VISUALIZER_MODES.includes(mode) || mode === this.mode) return;
    this.mode = mode;
    this.dispatchEvent(new Event('modechange'));
  }

  cycleMode() {
    this.setMode(VISUALIZER_MODES[(VISUALIZER_MODES.indexOf(this.mode) + 1) % VISUALIZER_MODES.length]);
    return this.mode;
  }

  resize() {
    const ratio = window.devicePixelRatio || 1;
    const { clientWidth, clientHeight } = this.canvas;
    this.canvas.width = Math.round(clientWidth * ratio);
    this.canvas.height = Math.round(clientHeight * ratio);
    const style = getComputedStyle(this.canvas);
    const token = (name) => style.getPropertyValue(name).trim();
    this.colors = { primary: token('--visual-primary'), secondary: token('--visual-secondary'), accent: token('--accent') };
  }

  loop() {
    this.frameId = requestAnimationFrame(() => this.loop());
    const { width, height } = this.canvas;
    this.context.clearRect(0, 0, width, height);
    if (this.mode === 'wave') this.drawWave(width, height);
    else if (this.mode === 'radial') this.drawRadial(this.spectrumLevels(), width, height);
    else this.drawBars(this.spectrumLevels(), width, height);
  }

  /** Logarithmic grouping of FFT bins so that low frequencies are not squeezed into a few bars. */
  spectrumLevels() {
    this.analyser.getByteFrequencyData(this.frequencyData);
    const maxBin = this.frequencyData.length;
    const ratio = maxBin / MIN_FREQUENCY_BIN;
    return Array.from({ length: BAR_COUNT }, (_, i) => {
      const from = Math.floor(MIN_FREQUENCY_BIN * ratio ** (i / BAR_COUNT));
      const to = Math.max(from + 1, Math.floor(MIN_FREQUENCY_BIN * ratio ** ((i + 1) / BAR_COUNT)));
      let peak = 0;
      for (let bin = from; bin < to && bin < maxBin; bin += 1) peak = Math.max(peak, this.frequencyData[bin]);
      return peak / 255;
    });
  }

  drawBars(levels, width, height) {
    const ctx = this.context;
    const ratio = window.devicePixelRatio || 1;
    const left = width * 0.08;
    const area = width * 0.84;
    const slot = area / levels.length;
    const barWidth = Math.max(ratio, slot * 0.55);
    const baseline = height * 0.72;
    const maxHeight = height * 0.42;
    const capHeight = 2 * ratio;

    ctx.fillStyle = this.colors.secondary;
    ctx.fillRect(left, baseline + ratio, area, ratio);

    levels.forEach((level, i) => {
      const x = left + i * slot + (slot - barWidth) / 2;
      const barHeight = level * maxHeight;
      ctx.fillStyle = this.colors.primary;
      ctx.fillRect(x, baseline - barHeight, barWidth, barHeight);

      this.peaks[i] = Math.max(level, this.peaks[i] - PEAK_FALL_PER_FRAME);
      if (this.peaks[i] > MIN_VISIBLE_LEVEL) {
        ctx.fillStyle = this.colors.accent;
        ctx.fillRect(x, baseline - this.peaks[i] * maxHeight - capHeight * 2, barWidth, capHeight);
      }
    });
  }

  drawRadial(levels, width, height) {
    const ctx = this.context;
    const ratio = window.devicePixelRatio || 1;
    const cx = width / 2;
    const cy = height / 2;
    const radius = Math.min(width, height) * 0.2;
    const mirrored = [...levels, ...[...levels].reverse()];

    ctx.lineWidth = ratio;
    ctx.strokeStyle = this.colors.secondary;
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 6 * ratio, 0, Math.PI * 2);
    ctx.stroke();

    ctx.lineWidth = Math.max(ratio, ((2 * Math.PI * radius) / mirrored.length) * 0.45);
    ctx.strokeStyle = this.colors.primary;
    mirrored.forEach((level, i) => {
      if (level < MIN_VISIBLE_LEVEL) return;
      const angle = (i / mirrored.length) * Math.PI * 2 - Math.PI / 2;
      const length = level * radius * 0.85;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle) * radius, cy + Math.sin(angle) * radius);
      ctx.lineTo(cx + Math.cos(angle) * (radius + length), cy + Math.sin(angle) * (radius + length));
      ctx.stroke();
    });

    const energy = levels.reduce((sum, level) => sum + level, 0) / levels.length;
    ctx.fillStyle = this.colors.accent;
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * ratio + energy * radius * 0.35, 0, Math.PI * 2);
    ctx.fill();
  }

  drawWave(width, height) {
    const ctx = this.context;
    const ratio = window.devicePixelRatio || 1;
    this.analyser.getByteTimeDomainData(this.waveformData);
    const step = width / (this.waveformData.length - 1);

    ctx.lineWidth = ratio;
    ctx.strokeStyle = this.colors.secondary;
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    ctx.lineWidth = 2 * ratio;
    ctx.lineJoin = 'round';
    ctx.strokeStyle = this.colors.primary;
    ctx.beginPath();
    this.waveformData.forEach((sample, i) => {
      const y = height / 2 + ((sample - 128) / 128) * height * 0.3;
      if (i === 0) ctx.moveTo(0, y);
      else ctx.lineTo(i * step, y);
    });
    ctx.stroke();
  }
}
