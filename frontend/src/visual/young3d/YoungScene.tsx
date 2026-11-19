/**
 * The 3D optical laboratory of the Young's double-slit lab, built with Three.js through React Three Fiber and Drei.
 * Rendering only: every number drawn here comes from `../young` (which has its own tests).
 *
 * Two worlds share one canvas:
 *  - apparatus: laser, slit plate, screen and optical bench on a scale where 1 m = X_PER_M scene units. The screen shows the REAL
 *    pattern for the real numbers (texture filled from `intensity()`), with a millimetre scale; only the slit separation of the
 *    plate is drawn larger than life so that the two slits can be seen.
 *  - wave: a magnified teaching model, labelled as such, where the two coherent sources emit cylindrical waves. The complex field
 *    comes from `waveField()` on the CPU and the GPU only multiplies it by cos(ωt) and sin(ωt), so every frame is exact.
 */
import { OrbitControls, PerformanceMonitor } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import {
  fillWaveGrid, modelZAtOrder, samplePattern, waveField, waveIntensity, waveModel, wavelengthRgb, windowHalf, type YoungState,
} from '../young';

export const X_PER_M = 4;
export const LX = 26;
export const HZ = 10;
const SCREEN_HALF_Z = 3;
const AXIS_Y = 1.5;
const PLATE_H = 4;
const TEX_N = 2048;

export type Part = 'laser' | 'plate' | 'screen' | 'bench';
export type Mode = 'apparatus' | 'wave';
export type WaveView = 'waves' | 'intensity' | 'both';
export interface CamGoal { pos: [number, number, number]; target: [number, number, number]; id: number }

export interface SceneProps {
  s: YoungState;
  mode: Mode;
  plateX: number;
  laserOn: boolean;
  wide: boolean;
  probe: number;
  markers: { a: number | null; b: number | null };
  waveView: WaveView;
  surface: boolean;
  playing: boolean;
  speed: number;
  selected: Part | null;
  onSelect: (p: Part | null) => void;
  onProbe: (f: number) => void;
  onDrag: (kind: 'screen' | 'plate', x: number) => void;
  onToggleSlit: (which: 1 | 2) => void;
  goal: CamGoal;
  quality: 'high' | 'low';
  onQuality: (q: 'high' | 'low') => void;
  onFps: (n: number) => void;
  onUserCamera: () => void;
  geometry: boolean;
  fans: boolean;
  hotspots: boolean;
  apiRef: React.MutableRefObject<CameraApi | null>;
}

/** Imperative camera handle for keyboard and button control: the 3D view must be operable without a mouse. */
export interface CameraApi {
  orbit: (azimuth: number, elevation: number) => void;
  zoom: (factor: number) => void;
  get: () => { pos: [number, number, number]; target: [number, number, number] };
  /** where a scene point lands in the canvas, in CSS pixels (used by the browser tests to aim drags) */
  project: (v: [number, number, number]) => [number, number];
}

const css = (l: number) => new THREE.Color(...wavelengthRgb(l).map((v) => v / 255) as [number, number, number]);

/** Slit separation drawn larger than life: 0.6 to 2.2 scene units for 0.2 to 1.0 mm. */
export const dVisual = (d: number) => 0.6 + ((d - 0.2) / 0.8) * 1.6;

