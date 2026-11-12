import React, { useRef, useState } from 'react';
import {
  Sliders,
  Compass,
  Sparkles,
  AudioWaveform,
  Film,
  Plus,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  Mic,
  Upload,
  Square,
  Radio,
} from 'lucide-react';
import {
  AudioMetrics,
  KeyframeItem,
  PaletteMode,
  PresetDefinition,
  SimulationParams,
} from '../types';
import { PRESETS } from '../presets';
import ParameterRadar from './ParameterRadar';

type InspectorTab = 'explore' | 'space' | 'optics' | 'audio' | 'morph';

interface ControlPanelProps {
  params: SimulationParams;
  activePresetId: string | null;
  audioMetrics: AudioMetrics;
  keyframes: KeyframeItem[];
  morphPlaying: boolean;
  morphDuration: number;
  onChange: (next: SimulationParams) => void;
  onSelectPreset: (preset: PresetDefinition) => void;
  onResetCamera: () => void;
  onStartMic: () => void;
  onStartSynth: () => void;
  onUploadAudio: (file: File) => void;
  onStopAudio: () => void;
  onSensitivityChange: (val: number) => void;
  onAddKeyframe: () => void;
  onRemoveKeyframe: (id: string) => void;
  onJumpKeyframe: (kf: KeyframeItem) => void;
  onToggleMorph: () => void;
  onMorphDurationChange: (sec: number) => void;
}

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  precision?: number;
  onChange: (val: number) => void;
}

const SliderRow: React.FC<SliderRowProps> = ({
  label,
  value,
  min,
  max,
  step,
  unit = '',
  precision = 2,
  onChange,
}) => (
  <div className="space-y-1.5">
    <div className="flex items-center justify-between text-xs">
      <label className="font-medium text-slate-300">{label}</label>
      <span className="font-mono tabular-nums text-[11px] text-cyan-400">
        {value.toFixed(precision)}
        {unit}
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      className="hyper-slider w-full"
    />
  </div>
);

const PALETTES: { id: PaletteMode; name: string; desc: string; swatch: string }[] = [
  { id: 0, name: 'Dichroic Obsidian', desc: 'Deep cyan & amber refraction', swatch: 'from-slate-900 via-cyan-500 to-amber-400' },
  { id: 1, name: 'Plasma Corona', desc: 'Solar orange & violet flare', swatch: 'from-purple-900 via-rose-500 to-amber-300' },
  { id: 2, name: 'Bioluminescent Reef', desc: 'Abyssal emerald & ice', swatch: 'from-teal-950 via-emerald-400 to-cyan-200' },
  { id: 3, name: 'Chromatic Silver', desc: 'Machined platinum specimen', swatch: 'from-slate-800 via-slate-300 to-sky-200' },
];

