import React, { useRef, useEffect, useState, useImperativeHandle, forwardRef } from 'react';
import { AudioMetrics, PointerDragMode, SimulationParams } from '../types';
import { VERTEX_SHADER_SOURCE, FRAGMENT_SHADER_SOURCE } from '../constants';

export interface WebGLViewHandle {
  captureSnapshot: () => void;
  getCanvas: () => HTMLCanvasElement | null;
}

interface WebGLViewProps {
  params: SimulationParams;
  dragMode: PointerDragMode;
  audioMetricsRef: React.MutableRefObject<AudioMetrics>;
  onParamsDelta: (updater: (prev: SimulationParams) => SimulationParams) => void;
  onDriftTimeUpdate?: (driftTime: number) => void;
}

const WebGLView = forwardRef<WebGLViewHandle, WebGLViewProps>(
  ({ params, dragMode, audioMetricsRef, onParamsDelta, onDriftTimeUpdate }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const paramsRef = useRef<SimulationParams>(params);
    const dragModeRef = useRef<PointerDragMode>(dragMode);
    const snapshotPendingRef = useRef(false);
    const driftAccumRef = useRef(0);
    const lastFrameTimeRef = useRef<number | null>(null);

    const pointerRef = useRef<{
      active: boolean;
      lastX: number;
      lastY: number;
      shiftKey: boolean;
    }>({ active: false, lastX: 0, lastY: 0, shiftKey: false });

    const [contextLost, setContextLost] = useState(false);
    const [webglUnavailable, setWebglUnavailable] = useState(false);

    useEffect(() => {
      paramsRef.current = params;
    }, [params]);

    useEffect(() => {
      dragModeRef.current = dragMode;
    }, [dragMode]);

    useImperativeHandle(ref, () => ({
      captureSnapshot: () => {
        snapshotPendingRef.current = true;
      },
      getCanvas: () => canvasRef.current,
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      let gl: WebGLRenderingContext | null = null;
      let program: WebGLProgram | null = null;
      let vs: WebGLShader | null = null;
      let fs: WebGLShader | null = null;
      let buffer: WebGLBuffer | null = null;
      let animationFrameId = 0;

      const initWebGL = () => {
        gl = canvas.getContext('webgl', {
          powerPreference: 'high-performance',
          alpha: false,
          antialias: false,
        });

        if (!gl) {
          setWebglUnavailable(true);
          return false;
        }

        const createShader = (ctx: WebGLRenderingContext, type: number, source: string) => {
          const shader = ctx.createShader(type);
          if (!shader) return null;
          ctx.shaderSource(shader, source);
          ctx.compileShader(shader);
          if (!ctx.getShaderParameter(shader, ctx.COMPILE_STATUS)) {
            console.error('Shader compile error:', ctx.getShaderInfoLog(shader));
            ctx.deleteShader(shader);
            return null;
          }
          return shader;
        };

        vs = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE);
        fs = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE);
        if (!vs || !fs) {
          setWebglUnavailable(true);
          return false;
        }

        program = gl.createProgram();
        if (!program) return false;

        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
          console.error('Program link error:', gl.getProgramInfoLog(program));
          return false;
        }
        gl.useProgram(program);

        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW
        );

        const positionLocation = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(positionLocation);
        gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

        return true;
      };

      if (!initWebGL() || !gl || !program) return;

      const locations = {
        resolution: gl.getUniformLocation(program, 'uResolution'),
        time: gl.getUniformLocation(program, 'uTime'),
        juliaC: gl.getUniformLocation(program, 'uJuliaC'),
        wSlice: gl.getUniformLocation(program, 'uWSlice'),
        rotXW: gl.getUniformLocation(program, 'uRotXW'),
        rotYW: gl.getUniformLocation(program, 'uRotYW'),
        rotZW: gl.getUniformLocation(program, 'uRotZW'),
        camYaw: gl.getUniformLocation(program, 'uCamYaw'),
        camPitch: gl.getUniformLocation(program, 'uCamPitch'),
        camDist: gl.getUniformLocation(program, 'uCamDist'),
        iter: gl.getUniformLocation(program, 'uIter'),
        spiral: gl.getUniformLocation(program, 'uSpiral'),
        aoStrength: gl.getUniformLocation(program, 'uAOStrength'),
        glow: gl.getUniformLocation(program, 'uGlow'),
        palette: gl.getUniformLocation(program, 'uPalette'),
        driftTime: gl.getUniformLocation(program, 'uDriftTime'),
        audioBass: gl.getUniformLocation(program, 'uAudioBass'),
        audioMid: gl.getUniformLocation(program, 'uAudioMid'),
        audioHigh: gl.getUniformLocation(program, 'uAudioHigh'),
      };

      const resize = () => {
        if (!canvas || !gl) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        canvas.width = Math.max(1, Math.floor(window.innerWidth * dpr));
        canvas.height = Math.max(1, Math.floor(window.innerHeight * dpr));
        gl.viewport(0, 0, canvas.width, canvas.height);
      };

      window.addEventListener('resize', resize);
      resize();

      const handleContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
        cancelAnimationFrame(animationFrameId);
      };

      const handleContextRestored = () => {
        setContextLost(false);
        if (initWebGL()) {
          resize();
          animationFrameId = requestAnimationFrame(render);
        }
      };

      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);

      const render = (nowMs: number) => {
        if (!gl || !program) return;

        const nowSec = nowMs * 0.001;
        const dt = lastFrameTimeRef.current !== null ? Math.min(0.1, nowSec - lastFrameTimeRef.current) : 0.016;
        lastFrameTimeRef.current = nowSec;

        const p = paramsRef.current;
        const audio = audioMetricsRef.current;

        if (p.autoDrift) {
          driftAccumRef.current += dt * (p.driftSpeed + audio.beat * 0.65);
          if (onDriftTimeUpdate) {
            onDriftTimeUpdate(driftAccumRef.current);
          }
        }

        gl.uniform2f(locations.resolution, canvas.width, canvas.height);
        gl.uniform1f(locations.time, nowSec);
        gl.uniform4f(locations.juliaC, p.cx, p.cy, p.cz, p.cw);
        gl.uniform1f(locations.wSlice, p.wSlice);
        gl.uniform1f(locations.rotXW, p.rotXW);
        gl.uniform1f(locations.rotYW, p.rotYW);
        gl.uniform1f(locations.rotZW, p.rotZW);
        gl.uniform1f(locations.camYaw, p.camYaw);
        gl.uniform1f(locations.camPitch, p.camPitch);
        gl.uniform1f(locations.camDist, p.camDist);
        gl.uniform1f(locations.iter, p.iter);
        gl.uniform1f(locations.spiral, p.spiral);
        gl.uniform1f(locations.aoStrength, p.aoStrength);
        gl.uniform1f(locations.glow, p.glow);
        gl.uniform1f(locations.palette, p.palette);
        gl.uniform1f(locations.driftTime, driftAccumRef.current);
        gl.uniform1f(locations.audioBass, audio.active ? audio.bass : 0);
        gl.uniform1f(locations.audioMid, audio.active ? audio.mid : 0);
        gl.uniform1f(locations.audioHigh, audio.active ? audio.high : 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        if (snapshotPendingRef.current) {
          snapshotPendingRef.current = false;
          try {
            const dataUrl = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = `omniscope-4d-${Date.now()}.png`;
            link.href = dataUrl;
            link.click();
          } catch (err) {
            console.error('Snapshot capture failed:', err);
          }
        }

        animationFrameId = requestAnimationFrame(render);
      };

      animationFrameId = requestAnimationFrame(render);

      return () => {
        window.removeEventListener('resize', resize);
        canvas.removeEventListener('webglcontextlost', handleContextLost);
        canvas.removeEventListener('webglcontextrestored', handleContextRestored);
        cancelAnimationFrame(animationFrameId);
        if (gl) {
          if (program) gl.deleteProgram(program);
          if (vs) gl.deleteShader(vs);
          if (fs) gl.deleteShader(fs);
          if (buffer) gl.deleteBuffer(buffer);
        }
      };
    }, [audioMetricsRef, onDriftTimeUpdate]);

    const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      pointerRef.current = {
        active: true,
        lastX: e.clientX,
        lastY: e.clientY,
        shiftKey: e.shiftKey,
      };
    };

    const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!pointerRef.current.active) return;
      const dx = e.clientX - pointerRef.current.lastX;
      const dy = e.clientY - pointerRef.current.lastY;
      pointerRef.current.lastX = e.clientX;
      pointerRef.current.lastY = e.clientY;

      const is4D = e.shiftKey || pointerRef.current.shiftKey || dragModeRef.current === '4d';
      const sensitivity = 0.0065;

      onParamsDelta((prev) => {
        if (is4D) {
          return {
            ...prev,
            rotXW: prev.rotXW + dx * sensitivity,
            rotYW: prev.rotYW + dy * sensitivity,
          };
        }
        const nextPitch = Math.max(-1.45, Math.min(1.45, prev.camPitch + dy * sensitivity));
        return {
          ...prev,
          camYaw: prev.camYaw - dx * sensitivity,
          camPitch: nextPitch,
        };
      });
    };

    const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (pointerRef.current.active) {
        pointerRef.current.active = false;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // ignore if not captured
        }
      }
    };

    const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
      const delta = e.deltaY * 0.0018;
      onParamsDelta((prev) => ({
        ...prev,
        camDist: Math.max(1.25, Math.min(5.2, prev.camDist + delta)),
      }));
    };

    if (webglUnavailable) {
      return (
        <div className="fixed inset-0 z-0 flex items-center justify-center bg-[#05070b] px-6 text-center">
          <div className="max-w-md rounded-xl border border-white/10 bg-[#0b0f17] p-6">
            <h2 className="text-base font-semibold text-slate-100">WebGL Rendering Unavailable</h2>
            <p className="mt-2 text-sm text-slate-400">
              Hardware-accelerated WebGL is required to raymarch the 4D quaternion field. Please enable WebGL in your browser settings.
            </p>
          </div>
        </div>
      );
    }

    return (
      <>
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
          className="fixed inset-0 z-0 block h-full w-full touch-none cursor-grab active:cursor-grabbing"
          aria-label="Interactive 4D quaternion Julia raymarched viewport"
        />
        {contextLost && (
          <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/75 backdrop-blur-sm">
            <div className="rounded-lg border border-white/15 bg-[#0b0f17] px-5 py-3 text-sm text-slate-200">
              Restoring WebGL shader context...
            </div>
          </div>
        )}
      </>
    );
  }
);

WebGLView.displayName = 'WebGLView';

export default WebGLView;