// ---------------------------------------------------------------------------------------------- shaders
const SCREEN_VERT = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const SCREEN_FRAG = /* glsl */ `
uniform sampler2D uTex; uniform vec3 uColor; uniform float uFire;
varying vec2 vUv;
void main() {
  float I = texture2D(uTex, vec2(vUv.x, 0.5)).r;
  float v = pow(I, 0.55) * uFire;
  gl_FragColor = vec4(vec3(0.035, 0.035, 0.045) + uColor * v, 1.0);
}`;
const WAVE_VERT = /* glsl */ `
uniform sampler2D uField; uniform float uPhase; uniform float uAmp;
varying vec2 vUv; varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 f = texture2D(uField, uv);
  float u = f.r * cos(uPhase) + f.g * sin(uPhase);
  vec3 p = position;
  p.z -= uAmp * clamp(u, -2.0, 2.0);
  vec4 w = modelMatrix * vec4(p, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
const WAVE_FRAG = /* glsl */ `
uniform sampler2D uField; uniform float uPhase; uniform float uMode; uniform vec3 uColor; uniform float uGain;
varying vec2 vUv; varying vec3 vWorld;
void main() {
  vec4 f = texture2D(uField, vUv);
  float u = f.r * cos(uPhase) + f.g * sin(uPhase);
  float I = 0.5 * (f.r * f.r + f.g * f.g);
  float t = u * uGain; t = t / (1.0 + abs(t));
  vec3 wave = mix(vec3(0.62, 0.12, 0.38), vec3(0.18, 0.72, 0.96), 0.5 + 0.5 * t);
  float k = clamp(I * uGain * 0.9, 0.0, 1.0);
  vec3 inten = uColor * pow(k, 0.6);
  vec3 n = normalize(cross(dFdx(vWorld), dFdy(vWorld)));
  float lit = 0.62 + 0.38 * abs(dot(n, normalize(vec3(0.35, 1.0, 0.25))));
  vec3 col = uMode < 0.5 ? wave * lit : (uMode < 1.5 ? inten : mix(wave * lit, inten * 1.2 + wave * 0.15, 0.6 * pow(k, 0.5)));
  gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------------------------------------- helpers
/**
 * Window-level dragging along a plane, independent of which object is under the pointer (works for mouse and touch).
 * The plane passes through the point that was grabbed, and the callback gets the grab-relative movement, so an object
 * follows the pointer without jumping even when it is grabbed high up and seen in perspective.
 */
type Grab = { point?: THREE.Vector3 };
function usePlaneDrag(plane: (grabY: number) => THREE.Plane, onMove: (pt: THREE.Vector3, d: { dx: number; origin: number }) => void, controls: React.MutableRefObject<OrbitControlsImpl | null>) {
  const { camera, gl } = useThree();
  const active = useRef(false);
  const grab = useRef({ y: 0.2, x: 0, origin: 0 });
  const cb = useRef(onMove);
  cb.current = onMove;
  const planeRef = useRef(plane);
  planeRef.current = plane;
  useEffect(() => {
    const ray = new THREE.Raycaster();
    const hit = new THREE.Vector3();
    const move = (e: PointerEvent) => {
      if (!active.current) return;
      const r = gl.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      if (ray.ray.intersectPlane(planeRef.current(grab.current.y), hit)) cb.current(hit, { dx: hit.x - grab.current.x, origin: grab.current.origin });
    };
    const up = () => {
      if (!active.current) return;
      active.current = false;
      if (controls.current) controls.current.enabled = true;
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [camera, gl, controls]);
  return (e: Grab, origin = 0) => {
    active.current = true;
    if (controls.current) controls.current.enabled = false;
    grab.current = { y: e.point?.y ?? 0.2, x: e.point?.x ?? 0, origin };
    // a probe-style drag (a plane that faces the camera) wants the point under the pointer straight away
    cb.current(e.point ?? new THREE.Vector3(), { dx: 0, origin });
  };
}

const LABEL_BG = { dark: 'rgba(26,34,51,0.88)', accent: 'rgba(35,71,168,0.94)', warn: 'rgba(168,97,0,0.94)' } as const;
/** Text label drawn as a camera-facing sprite (no DOM roots, cheap, and it scales with distance like everything else). */
function Label({ position, children, tone = 'dark' }: { position: [number, number, number]; children: React.ReactNode; tone?: 'dark' | 'accent' | 'warn' }) {
  const text = React.Children.toArray(children).join('');
  const made = useMemo(() => {
    const c = document.createElement('canvas');
    const g = c.getContext('2d')!;
    const font = '600 30px system-ui, "Segoe UI", sans-serif';
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 28;
    c.width = w;
    c.height = 48;
    g.font = font;
    g.fillStyle = LABEL_BG[tone];
    g.beginPath();
    g.roundRect(0, 0, w, 48, 9);
    g.fill();
    g.fillStyle = '#fff';
    g.textBaseline = 'middle';
    g.fillText(text, 14, 25);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return { tex, w, h: 48 };
  }, [text, tone]);
  useEffect(() => () => made.tex.dispose(), [made]);
  const k = 0.0105;
  return (
    <sprite position={position} scale={[made.w * k, made.h * k, 1]} renderOrder={20}>
      <spriteMaterial map={made.tex} transparent depthTest={false} depthWrite={false} />
    </sprite>
  );
}

// ---------------------------------------------------------------------------------------------- apparatus parts
function Bench({ plateX, screenX, selected, onSelect }: { plateX: number; screenX: number; selected: boolean; onSelect: () => void }) {
  const ticks = useMemo(() => {
    const m = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.06, 0.5), new THREE.MeshBasicMaterial({ color: '#8d96a6' }), 160);
    const o = new THREE.Object3D();
    for (let i = 0; i < 160; i++) {
      o.position.set(-12 + i * 0.2, -0.02, 1.1);
      o.scale.set(1, 1, i % 5 === 0 ? 1.6 : 1);
      o.updateMatrix();
      m.setMatrixAt(i, o.matrix);
    }
    return m;
  }, []);
  return (
    <group>
      <mesh position={[3, -0.25, 0]} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={[30, 0.3, 2.6]} />
        <meshStandardMaterial color={selected ? '#7a8cae' : '#5b6474'} roughness={0.7} />
      </mesh>
      <primitive object={ticks} />
      {[0, 1, 2, 3].map((m) => (
        <Label key={m} position={[plateX + m * X_PER_M, -0.02, 1.7]}>{m} m</Label>
      ))}
      <mesh position={[3, -0.65, 0]}><boxGeometry args={[32, 0.5, 3.4]} /><meshStandardMaterial color="#cfd5df" /></mesh>
      <gridHelper args={[60, 60, '#d5dae3', '#e6e9ef']} position={[3, -0.9, 0]} />
      <Label position={[screenX, -0.5, 2.2]} tone="warn">drag the stand</Label>
    </group>
  );
}

function Laser({ x, color, on, selected, onPick }: { x: number; color: THREE.Color; on: boolean; selected: boolean; onPick: () => void }) {
  return (
    <group position={[x, AXIS_Y, 0]} onClick={(e) => { e.stopPropagation(); onPick(); }}>
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.42, 0.42, 2.4, 32]} />
        <meshStandardMaterial color={selected ? '#3c4a6a' : '#262d3b'} metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh position={[1.25, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.16, 0.16, 0.1, 20]} />
        <meshBasicMaterial color={on ? color : '#444b5a'} />
      </mesh>
      <mesh position={[0, -0.55, 0]}><boxGeometry args={[1.4, 0.45, 0.9]} /><meshStandardMaterial color="#394152" /></mesh>
      {selected && <Label position={[0, 1, 0]} tone="accent">Laser</Label>}
    </group>
  );
}