const ControlPanel: React.FC<ControlPanelProps> = ({
  params,
  activePresetId,
  audioMetrics,
  keyframes,
  morphPlaying,
  morphDuration,
  onChange,
  onSelectPreset,
  onResetCamera,
  onStartMic,
  onStartSynth,
  onUploadAudio,
  onStopAudio,
  onSensitivityChange,
  onAddKeyframe,
  onRemoveKeyframe,
  onJumpKeyframe,
  onToggleMorph,
  onMorphDurationChange,
}) => {
  const [tab, setTab] = useState<InspectorTab>('explore');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateParam = <K extends keyof SimulationParams>(key: K, val: SimulationParams[K]) => {
    onChange({
      ...params,
      [key]: val,
    });
  };

  const tabs: { id: InspectorTab; label: string; icon: React.ReactNode }[] = [
    { id: 'explore', label: 'Explore', icon: <Sliders className="h-3.5 w-3.5" /> },
    { id: 'space', label: '4D Space', icon: <Compass className="h-3.5 w-3.5" /> },
    { id: 'optics', label: 'Optics', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { id: 'audio', label: 'Audio', icon: <AudioWaveform className="h-3.5 w-3.5" /> },
    { id: 'morph', label: 'Morph', icon: <Film className="h-3.5 w-3.5" /> },
  ];

  return (
    <aside className="flex max-h-[calc(100vh-88px)] w-[332px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-xl border border-white/10 bg-[#090d14]/88 shadow-2xl backdrop-blur-md">
      {/* Segmented Tab Strip */}
      <div className="grid grid-cols-5 border-b border-white/10 bg-black/25 p-1">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                active
                  ? 'bg-cyan-500/15 text-cyan-300'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Scrollable Inspector Body */}
      <div className="hyper-scroll flex-1 space-y-5 overflow-y-auto p-4">
        {tab === 'explore' && (
          <>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-wide text-slate-200">
                  Curated 4D Topologies
                </span>
                <span className="text-[11px] text-slate-400">{PRESETS.length} specimens</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => {
                  const selected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => onSelectPreset(preset)}
                      className={`rounded-lg border px-2.5 py-2 text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-cyan-400/60 bg-cyan-500/12 text-slate-100'
                          : 'border-white/10 bg-white/[0.02] text-slate-300 hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <div className="truncate text-xs font-medium">{preset.name}</div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-400">
                        {preset.subtitle}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-white/10 pt-4">
              <ParameterRadar
                cx={params.cx}
                cy={params.cy}
                cz={params.cz}
                cw={params.cw}
                onSelect={(nextCx, nextCy) =>
                  onChange({
                    ...params,
                    cx: nextCx,
                    cy: nextCy,
                  })
                }
              />
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  Quaternion Constant c
                </span>
                <span className="font-mono tabular-nums text-[10px] text-slate-400">
                  zₙ₊₁ = zₙ² + c
                </span>
              </div>
              <SliderRow
                label="Real (Cx)"
                value={params.cx}
                min={-1.2}
                max={1.2}
                step={0.005}
                precision={3}
                onChange={(v) => updateParam('cx', v)}
              />
              <SliderRow
                label="Imaginary i (Cy)"
                value={params.cy}
                min={-1.2}
                max={1.2}
                step={0.005}
                precision={3}
                onChange={(v) => updateParam('cy', v)}
              />
              <SliderRow
                label="Imaginary j (Cz)"
                value={params.cz}
                min={-1.0}
                max={1.0}
                step={0.005}
                precision={3}
                onChange={(v) => updateParam('cz', v)}
              />
              <SliderRow
                label="Imaginary k (Cw)"
                value={params.cw}
                min={-1.0}
                max={1.0}
                step={0.005}
                precision={3}
                onChange={(v) => updateParam('cw', v)}
              />
            </div>
          </>
        )}

        {tab === 'space' && (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">
                  4th-Dimension Hyperplane
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      ...params,
                      wSlice: 0,
                      rotXW: 0,
                      rotYW: 0,
                      rotZW: 0,
                    })
                  }
                  className="text-[11px] font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap shrink-0"
                >
                  Zero 4D Axes
                </button>
              </div>
              <SliderRow
                label="W-Slice Offset"
                value={params.wSlice}
                min={-0.9}
                max={0.9}
                step={0.01}
                onChange={(v) => updateParam('wSlice', v)}
              />
              <SliderRow
                label="XW Rotation"
                value={params.rotXW}
                min={-3.14}
                max={3.14}
                step={0.01}
                unit=" rad"
                onChange={(v) => updateParam('rotXW', v)}
              />
              <SliderRow
                label="YW Rotation"
                value={params.rotYW}
                min={-3.14}
                max={3.14}
                step={0.01}
                unit=" rad"
                onChange={(v) => updateParam('rotYW', v)}
              />
              <SliderRow
                label="ZW Rotation"
                value={params.rotZW}
                min={-3.14}
                max={3.14}
                step={0.01}
                unit=" rad"
                onChange={(v) => updateParam('rotZW', v)}
              />
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-200">3D Orbit Camera</span>
                <button
                  type="button"
                  onClick={onResetCamera}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-cyan-400 hover:text-cyan-300 cursor-pointer whitespace-nowrap shrink-0"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>Reset View</span>
                </button>
              </div>
              <SliderRow
                label="Camera Distance"
                value={params.camDist}
                min={1.25}
                max={5.0}
                step={0.02}
                onChange={(v) => updateParam('camDist', v)}
              />
              <SliderRow
                label="Azimuth (Yaw)"
                value={params.camYaw}
                min={-3.14}
                max={3.14}
                step={0.01}
                unit=" rad"
                onChange={(v) => updateParam('camYaw', v)}
              />
              <SliderRow
                label="Elevation (Pitch)"
                value={params.camPitch}
                min={-1.45}
                max={1.45}
                step={0.01}
                unit=" rad"
                onChange={(v) => updateParam('camPitch', v)}
              />
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-200">Continuous 4D Drift</span>
                <button
                  type="button"
                  onClick={() => updateParam('autoDrift', !params.autoDrift)}
                  className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    params.autoDrift
                      ? 'bg-cyan-500/20 text-cyan-300'
                      : 'bg-white/5 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {params.autoDrift ? 'Running' : 'Paused'}
                </button>
              </div>
              <SliderRow
                label="Drift Velocity"
                value={params.driftSpeed}
                min={0.0}
                max={1.5}
                step={0.02}
                unit="×"
                onChange={(v) => updateParam('driftSpeed', v)}
              />
            </div>
          </>
        )}

        {tab === 'optics' && (
          <>
            <div className="space-y-2.5">
              <span className="block text-xs font-semibold text-slate-200">
                Surface Material & Orbit Trap
              </span>
              <div className="space-y-2">
                {PALETTES.map((pal) => {
                  const selected = params.palette === pal.id;
                  return (
                    <button
                      key={pal.id}
                      type="button"
                      onClick={() => updateParam('palette', pal.id)}
                      className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors cursor-pointer ${
                        selected
                          ? 'border-cyan-400/60 bg-cyan-500/12'
                          : 'border-white/10 bg-white/[0.02] hover:border-white/20'
                      }`}
                    >
                      <span
                        className={`h-6 w-6 shrink-0 rounded-md bg-gradient-to-br ${pal.swatch} border border-white/20`}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-xs font-medium text-slate-100">
                          {pal.name}
                        </div>
                        <div className="truncate text-[11px] text-slate-400">{pal.desc}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3 border-t border-white/10 pt-4">
              <span className="block text-xs font-semibold text-slate-200">
                Raymarcher & Dispersion
              </span>
              <SliderRow
                label="Fractal Recursion"
                value={params.iter}
                min={3}
                max={14}
                step={0.1}
                precision={1}
                onChange={(v) => updateParam('iter', v)}
              />
              <SliderRow
                label="Torque & Dispersion"
                value={params.spiral}
                min={0}
                max={1}
                step={0.01}
                onChange={(v) => updateParam('spiral', v)}
              />
              <SliderRow
                label="Ambient Occlusion"
                value={params.aoStrength}
                min={0}
                max={1}
                step={0.02}
                onChange={(v) => updateParam('aoStrength', v)}
              />
              <SliderRow
                label="Corona Glow"
                value={params.glow}
                min={0}
                max={1.5}
                step={0.02}
                onChange={(v) => updateParam('glow', v)}
              />
            </div>
          </>
        )}

        {tab === 'audio' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-slate-200">
                Synesthetic Audio Engine
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Drive 4D slice breathing, spiral torque, and prismatic dispersion in real time from live frequency bands.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={audioMetrics.source === 'synth' ? onStopAudio : onStartSynth}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  audioMetrics.source === 'synth'
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Radio className="h-4 w-4 text-cyan-400" />
                  <span>Harmonic 4D Pulse (Built-in Synth)</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {audioMetrics.source === 'synth' ? 'Stop' : 'Start'}
                </span>
              </button>

              <button
                type="button"
                onClick={audioMetrics.source === 'mic' ? onStopAudio : onStartMic}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  audioMetrics.source === 'mic'
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Mic className="h-4 w-4 text-amber-400" />
                  <span>Live Microphone Input</span>
                </span>
                <span className="text-[11px] text-slate-400">
                  {audioMetrics.source === 'mic' ? 'Stop' : 'Connect'}
                </span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors cursor-pointer ${
                  audioMetrics.source === 'file'
                    ? 'border-cyan-400/60 bg-cyan-500/15 text-cyan-200'
                    : 'border-white/10 bg-white/[0.03] text-slate-200 hover:bg-white/[0.07]'
                }`}
              >
                <span className="flex min-w-0 items-center gap-2">
                  <Upload className="h-4 w-4 shrink-0 text-emerald-400" />
                  <span className="truncate">
                    {audioMetrics.source === 'file' && audioMetrics.fileName
                      ? audioMetrics.fileName
                      : 'Load Audio File (MP3 / WAV)'}
                  </span>
                </span>
                <span className="ml-2 shrink-0 text-[11px] text-slate-400">Browse</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onUploadAudio(f);
                  e.target.value = '';
                }}
              />
            </div>

            {audioMetrics.active && (
              <button
                type="button"
                onClick={onStopAudio}
                className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 py-2 text-xs font-medium text-rose-300 hover:bg-rose-500/20 transition-colors cursor-pointer"
              >
                <Square className="h-3.5 w-3.5" />
                <span>Disconnect Audio Source</span>
              </button>
            )}

            <div className="space-y-3 border-t border-white/10 pt-4">
              <SliderRow
                label="Input Sensitivity"
                value={audioMetrics.sensitivity}
                min={0.3}
                max={2.5}
                step={0.05}
                unit="×"
                onChange={onSensitivityChange}
              />

              <div className="space-y-2 pt-1">
                {[
                  { label: 'Sub-Bass (Zoom / W-Pulse)', val: audioMetrics.bass, color: 'bg-cyan-400' },
                  { label: 'Midrange (4D Torque)', val: audioMetrics.mid, color: 'bg-amber-400' },
                  { label: 'Highs (Prism Dispersion)', val: audioMetrics.high, color: 'bg-emerald-400' },
                ].map((band) => (
                  <div key={band.label} className="space-y-1">
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>{band.label}</span>
                      <span className="font-mono tabular-nums text-slate-200">
                        {Math.round(band.val * 100)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full ${band.color} transition-[width] duration-75`}
                        style={{ width: `${Math.min(100, band.val * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'morph' && (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-slate-200">
                Keyframe Morph Sequencer
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">
                Bookmark multiple 4D coordinates and interpolate smoothly between them in a continuous loop.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onAddKeyframe}
                disabled={keyframes.length >= 8}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-100 hover:bg-white/10 disabled:opacity-40 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5 text-cyan-400" />
                <span>Add Keyframe</span>
              </button>
              <button
                type="button"
                onClick={onToggleMorph}
                disabled={keyframes.length < 2}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap disabled:opacity-40 ${
                  morphPlaying
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-400/40'
                    : 'bg-cyan-500 text-slate-950 hover:bg-cyan-400'
                }`}
              >
                {morphPlaying ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                <span>{morphPlaying ? 'Pause Morph' : 'Play Morph'}</span>
              </button>
            </div>

            <SliderRow
              label="Transition Duration"
              value={morphDuration}
              min={1.5}
              max={12}
              step={0.5}
              unit="s"
              precision={1}
              onChange={onMorphDurationChange}
            />

            <div className="space-y-2 border-t border-white/10 pt-3">
              {keyframes.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-400">
                  No keyframes saved yet.
                </div>
              ) : (
                keyframes.map((kf, idx) => (
                  <div
                    key={kf.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2"
                  >
                    <button
                      type="button"
                      onClick={() => onJumpKeyframe(kf)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="truncate text-xs font-medium text-slate-200">
                        {idx + 1}. {kf.label}
                      </div>
                      <div className="font-mono tabular-nums text-[10px] text-slate-400">
                        c=({kf.params.cx.toFixed(2)}, {kf.params.cy.toFixed(2)}) · w={kf.params.wSlice.toFixed(2)}
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemoveKeyframe(kf.id)}
                      aria-label={`Remove ${kf.label}`}
                      className="rounded p-1.5 text-slate-400 hover:bg-white/10 hover:text-rose-400 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </aside>
  );
};

export default ControlPanel;