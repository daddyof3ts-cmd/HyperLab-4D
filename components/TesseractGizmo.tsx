import React, { useMemo } from 'react';

interface TesseractGizmoProps {
  rotXW: number;
  rotYW: number;
  rotZW: number;
  camYaw: number;
  camPitch: number;
  wSlice: number;
}

// 16 vertices of a 4D unit hypercube
const VERTICES_4D: [number, number, number, number][] = [];
for (let i = 0; i < 16; i++) {
  VERTICES_4D.push([
    i & 1 ? 1 : -1,
    i & 2 ? 1 : -1,
    i & 4 ? 1 : -1,
    i & 8 ? 1 : -1,
  ]);
}

// 32 edges connecting vertices differing by 1 bit
const EDGES: [number, number, boolean][] = [];
for (let i = 0; i < 16; i++) {
  for (let bit = 0; bit < 4; bit++) {
    const j = i ^ (1 << bit);
    if (i < j) {
      EDGES.push([i, j, bit === 3]); // bit===3 marks W-axis edges
    }
  }
}

const TesseractGizmo: React.FC<TesseractGizmoProps> = ({
  rotXW,
  rotYW,
  rotZW,
  camYaw,
  camPitch,
  wSlice,
}) => {
  const projected = useMemo(() => {
    const cosXW = Math.cos(rotXW);
    const sinXW = Math.sin(rotXW);
    const cosYW = Math.cos(rotYW);
    const sinYW = Math.sin(rotYW);
    const cosZW = Math.cos(rotZW);
    const sinZW = Math.sin(rotZW);

    const cosYaw = Math.cos(-camYaw);
    const sinYaw = Math.sin(-camYaw);
    const cosPitch = Math.cos(-camPitch);
    const sinPitch = Math.sin(-camPitch);

    return VERTICES_4D.map(([vx, vy, vz, vw]) => {
      // 4D Plane Rotations
      let x = vx * cosXW - vw * sinXW;
      let w = vx * sinXW + vw * cosXW;

      let y = vy * cosYW - w * sinYW;
      w = vy * sinYW + w * cosYW;

      let z = vz * cosZW - w * sinZW;
      w = vz * sinZW + w * cosZW;

      // Stereographic 4D -> 3D projection
      const dist4 = 3.2;
      const factor4 = 1.35 / (dist4 - w);
      const x3 = x * factor4;
      const y3 = y * factor4;
      const z3 = z * factor4;

      // 3D Camera Orbit alignment
      const rx = x3 * cosYaw - z3 * sinYaw;
      const rz = x3 * sinYaw + z3 * cosYaw;

      const ry = y3 * cosPitch - rz * sinPitch;
      const rz2 = y3 * sinPitch + rz * cosPitch;

      const factor3 = 44 / (3.4 - rz2);
      return {
        x: 52 + rx * factor3,
        y: 52 - ry * factor3,
        w,
      };
    });
  }, [rotXW, rotYW, rotZW, camYaw, camPitch]);

  return (
    <div className="pointer-events-none select-none rounded-xl border border-white/10 bg-[#090d14]/80 p-3 backdrop-blur-md">
      <div className="mb-1.5 flex items-center justify-between gap-4 text-[11px] font-medium text-slate-300">
        <span>4D Orientation</span>
        <span className="font-mono tabular-nums text-cyan-400">w={wSlice.toFixed(2)}</span>
      </div>
      <svg viewBox="0 0 104 104" className="h-[88px] w-[88px] mx-auto block overflow-visible">
        {EDGES.map(([a, b, isWAxis], idx) => {
          const pa = projected[a];
          const pb = projected[b];
          return (
            <line
              key={idx}
              x1={pa.x}
              y1={pa.y}
              x2={pb.x}
              y2={pb.y}
              stroke={isWAxis ? '#f59e0b' : '#06b6d4'}
              strokeOpacity={isWAxis ? 0.65 : 0.45}
              strokeWidth={isWAxis ? 1.1 : 1.0}
            />
          );
        })}
        {projected.map((pt, idx) => (
          <circle
            key={idx}
            cx={pt.x}
            cy={pt.y}
            r={pt.w > 0 ? 1.8 : 1.2}
            fill={pt.w > 0 ? '#22d3ee' : '#64748b'}
          />
        ))}
      </svg>
      <div className="mt-1.5 grid grid-cols-3 gap-1.5 text-center font-mono tabular-nums text-[10px] text-slate-400">
        <div>XW {rotXW.toFixed(1)}</div>
        <div>YW {rotYW.toFixed(1)}</div>
        <div>ZW {rotZW.toFixed(1)}</div>
      </div>
    </div>
  );
};

export default TesseractGizmo;