function Plate({ s, x, selected, onPick, onGrab, onToggleSlit }: { s: YoungState; x: number; selected: boolean; onPick: () => void; onGrab: (e: Grab) => void; onToggleSlit: (w: 1 | 2) => void }) {
  const dv = dVisual(s.d);
  const sw = 0.14;
  const z1 = -dv / 2;
  const z2 = dv / 2;
  const mat = <meshStandardMaterial color={selected ? '#3a465f' : '#1f2533'} roughness={0.5} metalness={0.2} />;
  const blocks: { z0: number; z1: number }[] = [
    { z0: -SCREEN_HALF_Z - 0.4, z1: z1 - sw / 2 },
    { z0: z1 + sw / 2, z1: z2 - sw / 2 },
    { z0: z2 + sw / 2, z1: SCREEN_HALF_Z + 0.4 },
  ];
  return (
    <group position={[x, AXIS_Y, 0]}
      onClick={(e) => { e.stopPropagation(); onPick(); }}
      onPointerDown={(e) => { e.stopPropagation(); onGrab(e); }}>
      {blocks.map((b, i) => (
        <mesh key={i} position={[0, 0, (b.z0 + b.z1) / 2]}>
          <boxGeometry args={[0.16, PLATE_H, b.z1 - b.z0]} />
          {mat}
        </mesh>
      ))}
      {[{ z: z1, on: s.slit1, w: 1 as const }, { z: z2, on: s.slit2, w: 2 as const }].map(({ z, on, w }) => (
        <group key={w}>
          <mesh position={[0, 0, z]}><boxGeometry args={[0.18, PLATE_H - 0.1, sw * 0.5]} /><meshBasicMaterial color={on ? '#fff7d6' : '#000'} transparent opacity={on ? 0.9 : 0} /></mesh>
          {!on && (
            <mesh position={[-0.12, 0, z]} onClick={(e) => { e.stopPropagation(); onToggleSlit(w); }}>
              <boxGeometry args={[0.08, PLATE_H - 0.2, sw * 2.2]} /><meshStandardMaterial color="#a86100" />
            </mesh>
          )}
          <Label position={[0, PLATE_H / 2 + 0.45, z]} tone={on ? 'dark' : 'warn'}>{`S${w}${on ? '' : ' covered'}`}</Label>
        </group>
      ))}
      <Label position={[0, -PLATE_H / 2 - 0.4, 0]}>slit plate (drag along the bench)</Label>
      <Label position={[0, PLATE_H / 2 + 1.1, 0]}>{`d = ${s.d.toFixed(2)} mm (drawn larger)`}</Label>
    </group>
  );
}

