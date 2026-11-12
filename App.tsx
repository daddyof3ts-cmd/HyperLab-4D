import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  Video,
  Share2,
  Eye,
  EyeOff,
  PanelLeftClose,
  PanelLeftOpen,
  Move3d,
  Orbit,
  Check,
} from 'lucide-react';
import WebGLView, { WebGLViewHandle } from './components/WebGLView';
import ControlPanel from './components/ControlPanel';
import TesseractGizmo from './components/TesseractGizmo';
import {
  AudioMetrics,
  KeyframeItem,
  PointerDragMode,
  PresetDefinition,
  SimulationParams,
} from './types';
import { DEFAULT_PARAMS, PRESETS } from './presets';
import { HyperAudioEngine } from './utils/audioEngine';
import { decodeParamsFromHash, encodeParamsToHash, lerpParams } from './utils/urlState';

const INITIAL_KEYFRAMES: KeyframeItem[] = [
  { id: 'kf-1', label: PRESETS[0].name, params: { ...PRESETS[0].params } },
  { id: 'kf-2', label: PRESETS[2].name, params: { ...PRESETS[2].params } },
  { id: 'kf-3', label: PRESETS[1].name, params: { ...PRESETS[1].params } },
];

const App: React.FC = () => {
  const [params, setParams] = useState<SimulationParams>(() => {
    const fromHash = decodeParamsFromHash(window.location.hash);
    if (fromHash) return fromHash;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    return prefersReduced ? { ...DEFAULT_PARAMS, autoDrift: false } : { ...DEFAULT_PARAMS };
  });

  const [activePresetId, setActivePresetId] = useState<string | null>(PRESETS[0].id);
  const [dragMode, setDragMode] = useState<PointerDragMode>('3d');
  const [uiVisible, setUiVisible] = useState(true);
  const [panelOpen, setPanelOpen] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [copiedLink, setCopiedLink] = useState(false);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // Morph Sequencer state
  const [keyframes, setKeyframes] = useState<KeyframeItem[]>(INITIAL_KEYFRAMES);
  const [morphPlaying, setMorphPlaying] = useState(false);
  const [morphDuration, setMorphDuration] = useState(4.5);

  // Live 4D drift offset for gizmo alignment
  const [driftAngle, setDriftAngle] = useState(0);
  const lastGizmoUpdateRef = useRef(0);

  // Audio state
  const audioEngineRef = useRef<HyperAudioEngine | null>(null);
  const audioMetricsRef = useRef<AudioMetrics>({
    active: false,
    source: 'none',
    bass: 0,
    mid: 0,
    high: 0,
    beat: 0,
    sensitivity: 1.0,
  });
  const [audioMetricsUI, setAudioMetricsUI] = useState<AudioMetrics>(audioMetricsRef.current);

  const webglRef = useRef<WebGLViewHandle>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<BlobPart[]>([]);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => {
      setNotice((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  // Poll audio analyzer on animation frame only while active
  useEffect(() => {
    let rafId = 0;
    const tick = () => {
      if (audioEngineRef.current) {
        const m = audioEngineRef.current.sample();
        audioMetricsRef.current = m;
        if (m.active) {
          setAudioMetricsUI(m);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      audioEngineRef.current?.stop();
    };
  }, []);

  // Keyframe Morph interpolation loop
  useEffect(() => {
    if (!morphPlaying || keyframes.length < 2) return;

    let rafId = 0;
    const startTime = performance.now();
    const segMs = morphDuration * 1000;

    const step = (now: number) => {
      const elapsed = now - startTime;
      const totalCycle = segMs * keyframes.length;
      const pos = (elapsed % totalCycle) / segMs;
      const idxA = Math.floor(pos) % keyframes.length;
      const idxB = (idxA + 1) % keyframes.length;
      const frac = pos - Math.floor(pos);

      setParams(lerpParams(keyframes[idxA].params, keyframes[idxB].params, frac));
      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [morphPlaying, keyframes, morphDuration]);

  const handleParamsChange = useCallback((next: SimulationParams) => {
    setMorphPlaying(false);
    setActivePresetId(null);
    setParams(next);
  }, []);

  const handleParamsDelta = useCallback((updater: (prev: SimulationParams) => SimulationParams) => {
    setParams((prev) => updater(prev));
  }, []);

  const handleDriftTimeUpdate = useCallback((driftTime: number) => {
    const now = performance.now();
    if (now - lastGizmoUpdateRef.current > 45) {
      lastGizmoUpdateRef.current = now;
      setDriftAngle(driftTime);
    }
  }, []);

  const handleSelectPreset = (preset: PresetDefinition) => {
    setMorphPlaying(false);
    setActivePresetId(preset.id);
    setParams({ ...preset.params });
  };

  const handleResetCamera = () => {
    setParams((prev) => ({
      ...prev,
      camYaw: DEFAULT_PARAMS.camYaw,
      camPitch: DEFAULT_PARAMS.camPitch,
      camDist: DEFAULT_PARAMS.camDist,
    }));
  };

  const getAudioEngine = () => {
    if (!audioEngineRef.current) {
      audioEngineRef.current = new HyperAudioEngine();
    }
    return audioEngineRef.current;
  };

  const handleStartMic = async () => {
    try {
      await getAudioEngine().startMic();
      const m = getAudioEngine().sample();
      audioMetricsRef.current = m;
      setAudioMetricsUI(m);
    } catch {
      showNotice('Microphone permission denied or unavailable.');
    }
  };

  const handleStartSynth = () => {
    getAudioEngine().startSynthDrone();
    const m = getAudioEngine().sample();
    audioMetricsRef.current = m;
    setAudioMetricsUI(m);
  };

  const handleUploadAudio = async (file: File) => {
    try {
      await getAudioEngine().startFile(file);
      const m = getAudioEngine().sample();
      audioMetricsRef.current = m;
      setAudioMetricsUI(m);
    } catch {
      showNotice('Could not decode the selected audio file.');
    }
  };

  const handleStopAudio = () => {
    audioEngineRef.current?.stop();
    const stopped: AudioMetrics = {
      active: false,
      source: 'none',
      bass: 0,
      mid: 0,
      high: 0,
      beat: 0,
      sensitivity: audioMetricsUI.sensitivity,
    };
    audioMetricsRef.current = stopped;
    setAudioMetricsUI(stopped);
  };

  const handleSensitivityChange = (val: number) => {
    getAudioEngine().setSensitivity(val);
    setAudioMetricsUI((prev) => ({ ...prev, sensitivity: val }));
  };

  const handleShareLink = async () => {
    const hash = encodeParamsToHash(params);
    if (!hash) return;
    window.history.replaceState(null, '', hash);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      window.setTimeout(() => setCopiedLink(false), 1800);
    } catch {
      showNotice('Share coordinates saved to page URL.');
    }
  };

  const handleToggleRecord = () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    const canvas = webglRef.current?.getCanvas();
    if (!canvas || typeof canvas.captureStream !== 'function' || typeof MediaRecorder === 'undefined') {
      showNotice('Video capture is not supported in this browser.');
      return;
    }

    try {
      const stream = canvas.captureStream(60);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : 'video/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      recordedChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `omniscope-4d-${Date.now()}.webm`;
        link.click();
        URL.revokeObjectURL(url);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      showNotice('Failed to initialize canvas video recorder.');
    }
  };

  const handleAddKeyframe = () => {
    const nextIdx = keyframes.length + 1;
    setKeyframes((prev) => [
      ...prev,
      {
        id: `kf-${Date.now()}`,
        label: `State ${nextIdx}`,
        params: { ...params },
      },
    ]);
  };

  const handleRemoveKeyframe = (id: string) => {
    setKeyframes((prev) => {
      const filtered = prev.filter((k) => k.id !== id);
      if (filtered.length < 2) setMorphPlaying(false);
      return filtered;
    });
  };

  const handleJumpKeyframe = (kf: KeyframeItem) => {
    setMorphPlaying(false);
    setActivePresetId(null);
    setParams({ ...kf.params });
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#05070b] text-slate-100 select-none">
      {/* Full-Viewport Interactive 4D WebGL Canvas */}
      <WebGLView
        ref={webglRef}
        params={params}
        dragMode={dragMode}
        audioMetricsRef={audioMetricsRef}
        onParamsDelta={handleParamsDelta}
        onDriftTimeUpdate={handleDriftTimeUpdate}
      />

      {/* Minimal Floating Top Bar */}
      <header
        className={`fixed top-3 left-3 right-3 z-30 flex items-center justify-between gap-4 transition-opacity duration-200 ${
          uiVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPanelOpen((v) => !v)}
            title={panelOpen ? 'Collapse Inspector' : 'Open Inspector'}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-[#090d14]/85 text-slate-200 backdrop-blur-md hover:border-cyan-400/40 hover:text-cyan-300 transition-colors cursor-pointer"
          >
            {panelOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
          </button>

          <div className="rounded-lg border border-white/10 bg-[#090d14]/85 px-3.5 py-2 backdrop-blur-md">
            <span className="text-sm font-semibold tracking-tight text-slate-100 whitespace-nowrap">
              OmniScope HyperLab
            </span>
          </div>
        </div>

        {/* Canvas Interaction Mode Switcher */}
        <div className="hidden sm:flex items-center gap-1 rounded-lg border border-white/10 bg-[#090d14]/85 p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={() => setDragMode('3d')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              dragMode === '3d'
                ? 'bg-cyan-500/20 text-cyan-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Orbit className="h-3.5 w-3.5" />
            <span>3D Orbit</span>
          </button>
          <button
            type="button"
            onClick={() => setDragMode('4d')}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              dragMode === '4d'
                ? 'bg-amber-500/20 text-amber-300'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Move3d className="h-3.5 w-3.5" />
            <span>4D Rotate</span>
          </button>
        </div>

        {/* Capture & Share Actions */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => webglRef.current?.captureSnapshot()}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#090d14]/85 px-3 text-xs font-medium text-slate-200 backdrop-blur-md hover:border-cyan-400/40 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Camera className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Snapshot</span>
          </button>

          <button
            type="button"
            onClick={handleToggleRecord}
            className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium backdrop-blur-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              recording
                ? 'border-rose-500/60 bg-rose-500/20 text-rose-200'
                : 'border-white/10 bg-[#090d14]/85 text-slate-200 hover:border-cyan-400/40 hover:text-cyan-300'
            }`}
          >
            <Video className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{recording ? 'Stop Recording' : 'Record'}</span>
          </button>

          <button
            type="button"
            onClick={handleShareLink}
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#090d14]/85 px-3 text-xs font-medium text-slate-200 backdrop-blur-md hover:border-cyan-400/40 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Share2 className="h-3.5 w-3.5" />}
            <span className="hidden md:inline">{copiedLink ? 'Copied' : 'Share'}</span>
          </button>

          <button
            type="button"
            onClick={() => setUiVisible(false)}
            title="Hide Interface"
            className="flex h-9 items-center gap-1.5 rounded-lg border border-white/10 bg-[#090d14]/85 px-3 text-xs font-medium text-slate-200 backdrop-blur-md hover:border-white/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <EyeOff className="h-3.5 w-3.5" />
            <span className="hidden lg:inline">Hide UI</span>
          </button>
        </div>
      </header>

      {/* Restore UI button when hidden */}
      {!uiVisible && (
        <button
          type="button"
          onClick={() => setUiVisible(true)}
          className="fixed top-3 right-3 z-40 flex h-9 items-center gap-1.5 rounded-lg border border-white/15 bg-[#090d14]/75 px-3 text-xs font-medium text-slate-200 backdrop-blur-md hover:border-cyan-400/50 transition-colors cursor-pointer"
        >
          <Eye className="h-3.5 w-3.5" />
          <span>Show UI</span>
        </button>
      )}

      {/* Left Scientific Inspector */}
      <div
        className={`fixed top-14 left-3 z-20 transition-all duration-200 ${
          uiVisible && panelOpen
            ? 'translate-x-0 opacity-100'
            : '-translate-x-4 pointer-events-none opacity-0'
        }`}
      >
        <ControlPanel
          params={params}
          activePresetId={activePresetId}
          audioMetrics={audioMetricsUI}
          keyframes={keyframes}
          morphPlaying={morphPlaying}
          morphDuration={morphDuration}
          onChange={handleParamsChange}
          onSelectPreset={handleSelectPreset}
          onResetCamera={handleResetCamera}
          onStartMic={handleStartMic}
          onStartSynth={handleStartSynth}
          onUploadAudio={handleUploadAudio}
          onStopAudio={handleStopAudio}
          onSensitivityChange={handleSensitivityChange}
          onAddKeyframe={handleAddKeyframe}
          onRemoveKeyframe={handleRemoveKeyframe}
          onJumpKeyframe={handleJumpKeyframe}
          onToggleMorph={() => setMorphPlaying((p) => !p)}
          onMorphDurationChange={setMorphDuration}
        />
      </div>

      {/* Bottom-Right 4D Orientation Gizmo & Gesture Hint */}
      <div
        className={`fixed right-3 bottom-3 z-20 hidden sm:flex flex-col items-end gap-2 transition-opacity duration-200 ${
          uiVisible ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
      >
        <TesseractGizmo
          rotXW={params.rotXW + driftAngle * 0.35}
          rotYW={params.rotYW + driftAngle * 0.22}
          rotZW={params.rotZW}
          camYaw={params.camYaw}
          camPitch={params.camPitch}
          wSlice={params.wSlice}
        />
        <div className="pointer-events-none rounded-md border border-white/10 bg-[#090d14]/75 px-2.5 py-1 text-[11px] text-slate-400 backdrop-blur-md">
          Drag: 3D Orbit · Shift+Drag: 4D XW/YW · Scroll: Zoom
        </div>
      </div>

      {/* Transient Inline Notice */}
      {notice && (
        <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-amber-400/40 bg-[#090d14]/95 px-4 py-2 text-xs text-amber-200 shadow-xl backdrop-blur-md">
          {notice}
        </div>
      )}
    </div>
  );
};

export default App;