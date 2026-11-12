import { AudioMetrics } from '../types';

export class HyperAudioEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private dataArray: Uint8Array<ArrayBuffer> | null = null;
  private activeSourceNode: AudioNode | null = null;
  private micStream: MediaStream | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaElSource: MediaElementAudioSourceNode | null = null;
  private synthOscs: OscillatorNode[] = [];
  private synthGain: GainNode | null = null;

  private sourceType: AudioMetrics['source'] = 'none';
  private fileName: string | undefined;
  private sensitivity = 1.0;

  // Smoothed band values
  private smoothBass = 0;
  private smoothMid = 0;
  private smoothHigh = 0;
  private prevBass = 0;
  private beatPulse = 0;

  private ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.78;
      this.dataArray = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setSensitivity(val: number) {
    this.sensitivity = val;
  }

  public stop() {
    if (this.micStream) {
      this.micStream.getTracks().forEach((t) => t.stop());
      this.micStream = null;
    }
    if (this.audioEl) {
      this.audioEl.pause();
    }
    this.synthOscs.forEach((osc) => {
      try {
        osc.stop();
        osc.disconnect();
      } catch {
        // ignore already stopped
      }
    });
    this.synthOscs = [];
    if (this.synthGain) {
      this.synthGain.disconnect();
      this.synthGain = null;
    }
    if (this.activeSourceNode) {
      try {
        this.activeSourceNode.disconnect();
      } catch {
        // ignore
      }
      this.activeSourceNode = null;
    }
    this.sourceType = 'none';
    this.fileName = undefined;
    this.smoothBass = 0;
    this.smoothMid = 0;
    this.smoothHigh = 0;
    this.beatPulse = 0;
  }

  public async startMic(): Promise<void> {
    this.stop();
    this.ensureContext();
    if (!this.ctx || !this.analyser) return;

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.micStream = stream;
    const src = this.ctx.createMediaStreamSource(stream);
    src.connect(this.analyser);
    // Do NOT connect mic to ctx.destination to avoid feedback loop
    this.activeSourceNode = src;
    this.sourceType = 'mic';
  }

  public async startFile(file: File): Promise<void> {
    this.stop();
    this.ensureContext();
    if (!this.ctx || !this.analyser) return;

    const url = URL.createObjectURL(file);
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.loop = true;
      this.audioEl.crossOrigin = 'anonymous';
    }
    this.audioEl.src = url;

    if (!this.mediaElSource) {
      this.mediaElSource = this.ctx.createMediaElementSource(this.audioEl);
    }
    this.mediaElSource.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
    await this.audioEl.play();

    this.activeSourceNode = this.mediaElSource;
    this.sourceType = 'file';
    this.fileName = file.name;
  }

  public startSynthDrone(): void {
    this.stop();
    this.ensureContext();
    if (!this.ctx || !this.analyser) return;

    const master = this.ctx.createGain();
    master.gain.value = 0.22;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 620;
    filter.Q.value = 4.5;

    // Harmonic minor / fifth chord drone with LFO sweep
    const freqs = [55, 110, 164.81, 220, 293.66];
    const oscs: OscillatorNode[] = [];
    freqs.forEach((f, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = idx === 0 ? 'sawtooth' : idx % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = idx === 0 ? 0.36 : 0.16;
      osc.connect(g);
      g.connect(filter);
      osc.start();
      oscs.push(osc);
    });

    // Subtle rhythmic pulse LFO modulating filter cutoff
    const lfo = this.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 1.65; // ~99 BPM pulse
    const lfoGain = this.ctx.createGain();
    lfoGain.gain.value = 440;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
    oscs.push(lfo);

    filter.connect(master);
    master.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);

    this.synthOscs = oscs;
    this.synthGain = master;
    this.activeSourceNode = master;
    this.sourceType = 'synth';
    this.fileName = 'Harmonic 4D Pulse';
  }

  public sample(): AudioMetrics {
    if (this.sourceType === 'none' || !this.analyser || !this.dataArray) {
      return {
        active: false,
        source: 'none',
        bass: 0,
        mid: 0,
        high: 0,
        beat: 0,
        sensitivity: this.sensitivity,
      };
    }

    this.analyser.getByteFrequencyData(this.dataArray);
    const len = this.dataArray.length;

    const avgRange = (startIdx: number, endIdx: number) => {
      let sum = 0;
      const s = Math.max(0, startIdx);
      const e = Math.min(len, endIdx);
      if (e <= s) return 0;
      for (let i = s; i < e; i++) sum += this.dataArray![i];
      return sum / ((e - s) * 255);
    };

    const rawBass = Math.min(1, avgRange(0, 10) * this.sensitivity * 1.25);
    const rawMid = Math.min(1, avgRange(10, 48) * this.sensitivity * 1.35);
    const rawHigh = Math.min(1, avgRange(48, 140) * this.sensitivity * 1.55);

    this.smoothBass += (rawBass - this.smoothBass) * 0.25;
    this.smoothMid += (rawMid - this.smoothMid) * 0.22;
    this.smoothHigh += (rawHigh - this.smoothHigh) * 0.28;

    const delta = this.smoothBass - this.prevBass;
    if (delta > 0.08) {
      this.beatPulse = Math.min(1, this.beatPulse + delta * 3.0);
    } else {
      this.beatPulse *= 0.88;
    }
    this.prevBass = this.smoothBass;

    return {
      active: true,
      source: this.sourceType,
      fileName: this.fileName,
      bass: this.smoothBass,
      mid: this.smoothMid,
      high: this.smoothHigh,
      beat: this.beatPulse,
      sensitivity: this.sensitivity,
    };
  }
}