function Beam({ fromX, toX, color, on }: { fromX: number; toX: number; color: THREE.Color; on: boolean }) {
  if (!on) return null;
  return (
    <mesh position={[(fromX + toX) / 2, AXIS_Y, 0]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[0.05, 0.05, toX - fromX, 12]} />
      <meshBasicMaterial color={color} transparent opacity={0.85} blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  );
}

/** Light spreading from each open slit to the screen. */
function Fans({ s, plateX, screenX, color }: { s: YoungState; plateX: number; screenX: number; color: THREE.Color }) {
  const dv = dVisual(s.d);
  const geos = useMemo(() => {
    return [-dv / 2, dv / 2].map((z) => {
      const g = new THREE.BufferGeometry();
      const v = new Float32Array([plateX, 0, z, screenX, 0, -SCREEN_HALF_Z, screenX, 0, SCREEN_HALF_Z]);
      g.setAttribute('position', new THREE.BufferAttribute(v, 3));
      return g;
    });
  }, [dv, plateX, screenX]);
  return (
    <group position={[0, AXIS_Y, 0]}>
      {geos.map((g, i) => ((i === 0 ? s.slit1 : s.slit2) ? (
        <mesh key={i} geometry={g}>
          <meshBasicMaterial color={color} transparent opacity={0.1} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      ) : null))}
    </group>
  );
}

