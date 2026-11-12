export type PaletteMode = 0 | 1 | 2 | 3;

export type PointerDragMode = '3d' | '4d';

export interface SimulationParams {
  // 4D Julia constant c = (cx, cy, cz, cw)
  cx: number;
  cy: number;
  cz: number;
  cw: number;

  // 4D Hyperplane & 6-plane rotations (XW, YW, ZW)
  wSlice: number;
  rotXW: number;
  rotYW: number;
  rotZW: number;

  // 3D Orbit Camera
  camYaw: number;
  camPitch: number;
  camDist: number;

  // Fractal & Optical properties
  iter: number;       // 3 .. 14
  spiral: number;     // 0 .. 1 (4D temporal torque & chromatic dispersion)
  aoStrength: number; // 0 .. 1
  glow: number;       // 0 .. 1.5
  palette: PaletteMode;
  autoDrift: boolean;
  driftSpeed: number; // 0 .. 1.5
}

export interface PresetDefinition {
  id: string;
  name: string;
  subtitle: string;
  params: SimulationParams;
}

export interface KeyframeItem {
  id: string;
  label: string;
  params: SimulationParams;
}

export interface AudioMetrics {
  active: boolean;
  source: 'none' | 'mic' | 'file' | 'synth';
  fileName?: string;
  bass: number;
  mid: number;
  high: number;
  beat: number;
  sensitivity: number;
}