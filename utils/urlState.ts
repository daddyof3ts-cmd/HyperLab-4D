import { SimulationParams } from '../types';
import { DEFAULT_PARAMS } from '../presets';

export function encodeParamsToHash(params: SimulationParams): string {
  try {
    const compact = [
      params.cx.toFixed(3),
      params.cy.toFixed(3),
      params.cz.toFixed(3),
      params.cw.toFixed(3),
      params.wSlice.toFixed(3),
      params.rotXW.toFixed(3),
      params.rotYW.toFixed(3),
      params.rotZW.toFixed(3),
      params.camYaw.toFixed(3),
      params.camPitch.toFixed(3),
      params.camDist.toFixed(3),
      params.iter.toFixed(2),
      params.spiral.toFixed(2),
      params.aoStrength.toFixed(2),
      params.glow.toFixed(2),
      String(params.palette),
      params.autoDrift ? '1' : '0',
      params.driftSpeed.toFixed(2),
    ].join(',');
    return `#s=${btoa(compact)}`;
  } catch {
    return '';
  }
}

export function decodeParamsFromHash(hash: string): SimulationParams | null {
  if (!hash || !hash.startsWith('#s=')) return null;
  try {
    const raw = atob(hash.slice(3));
    const parts = raw.split(',');
    if (parts.length < 16) return null;
    const nums = parts.map((v) => parseFloat(v));
    if (nums.some((n) => Number.isNaN(n))) return null;

    const paletteVal = Math.max(0, Math.min(3, Math.round(nums[15]))) as SimulationParams['palette'];

    return {
      cx: nums[0],
      cy: nums[1],
      cz: nums[2],
      cw: nums[3],
      wSlice: nums[4],
      rotXW: nums[5],
      rotYW: nums[6],
      rotZW: nums[7],
      camYaw: nums[8],
      camPitch: nums[9],
      camDist: nums[10],
      iter: nums[11],
      spiral: nums[12],
      aoStrength: nums[13],
      glow: nums[14],
      palette: paletteVal,
      autoDrift: parts[16] ? parts[16] === '1' : DEFAULT_PARAMS.autoDrift,
      driftSpeed: parts[17] !== undefined && !Number.isNaN(nums[17]) ? nums[17] : DEFAULT_PARAMS.driftSpeed,
    };
  } catch {
    return null;
  }
}

export function lerpParams(a: SimulationParams, b: SimulationParams, t: number): SimulationParams {
  // Smoothstep easing for cinematic transitions
  const u = t * t * (3 - 2 * t);
  const lerp = (x: number, y: number) => x + (y - x) * u;

  return {
    cx: lerp(a.cx, b.cx),
    cy: lerp(a.cy, b.cy),
    cz: lerp(a.cz, b.cz),
    cw: lerp(a.cw, b.cw),
    wSlice: lerp(a.wSlice, b.wSlice),
    rotXW: lerp(a.rotXW, b.rotXW),
    rotYW: lerp(a.rotYW, b.rotYW),
    rotZW: lerp(a.rotZW, b.rotZW),
    camYaw: lerp(a.camYaw, b.camYaw),
    camPitch: lerp(a.camPitch, b.camPitch),
    camDist: lerp(a.camDist, b.camDist),
    iter: lerp(a.iter, b.iter),
    spiral: lerp(a.spiral, b.spiral),
    aoStrength: lerp(a.aoStrength, b.aoStrength),
    glow: lerp(a.glow, b.glow),
    palette: u < 0.5 ? a.palette : b.palette,
    autoDrift: b.autoDrift,
    driftSpeed: lerp(a.driftSpeed, b.driftSpeed),
  };
}