function Screen({ s, x, wide, fire, color, probe, markers, selected, geometryOn, plateX, onPick, onProbeStart, onGrabStand }: {
  s: YoungState; x: number; wide: boolean; fire: number; color: THREE.Color; probe: number; markers: { a: number | null; b: number | null };
  selected: boolean; geometryOn: boolean; plateX: number; onPick: () => void; onProbeStart: (e: Grab) => void; onGrabStand: (e: Grab) => void;
}) {
  const half = windowHalf(s, wide);
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(TEX_N), TEX_N, 1, THREE.RedFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, []);
  useEffect(() => {
    const p = samplePattern(s, half, TEX_N);
    const d = tex.image.data as Uint8Array;
    for (let k = 0; k < TEX_N; k++) d[k] = Math.round(255 * Math.min(1, p.i[k]!));
    tex.needsUpdate = true;
  }, [s, half, tex]);
  const mat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, uniforms: { uTex: { value: tex }, uColor: { value: new THREE.Color() }, uFire: { value: 0 } } }), [tex]);
  useEffect(() => { mat.uniforms.uColor!.value.copy(color); }, [mat, color]);
  useEffect(() => { mat.uniforms.uFire!.value = fire; }, [mat, fire]);

  // millimetre scale along the bottom edge
  const step = useMemo(() => {
    const raw = (2 * half * 1000) / 8;
    const p = Math.pow(10, Math.floor(Math.log10(raw)));
    const m = raw / p;
    return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  }, [half]);
  const ticks = useMemo(() => {
    const out: number[] = [];
    for (let t = -Math.floor((half * 1000) / step) * step; t <= half * 1000 + 1e-9; t += step) out.push(Number(t.toPrecision(8)));
    return out;
  }, [half, step]);
  const zOf = (f: number) => f * SCREEN_HALF_Z;
  const yOf = (f: number) => f * half;
  const dv = dVisual(s.d);
  const pz = zOf(probe);

  return (
    <group position={[x, AXIS_Y, 0]}>
      <mesh position={[0.07, 0, 0]} onClick={(e) => { e.stopPropagation(); onPick(); }}>
        <boxGeometry args={[0.12, PLATE_H + 0.5, 2 * SCREEN_HALF_Z + 0.5]} />
        <meshStandardMaterial color={selected ? '#3a465f' : '#20252f'} />
      </mesh>
      <mesh rotation={[0, -Math.PI / 2, 0]} position={[-0.001, 0, 0]} material={mat}
        onPointerDown={(e) => { e.stopPropagation(); onProbeStart(e); }}>
        <planeGeometry args={[2 * SCREEN_HALF_Z, PLATE_H]} />
      </mesh>
      {/* scale */}
      {ticks.map((t) => (
        <group key={t}>
          <mesh position={[-0.01, -PLATE_H / 2 - 0.05, (t / 1000 / half) * SCREEN_HALF_Z]}><boxGeometry args={[0.02, 0.18, 0.025]} /><meshBasicMaterial color="#e8ecf4" /></mesh>
          <Label position={[-0.02, -PLATE_H / 2 - 0.42, (t / 1000 / half) * SCREEN_HALF_Z]}>{Math.abs(t) >= 100 ? t.toFixed(0) : t.toFixed(Math.abs(step) < 1 ? 1 : 0)}</Label>
        </group>
      ))}
      <Label position={[-0.02, -PLATE_H / 2 - 0.85, 0]}>millimetres from the centre</Label>
      {/* probe and markers */}
      <mesh position={[-0.04, 0, pz]}><boxGeometry args={[0.02, PLATE_H, 0.03]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh position={[-0.08, 0, pz]}><sphereGeometry args={[0.13, 16, 12]} /><meshBasicMaterial color="#ffd23f" /></mesh>
      <Label position={[-0.1, PLATE_H / 2 + 0.3, pz]} tone="accent">{`P  y = ${(yOf(probe) * 1000).toFixed(2)} mm`}</Label>
      {([['A', markers.a, '#2ec27e'], ['B', markers.b, '#ff6b6b']] as const).map(([name, f, c]) => f === null ? null : (
        <group key={name}>
          <mesh position={[-0.05, 0, zOf(f)]}><boxGeometry args={[0.02, PLATE_H, 0.025]} /><meshBasicMaterial color={c} /></mesh>
          <Label position={[-0.1, -PLATE_H / 2 + 0.3, zOf(f)]} tone="warn">{`${name}  ${(yOf(f) * 1000).toFixed(2)} mm`}</Label>
        </group>
      ))}
      {/* derivation geometry: the two paths to P, drawn from the (enlarged) slit positions */}
      {geometryOn && (
        <group position={[-(x - plateX), 0, 0]}>
          {[{ z: -dv / 2, c: '#4cc9f0', n: 'S₁P' }, { z: dv / 2, c: '#f72585', n: 'S₂P' }].map((l) => {
            const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, l.z), new THREE.Vector3(x - plateX, 0, pz)]);
            return <primitive key={l.n} object={new THREE.Line(geo, new THREE.LineBasicMaterial({ color: l.c }))} />;
          })}
          <Label position={[(x - plateX) * 0.62, 0.45, pz * 0.62]} tone="accent">{`Δ = S₂P − S₁P`}</Label>
        </group>
      )}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------- wave world
