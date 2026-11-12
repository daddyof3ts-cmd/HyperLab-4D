import React, { useEffect, useRef } from 'react';

interface ParameterRadarProps {
  cx: number;
  cy: number;
  cz: number;
  cw: number;
  onSelect: (nextCx: number, nextCy: number) => void;
}

const SIZE = 160;
const RANGE = 1.2;

const ParameterRadar: React.FC<ParameterRadarProps> = ({ cx, cy, cz, cw, onSelect }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const draggingRef = useRef(false);

  // Render a fast 2D quaternion cross-section map of (cx, cy) at fixed (cz, cw)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = ctx.createImageData(SIZE, SIZE);
    const data = img.data;
    const maxIter = 18;

    for (let py = 0; py < SIZE; py++) {
      const qy = RANGE - (py / (SIZE - 1)) * (2 * RANGE);
      for (let px = 0; px < SIZE; px++) {
        const qx = -RANGE + (px / (SIZE - 1)) * (2 * RANGE);

        let zx = 0;
        let zy = 0;
        let zz = 0;
        let zw = 0;
        let iter = 0;

        while (iter < maxIter) {
          const r2 = zx * zx + zy * zy + zz * zz + zw * zw;
          if (r2 > 4.0) break;

          const nx = zx * zx - zy * zy - zz * zz - zw * zw + qx;
          const ny = 2 * zx * zy + qy;
          const nz = 2 * zx * zz + cz;
          const nw = 2 * zx * zw + cw;

          zx = nx;
          zy = ny;
          zz = nz;
          zw = nw;
          iter++;
        }

        const idx = (py * SIZE + px) * 4;
        if (iter === maxIter) {
          // Inside boundary: deep slate core
          data[idx] = 12;
          data[idx + 1] = 24;
          data[idx + 2] = 36;
          data[idx + 3] = 255;
        } else {
          // Boundary halo: sweet-spot glow along fractal edge
          const ratio = iter / maxIter;
          const glow = Math.pow(ratio, 1.35);
          data[idx] = Math.round(8 + glow * 26);
          data[idx + 1] = Math.round(18 + glow * 185);
          data[idx + 2] = Math.round(30 + glow * 215);
          data[idx + 3] = 255;
        }
      }
    }

    ctx.putImageData(img, 0, 0);
  }, [cz, cw]);

  const updateFromPointer = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
    const nextCx = -RANGE + nx * (2 * RANGE);
    const nextCy = RANGE - ny * (2 * RANGE);
    onSelect(Number(nextCx.toFixed(3)), Number(nextCy.toFixed(3)));
  };

  const markerX = Math.max(0, Math.min(100, ((cx + RANGE) / (2 * RANGE)) * 100));
  const markerY = Math.max(0, Math.min(100, ((RANGE - cy) / (2 * RANGE)) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-slate-200">Parameter Radar (Cx, Cy)</span>
        <span className="font-mono tabular-nums text-[11px] text-slate-400">
          {cx.toFixed(2)}, {cy.toFixed(2)}
        </span>
      </div>
      <div className="relative mx-auto aspect-square w-full max-w-[200px] overflow-hidden rounded-lg border border-white/15 bg-[#05070b]">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          onPointerDown={(e) => {
            draggingRef.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            updateFromPointer(e);
          }}
          onPointerMove={(e) => {
            if (draggingRef.current) updateFromPointer(e);
          }}
          onPointerUp={(e) => {
            draggingRef.current = false;
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              // ignore
            }
          }}
          className="block h-full w-full cursor-crosshair touch-none"
        />
        {/* Crosshair guides */}
        <div
          className="pointer-events-none absolute top-0 bottom-0 w-px bg-cyan-400/40"
          style={{ left: `${markerX}%` }}
        />
        <div
          className="pointer-events-none absolute left-0 right-0 h-px bg-cyan-400/40"
          style={{ top: `${markerY}%` }}
        />
        <div
          className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-300 bg-cyan-400/30 shadow-[0_0_8px_rgba(6,182,212,0.8)]"
          style={{ left: `${markerX}%`, top: `${markerY}%` }}
        />
      </div>
      <p className="text-[11px] leading-relaxed text-slate-400">
        Click or drag along the glowing cyan boundary to discover intricate 4D fractal islands.
      </p>
    </div>
  );
};

export default ParameterRadar;