function WaveWorld({ s, waveView, surface, playing, speed, quality, hotspots, goalWaveTime }: { s: YoungState; waveView: WaveView; surface: boolean; playing: boolean; speed: number; quality: 'high' | 'low'; hotspots: boolean; goalWaveTime: number }) {
  const model = useMemo(() => waveModel(s), [s.lambda, s.d]); // eslint-disable-line react-hooks/exhaustive-deps
  const nx = quality === 'high' ? 256 : 160;
  const nz = quality === 'high' ? 208 : 128;
  const segX = quality === 'high' ? 200 : 110;
  const segZ = quality === 'high' ? 160 : 90;
  const color = useMemo(() => css(s.lambda), [s.lambda]);
  const tex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint16Array(4 * nx * nz), nx, nz, THREE.RGBAFormat, THREE.HalfFloatType);
    t.minFilter = THREE.LinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = false;
    return t;
  }, [nx, nz]);
  const buf = useMemo(() => new Float32Array(4 * nx * nz), [nx, nz]);
  // recompute the field only when the physics changes
  useEffect(() => {
    fillWaveGrid(model, s, nx, nz, LX, HZ, buf);
    const out = tex.image.data as Uint16Array;
    for (let k = 0; k < buf.length; k++) out[k] = THREE.DataUtils.toHalfFloat(buf[k]!);
    tex.needsUpdate = true;
  }, [model, s.slit1, s.slit2, nx, nz, buf, tex]); // eslint-disable-line react-hooks/exhaustive-deps
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: WAVE_VERT, fragmentShader: WAVE_FRAG, side: THREE.DoubleSide,
    uniforms: { uField: { value: tex }, uPhase: { value: 0 }, uAmp: { value: 0.35 }, uMode: { value: 0 }, uColor: { value: new THREE.Color() }, uGain: { value: 1.1 } },
  }), [tex]);
  useEffect(() => { mat.uniforms.uColor!.value.copy(color); }, [mat, color]);
  useEffect(() => { mat.uniforms.uMode!.value = waveView === 'waves' ? 0 : waveView === 'intensity' ? 1 : 2; }, [mat, waveView]);
  useEffect(() => { mat.uniforms.uAmp!.value = surface ? 0.35 : 0; }, [mat, surface]);
  const phase = useRef(0);
  useEffect(() => { phase.current = goalWaveTime; }, [goalWaveTime]);
  useFrame((_, dt) => {
    if (playing) phase.current += dt * Math.PI * speed;
    mat.uniforms.uPhase!.value = phase.current;
  });

  // intensity along the model screen at x = LX, drawn as a wall texture and a 3D height ribbon
  const wall = useMemo(() => {
    const n = 1024;
    const zs = new Float32Array(n);
    const I = new Float32Array(n);
    let mx = 0;
    for (let k = 0; k < n; k++) {
      zs[k] = -HZ + (2 * HZ * k) / (n - 1);
      I[k] = waveIntensity(waveField(model, s, LX, zs[k]!));
      mx = Math.max(mx, I[k]!);
    }
    return { zs, I, mx: mx || 1 };
  }, [model, s.slit1, s.slit2]); // eslint-disable-line react-hooks/exhaustive-deps
  const wallTex = useMemo(() => {
    const t = new THREE.DataTexture(new Uint8Array(1024), 1024, 1, THREE.RedFormat, THREE.UnsignedByteType);
    t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false;
    return t;
  }, []);
  useEffect(() => {
    const d = wallTex.image.data as Uint8Array;
    for (let k = 0; k < 1024; k++) d[k] = Math.round(255 * Math.min(1, wall.I[k]! / wall.mx));
    wallTex.needsUpdate = true;
  }, [wall, wallTex]);
  const wallMat = useMemo(() => new THREE.ShaderMaterial({ vertexShader: SCREEN_VERT, fragmentShader: SCREEN_FRAG, uniforms: { uTex: { value: wallTex }, uColor: { value: new THREE.Color() }, uFire: { value: 1 } } }), [wallTex]);
  useEffect(() => { wallMat.uniforms.uColor!.value.copy(color); }, [wallMat, color]);
  const ribbon = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k < wall.zs.length; k++) pts.push(new THREE.Vector3(LX, 2.9 + 3 * (wall.I[k]! / wall.mx), wall.zs[k]!));
    return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: '#ffd23f' }));
  }, [wall]);

  // hot spots on the model screen where the path difference is a whole number of wavelengths (bright) or an odd number of half wavelengths (dark)
  const spots = useMemo(() => [0, 0.5, 1, 1.5, 2].map((o) => ({ o, z: modelZAtOrder(model, LX, o, HZ) })).filter((p): p is { o: number; z: number } => p.z !== null), [model]);

  const dm = model.d;
  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[LX / 2, 0, 0]} material={mat}>
        <planeGeometry args={[LX, 2 * HZ, segX, segZ]} />
      </mesh>
      {/* the plate and the two coherent sources */}
      {[{ z0: -HZ, z1: -dm / 2 - 0.12 }, { z0: -dm / 2 + 0.12, z1: dm / 2 - 0.12 }, { z0: dm / 2 + 0.12, z1: HZ }].map((b, i) => (
        <mesh key={i} position={[-0.1, 0.5, (b.z0 + b.z1) / 2]}><boxGeometry args={[0.2, 1.2, Math.max(0.01, b.z1 - b.z0)]} /><meshStandardMaterial color="#1f2533" /></mesh>
      ))}
      {[{ z: -dm / 2, on: s.slit1, n: 'S₁' }, { z: dm / 2, on: s.slit2, n: 'S₂' }].map((src) => (
        <group key={src.n}>
          <mesh position={[0.05, 0.3, src.z]}><sphereGeometry args={[0.22, 16, 12]} /><meshBasicMaterial color={src.on ? '#fff3b0' : '#555'} /></mesh>
          <Label position={[-0.3, 1.5, src.z]} tone={src.on ? 'dark' : 'warn'}>{src.on ? src.n : `${src.n} covered`}</Label>
        </group>
      ))}
      {/* the model screen */}
      <mesh position={[LX + 0.02, 1.1, 0]} rotation={[0, -Math.PI / 2, 0]} material={wallMat}><planeGeometry args={[2 * HZ, 2.2]} /></mesh>
      <primitive object={ribbon} />
      <Label position={[LX, 7.2, 0]}>intensity on the model screen</Label>
      <Label position={[LX / 2, -0.8, -HZ - 0.6]} tone="warn">magnified teaching model: λ and d are not to scale; the geometry (path difference = nλ) is exact</Label>
      {hotspots && spots.map((p) => (
        <group key={p.o}>
          <mesh position={[LX, 0.2, p.z]}><sphereGeometry args={[0.28, 16, 12]} /><meshBasicMaterial color={Number.isInteger(p.o) ? '#ffd23f' : '#4cc9f0'} /></mesh>
          <Label position={[LX + 0.4, 0.9, p.z]} tone="accent">{p.o === 0 ? 'Δ = 0' : `Δ = ${Number.isInteger(p.o) ? p.o : p.o.toFixed(1)}λ`}</Label>
        </group>
      ))}
    </group>
  );
}

// ---------------------------------------------------------------------------------------------- camera
function CameraRig({ goal, controls, onUserCamera, apiRef }: { goal: CamGoal; controls: React.MutableRefObject<OrbitControlsImpl | null>; onUserCamera: () => void; apiRef: React.MutableRefObject<CameraApi | null> }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    apiRef.current = {
      orbit: (az, el) => {
        const c = controls.current;
        if (!c) return;
        const off = camera.position.clone().sub(c.target);
        const sph = new THREE.Spherical().setFromVector3(off);
        sph.theta += az;
        sph.phi = Math.max(0.12, Math.min(Math.PI - 0.12, sph.phi + el));
        camera.position.copy(c.target).add(new THREE.Vector3().setFromSpherical(sph));
        c.update();
        onUserCamera();
      },
      zoom: (f) => {
        const c = controls.current;
        if (!c) return;
        const off = camera.position.clone().sub(c.target).multiplyScalar(f);
        const len = Math.max(2, Math.min(46, off.length()));
        camera.position.copy(c.target).add(off.setLength(len));
        c.update();
        onUserCamera();
      },
      project: (v) => {
        const el = gl.domElement.getBoundingClientRect();
        const p = new THREE.Vector3(...v).project(camera);
        return [el.left + ((p.x + 1) / 2) * el.width, el.top + ((1 - p.y) / 2) * el.height];
      },
      get: () => ({ pos: camera.position.toArray() as [number, number, number], target: (controls.current?.target.toArray() ?? [0, 0, 0]) as [number, number, number] }),
    };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, gl, controls, onUserCamera]);
  const target = useRef({ pos: new THREE.Vector3(...goal.pos), look: new THREE.Vector3(...goal.target), moving: true });
  const lastId = useRef(-1);
  if (lastId.current !== goal.id) {
    lastId.current = goal.id;
    target.current.pos.set(...goal.pos);
    target.current.look.set(...goal.target);
    target.current.moving = true;
  }
  useFrame((_, dt) => {
    const c = controls.current;
    if (!c) return;
    if (target.current.moving) {
      const k = 1 - Math.pow(0.002, dt);
      camera.position.lerp(target.current.pos, k);
      c.target.lerp(target.current.look, k);
      if (camera.position.distanceTo(target.current.pos) < 0.02 && c.target.distanceTo(target.current.look) < 0.02) target.current.moving = false;
    }
    c.update();
  });
  useEffect(() => {
    const c = controls.current;
    if (!c) return;
    const stop = () => { target.current.moving = false; onUserCamera(); };
    c.addEventListener('start', stop);
    return () => c.removeEventListener('start', stop);
  }, [controls, onUserCamera]);
  return null;
}

function FpsMeter({ onFps }: { onFps: (n: number) => void }) {
  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt;
    acc.current.n++;
    if (acc.current.t >= 0.6) {
      onFps(Math.round(acc.current.n / acc.current.t));
      acc.current = { t: 0, n: 0 };
    }
  });
  return null;
}

function World(p: SceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const screenX = p.plateX + p.s.D * X_PER_M;
  const color = useMemo(() => css(p.s.lambda), [p.s.lambda]);
  const half = windowHalf(p.s, p.wide);
  const [fire, setFire] = useState(0);
  const smooth = useRef(p.probe);
  const [probeShown, setProbeShown] = useState(p.probe);
  const target = p.laserOn ? 1 : 0;
  useFrame((_, dt) => {
    // ease the laser fade and the probe motion so changes read as motion, not jumps
    setFire((f) => (Math.abs(f - target) < 0.01 ? target : f + (target - f) * Math.min(1, dt * 6)));
    smooth.current += (p.probe - smooth.current) * Math.min(1, dt * 12);
    if (Math.abs(smooth.current - probeShown) > 0.0005) setProbeShown(smooth.current);
  });
  const probeDrag = usePlaneDrag(() => new THREE.Plane(new THREE.Vector3(1, 0, 0), -screenX), (pt) => p.onProbe(Math.max(-1, Math.min(1, pt.z / SCREEN_HALF_Z))), controls);
  const screenDrag = usePlaneDrag((y) => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), (_pt, d) => p.onDrag('screen', d.origin + d.dx), controls);
  const plateDrag = usePlaneDrag((y) => new THREE.Plane(new THREE.Vector3(0, 1, 0), -y), (_pt, d) => p.onDrag('plate', d.origin + d.dx), controls);
  const laserX = p.plateX - 8.5;
  void half;
  return (
    <>
      <color attach="background" args={['#e9edf4']} />
      <ambientLight intensity={0.9} />
      <directionalLight position={[8, 14, 10]} intensity={1.3} />
      <directionalLight position={[-6, 6, -8]} intensity={0.4} />
      <OrbitControls ref={controls as never} makeDefault enableDamping dampingFactor={0.12} minDistance={2} maxDistance={46} screenSpacePanning enablePan />
      <CameraRig goal={p.goal} controls={controls} onUserCamera={p.onUserCamera} apiRef={p.apiRef} />
      <FpsMeter onFps={p.onFps} />
      <PerformanceMonitor onDecline={() => p.onQuality('low')} onIncline={() => p.onQuality('high')} flipflops={2} />
      <group visible={p.mode === 'apparatus'}>
        <Bench plateX={p.plateX} screenX={screenX} selected={p.selected === 'bench'} onSelect={() => p.onSelect('bench')} />
        <Laser x={laserX} color={color} on={p.laserOn} selected={p.selected === 'laser'} onPick={() => p.onSelect('laser')} />
        <Beam fromX={laserX + 1.3} toX={p.plateX - 0.1} color={color} on={p.laserOn} />
        <Plate s={p.s} x={p.plateX} selected={p.selected === 'plate'} onPick={() => p.onSelect('plate')} onGrab={(e) => plateDrag(e, p.plateX)} onToggleSlit={p.onToggleSlit} />
        {p.laserOn && p.fans && <Fans s={p.s} plateX={p.plateX} screenX={screenX} color={color} />}
        <Screen s={p.s} x={screenX} wide={p.wide} fire={fire} color={color} probe={probeShown} markers={p.markers} selected={p.selected === 'screen'} geometryOn={p.geometry} plateX={p.plateX}
          onPick={() => p.onSelect('screen')} onProbeStart={(e) => probeDrag(e)} onGrabStand={(e) => screenDrag(e, screenX)} />
        <mesh position={[screenX, 0.05, 0]} onPointerDown={(e) => { e.stopPropagation(); screenDrag(e, screenX); }}>
          <boxGeometry args={[1.2, 0.45, 2.2]} /><meshStandardMaterial color="#a86100" />
        </mesh>
      </group>
      <group visible={p.mode === 'wave'}>
        <WaveWorld s={p.s} waveView={p.waveView} surface={p.surface} playing={p.playing} speed={p.speed} quality={p.quality} hotspots={p.hotspots} goalWaveTime={0} />
      </group>
    </>
  );
}

export default function YoungScene(p: SceneProps) {
  return (
    <Canvas
      dpr={p.quality === 'high' ? [1, 1.75] : 1}
      camera={{ position: p.goal.pos, fov: 45, near: 0.1, far: 200 }}
      gl={{ antialias: p.quality === 'high', powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      onPointerMissed={() => p.onSelect(null)}
      style={{ touchAction: 'none' }}
    >
      <World {...p} />
    </Canvas>
  );
}

