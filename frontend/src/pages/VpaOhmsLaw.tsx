import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, FlaskConical, Gauge, RotateCcw, Zap } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { Html, Line, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { api, type VpaAttempt, type VpaReading, type VpaReport } from '../api';
import { ErrorBox, Loading } from '../ui';

type Port = 'battery+' | 'battery-' | 'ammeter+' | 'ammeter-' | 'resistorA' | 'resistorB' | 'voltmeter+' | 'voltmeter-';
const PORTS: { id: Port; label: string; sign: string }[] = [
  { id: 'battery+', label: 'Battery +', sign: '+' }, { id: 'battery-', label: 'Battery −', sign: '−' },
  { id: 'ammeter+', label: 'Ammeter +', sign: '+' }, { id: 'ammeter-', label: 'Ammeter −', sign: '−' },
  { id: 'resistorA', label: 'Resistor A', sign: 'A' }, { id: 'resistorB', label: 'Resistor B', sign: 'B' },
  { id: 'voltmeter+', label: 'Voltmeter +', sign: '+' }, { id: 'voltmeter-', label: 'Voltmeter −', sign: '−' },
];
const normWire = (a: Port, b: Port) => [a, b].sort().join(':');
type WorldPoint = [number, number, number];
const PORT_POINTS: Record<Port, WorldPoint> = {
  'battery+': [-3.95, 0.82, 0.42], 'battery-': [-2.88, 0.82, 0.42],
  'ammeter+': [-1.91, 0.48, 0.9], 'ammeter-': [-0.87, 0.48, 0.9],
  resistorA: [0.47, 0.82, 0.42], resistorB: [1.85, 0.82, 0.42],
  'voltmeter+': [0.47, 0.48, -0.54], 'voltmeter-': [1.85, 0.48, -0.54],
};

function Terminal({ point, polarity, selected, onClick }: { point: WorldPoint; polarity: 'positive' | 'negative' | 'resistor'; selected: boolean; onClick: () => void }) {
  const color = selected ? '#d9ec69' : polarity === 'positive' ? '#bd533b' : polarity === 'negative' ? '#263d39' : '#d4a24e';
  return <group position={point}>
    <mesh onClick={(event) => { event.stopPropagation(); onClick(); }} onPointerOver={(event) => { event.stopPropagation(); document.body.style.cursor = 'pointer'; }} onPointerOut={() => { document.body.style.cursor = ''; }}>
      <sphereGeometry args={[selected ? 0.16 : 0.13, 24, 16]} /><meshStandardMaterial color={color} metalness={0.72} roughness={0.24} emissive={selected ? '#a7bb42' : '#000000'} emissiveIntensity={selected ? 0.4 : 0} />
    </mesh>
  </group>;
}

function Meter({ position, kind, value }: { position: WorldPoint; kind: 'A' | 'V'; value: string }) {
  const accent = kind === 'A' ? '#ba593c' : '#31806c';
  return <group position={position}>
    <mesh castShadow receiveShadow><boxGeometry args={[1.45, 0.27, 0.95]} /><meshStandardMaterial color="#25423b" metalness={0.32} roughness={0.33} /></mesh>
    <mesh position={[0, 0.16, 0]} castShadow><boxGeometry args={[1.25, 0.045, 0.64]} /><meshStandardMaterial color="#c8d6b6" metalness={0.2} roughness={0.25} /></mesh>
    <mesh position={[0, 0.2, -0.04]}><boxGeometry args={[0.98, 0.018, 0.27]} /><meshStandardMaterial color="#edf3d8" emissive="#c3d69a" emissiveIntensity={0.3} /></mesh>
    <Html position={[0, 0.23, 0.06]} center distanceFactor={5} style={{ pointerEvents: 'none', whiteSpace: 'nowrap' }}><span className="rounded-sm bg-[#edf3d8] px-2 font-mono text-[11px] font-bold" style={{ color: accent }}>{value}</span></Html>
  </group>;
}

function HumanAssistant() {
  const avatar = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!avatar.current) return;
    avatar.current.position.y = 0.03 + Math.sin(clock.elapsedTime * 1.3) * 0.025;
    avatar.current.rotation.y = Math.sin(clock.elapsedTime * 0.42) * 0.045;
  });
  return <group ref={avatar} position={[4.2, 0.78, -0.45]} rotation={[0, -0.14, 0]}>
    {/* Stylised low-poly lab student; a subtle idle motion keeps the workbench alive without distracting from the task. */}
    <mesh position={[0, 1.04, 0]} castShadow><capsuleGeometry args={[0.48, 0.9, 8, 16]} /><meshStandardMaterial color="#f2eee2" roughness={0.86} /></mesh>
    <mesh position={[0, 1.05, 0.27]}><boxGeometry args={[0.23, 0.5, 0.045]} /><meshStandardMaterial color="#b95339" roughness={0.7} /></mesh>
    <mesh position={[0, 1.83, 0]} castShadow><sphereGeometry args={[0.39, 32, 24]} /><meshStandardMaterial color="#d9a27d" roughness={0.9} /></mesh>
    <mesh position={[0, 2.03, -0.02]} castShadow><sphereGeometry args={[0.4, 32, 18, 0, Math.PI * 2, 0, Math.PI * 0.52]} /><meshStandardMaterial color="#253b35" roughness={0.94} /></mesh>
    <mesh position={[-0.49, 1.06, 0.12]} rotation={[0, 0, -0.28]} castShadow><capsuleGeometry args={[0.12, 0.66, 6, 12]} /><meshStandardMaterial color="#e8e2d4" roughness={0.9} /></mesh>
    <mesh position={[0.49, 0.83, 0.48]} rotation={[0.35, 0, 0.72]} castShadow><capsuleGeometry args={[0.12, 0.7, 6, 12]} /><meshStandardMaterial color="#e8e2d4" roughness={0.9} /></mesh>
    <mesh position={[0.86, 0.53, 0.74]} rotation={[0.25, 0, 0.2]} castShadow><capsuleGeometry args={[0.105, 0.36, 6, 12]} /><meshStandardMaterial color="#d9a27d" roughness={0.9} /></mesh>
    <mesh position={[-0.23, 0.17, 0.01]} castShadow><capsuleGeometry args={[0.16, 0.82, 6, 12]} /><meshStandardMaterial color="#344a43" roughness={0.9} /></mesh>
    <mesh position={[0.23, 0.17, 0.01]} castShadow><capsuleGeometry args={[0.16, 0.82, 6, 12]} /><meshStandardMaterial color="#344a43" roughness={0.9} /></mesh>
  </group>;
}

function ResponsiveCamera() {
  const { camera, size } = useThree();
  useEffect(() => {
    const compact = size.width < 640;
    camera.position.set(0, compact ? 7 : 6, compact ? 9.5 : 9);
    camera.lookAt(0, 0.72, 0);
    if (camera instanceof THREE.PerspectiveCamera) camera.fov = compact ? 45 : 36;
    camera.updateProjectionMatrix();
  }, [camera, size.width]);
  return null;
}

function CircuitWorld({ wires, selected, onPort, onRemove, reading }: { wires: string[]; selected: Port | null; onPort: (id: Port) => void; onRemove: (i: number) => void; reading?: VpaReading }) {
  const wirePaths = useMemo(() => wires.map((wire) => {
    const [a, b] = wire.split(':') as [Port, Port];
    const start = new THREE.Vector3(...PORT_POINTS[a]); const end = new THREE.Vector3(...PORT_POINTS[b]);
    let route: THREE.Vector3[];
    if (normWire(a, b) === normWire('battery-', 'resistorB')) {
      route = [start, new THREE.Vector3(2.42, 0.46, 0.42), new THREE.Vector3(2.42, 0.46, -1.82), new THREE.Vector3(-2.88, 0.46, -1.82), end];
    } else if (Math.abs(start.x - end.x) < 0.08) route = [start, end];
    else {
      const mid = start.clone().lerp(end, 0.5); mid.y = 0.46;
      route = [start, mid, end];
    }
    const curve = new THREE.CatmullRomCurve3(route);
    return curve.getPoints(28).map((p) => [p.x, p.y, p.z] as WorldPoint);
  }), [wires]);
  return <>
    <ResponsiveCamera />
    <color attach="background" args={['#e9ecdf']} />
    <fog attach="fog" args={['#e9ecdf', 10, 19]} />
    <ambientLight intensity={1.15} />
    <directionalLight position={[-4, 8, 5]} intensity={2.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
    <pointLight position={[1, 4, -3]} intensity={0.8} color="#f1c58e" />
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.08, 0]} receiveShadow><planeGeometry args={[200, 200]} /><meshStandardMaterial color="#d9ddcf" roughness={0.94} /></mesh>
    <mesh position={[0, 0.16, 0]} castShadow receiveShadow><boxGeometry args={[9.2, 0.24, 4.35]} /><meshStandardMaterial color="#dbc7aa" roughness={0.74} /></mesh>
    <mesh position={[0, 0.3, 0]}><boxGeometry args={[8.92, 0.07, 4.08]} /><meshStandardMaterial color="#f4f1e6" roughness={0.36} metalness={0.08} /></mesh>
    <mesh position={[0, 0.38, 0]}><boxGeometry args={[8.4, 0.018, 3.65]} /><meshStandardMaterial color="#e9eddf" roughness={0.4} /></mesh>
    <mesh position={[-1.1, 0.41, 0.18]}><boxGeometry args={[5.7, 0.012, 0.075]} /><meshStandardMaterial color="#cdd8c7" roughness={0.6} /></mesh>
    <mesh position={[1.16, 0.41, -0.9]}><boxGeometry args={[0.075, 0.012, 2.15]} /><meshStandardMaterial color="#cdd8c7" roughness={0.6} /></mesh>
    {/* Battery */}
    <group position={[-3.45, 0.62, 0.42]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[0.36, 0.36, 1.13, 48]} /><meshStandardMaterial color="#174d43" metalness={0.38} roughness={0.3} /></mesh>
      <mesh position={[0, 0.59, 0]}><cylinderGeometry args={[0.16, 0.16, 0.12, 32]} /><meshStandardMaterial color="#d6d8c4" metalness={0.78} roughness={0.22} /></mesh>
      <mesh position={[0, -0.59, 0]}><cylinderGeometry args={[0.16, 0.16, 0.12, 32]} /><meshStandardMaterial color="#d6d8c4" metalness={0.78} roughness={0.22} /></mesh>
    </group>
    {/* Unknown resistor on a ceramic stand */}
    <mesh position={[1.16, 0.58, 0.42]} castShadow><boxGeometry args={[1.14, 0.14, 0.82]} /><meshStandardMaterial color="#d3c4a6" roughness={0.6} /></mesh>
    <group position={[1.16, 0.84, 0.42]} rotation={[0, 0, Math.PI / 2]}><mesh castShadow><cylinderGeometry args={[0.2, 0.2, 0.92, 32]} /><meshStandardMaterial color="#b95339" metalness={0.45} roughness={0.28} /></mesh></group>
    <mesh position={[1.16, 0.48, 0.42]}><boxGeometry args={[0.55, 0.08, 0.88]} /><meshStandardMaterial color="#e4d9c4" /></mesh>
    <Meter position={[-1.39, 0.66, 0.42]} kind="A" value={reading ? `${reading.current.toFixed(2)} A` : '0.00 A'} />
    <Meter position={[1.16, 0.66, -1.05]} kind="V" value={reading ? `${reading.voltage.toFixed(2)} V` : '0.00 V'} />
    {wirePaths.map((points, index) => <Line key={`${wires[index]}-${index}`} points={points} color="#b95339" lineWidth={5} onClick={(event) => { event.stopPropagation(); onRemove(index); }} />)}
    {PORTS.map((port) => <Terminal key={port.id} point={PORT_POINTS[port.id]} polarity={port.id.endsWith('+') ? 'positive' : port.id.endsWith('-') ? 'negative' : 'resistor'} selected={selected === port.id} onClick={() => onPort(port.id)} />)}
    <HumanAssistant />
    <OrbitControls makeDefault enablePan={false} enableZoom={false} minPolarAngle={0.7} maxPolarAngle={1.17} target={[0, 0.72, 0]} />
  </>;
}

function CircuitBoard({ wires, selected, onPort, onRemove, reading }: { wires: string[]; selected: Port | null; onPort: (id: Port) => void; onRemove: (i: number) => void; reading?: VpaReading }) {
  return <div className="space-y-2">
    <div className="relative h-[330px] overflow-hidden rounded-2xl border border-[#cbd4c6] bg-[#e9ecdf] sm:h-[430px]" role="group" aria-label="Interactive three-dimensional circuit workbench">
    <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 6, 9], fov: 36 }} fallback={<p className="p-5 text-sm text-[#52675e]">3D graphics aren’t available in this browser. Use the terminal list to connect the apparatus.</p>}>
      <CircuitWorld wires={wires} selected={selected} onPort={onPort} onRemove={onRemove} reading={reading} />
    </Canvas>
    <div className="pointer-events-none absolute left-3 top-3 rounded-full border border-white/60 bg-white/90 px-3 py-1 text-[10px] font-semibold tracking-wide text-[#3e5c50] shadow-sm sm:left-4 sm:top-4 sm:text-xs">3D CIRCUIT WORKBENCH</div>
    </div>
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-xs text-[#52675e]" aria-label="Terminal color key">
      <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#bd533b]" /> Positive terminal</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#263d39]" /> Negative terminal</span>
      <span className="inline-flex items-center gap-1.5"><i className="size-2.5 rounded-full bg-[#d4a24e]" /> Resistor terminals</span>
      <span className="text-[#78857e]">Click two terminals to connect; click a lead to remove it.</span>
    </div>
    <details className="rounded-lg border border-[#d8dfcf] bg-[#fbfaf4] text-xs text-[#345248]">
      <summary className="cursor-pointer px-3 py-2 font-semibold">Keyboard terminal controls</summary>
      <div className="flex max-w-[min(92vw,520px)] flex-wrap gap-1.5 border-t border-[#e1e6dc] p-2" aria-label="Accessible circuit terminals">
        {PORTS.map((port) => <button key={port.id} type="button" onClick={() => onPort(port.id)} aria-pressed={selected === port.id} className={`rounded-full border px-2 py-1 font-semibold ${selected === port.id ? 'border-[#174d43] bg-[#d9ec69] text-[#173f39]' : 'border-[#d5ded1] bg-white text-[#345248] hover:bg-[#f1f4e9]'}`}>{port.label}</button>)}
      </div>
    </details>
  </div>;
}

function ReadingGraph({ readings }: { readings: VpaReading[] }) {
  const points = readings.map((r) => `${80 + (r.current / Math.max(0.4, ...readings.map((x) => x.current)) * 360)},${210 - (r.voltage / Math.max(1, ...readings.map((x) => x.voltage)) * 170)}`).join(' ');
  return <svg viewBox="0 0 480 250" className="w-full" role="img" aria-label="Voltage against current graph based on your recorded readings">
    <path d="M65 24 V212 H455" fill="none" stroke="#75877e" strokeWidth="2" />
    <path d="M65 45 H455 M65 100 H455 M65 155 H455 M160 24 V212 M255 24 V212 M350 24 V212" stroke="#e2e4da" strokeWidth="1" />
    <text x="257" y="242" textAnchor="middle" fill="#4b6258" fontSize="13">Current I (A)</text><text transform="translate(20 120) rotate(-90)" textAnchor="middle" fill="#4b6258" fontSize="13">Voltage V (V)</text>
    {readings.length > 1 && <polyline points={points} fill="none" stroke="#b95339" strokeWidth="3" strokeDasharray="6 5" />}
    {readings.map((r) => { const [cx, cy] = points.split(' ')[readings.indexOf(r)]!.split(','); return <circle key={r.voltageIndex} cx={cx} cy={cy} r="6" fill="#174d43" stroke="#fff" strokeWidth="2" />; })}
    {!readings.length && <text x="260" y="130" textAnchor="middle" fill="#8b968e" fontSize="14">Record readings to plot your graph</text>}
  </svg>;
}

function Scorecard({ report }: { report: VpaReport }) {
  const rows = [['Procedure', report.procedure], ['Apparatus', report.apparatus], ['Measurements', report.measurements], ['Calculations', report.calculations], ['Graph interpretation', report.graph]] as const;
  return <section className="mt-5 rounded-2xl border border-[#d8dfcf] bg-[#fffdf7] p-5 shadow-sm" aria-live="polite">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e4e6db] pb-4"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-[#61746c]">Assessment report</p><h2 className="mt-1 text-2xl font-bold text-[#173f39]">{report.score}<span className="text-base font-medium text-[#78857e]"> / {report.maxScore}</span></h2></div><span className={`rounded-full px-3 py-1 text-sm font-semibold ${report.passed ? 'bg-[#e7f0d7] text-[#174d43]' : 'bg-[#fae8df] text-[#a94331]'}`}>{report.passed ? 'Practical passed' : 'Keep practising'}</span></div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{rows.map(([label, item]) => <div key={label} className="rounded-xl bg-[#f5f5ec] p-3"><div className="flex justify-between text-sm font-semibold text-[#25463f]"><span>{label}</span><span>{item.score}/{item.max}</span></div><p className="mt-1 text-xs leading-5 text-[#66746c]">{item.feedback}</p></div>)}</div>
    {report.incorrectSteps.length > 0 && <div className="mt-4 rounded-xl border border-[#efd3c8] bg-[#fff4ee] p-4"><h3 className="font-semibold text-[#8f3d2d]">Steps to revisit</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[#614d43]">{report.incorrectSteps.map((x, i) => <li key={`${x}-${i}`}>{x}</li>)}</ul></div>}
    <div className="mt-4 rounded-xl bg-[#edf2e5] p-4"><h3 className="font-semibold text-[#174d43]">Recommended revision</h3>{report.recommendedRevision.length ? <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[#53665e]">{report.recommendedRevision.map((x) => <li key={x}>{x}</li>)}</ul> : <p className="mt-1 text-sm text-[#53665e]">Strong practical work. Review your score breakdown to reinforce the method.</p>}</div>
    <p className="mt-3 text-xs text-[#687970]">Reference resistance: {report.calculations.expectedResistance} Ω · Your result: {report.calculations.submittedResistance} Ω · Graph gradient: {report.graph.expectedSlope} Ω</p>
  </section>;
}

export function VpaOhmsLawPage() {
  const [params] = useSearchParams();
  const lessonId = params.get('lesson') ?? undefined;
  const [mode, setMode] = useState<'GUIDED' | 'INDEPENDENT'>('INDEPENDENT');
  const [attempt, setAttempt] = useState<VpaAttempt | null>(null);
  const [wires, setWires] = useState<string[]>([]);
  const [selected, setSelected] = useState<Port | null>(null);
  const [voltageIndex, setVoltageIndex] = useState(0);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [formula, setFormula] = useState<'V_OVER_I' | 'I_OVER_V' | 'V_TIMES_I'>('V_OVER_I');
  const [calculatedR, setCalculatedR] = useState('');
  const [graphShape, setGraphShape] = useState<'LINEAR_ORIGIN' | 'LINEAR_OFFSET' | 'CURVED' | 'NO_RELATION'>('LINEAR_ORIGIN');
  const [slope, setSlope] = useState('');
  const [observedVoltage, setObservedVoltage] = useState('');
  const [observedCurrent, setObservedCurrent] = useState('');
  const [report, setReport] = useState<VpaReport | null>(null);
  const [restoring, setRestoring] = useState(true);
  const readings = attempt?.readings ?? [];
  const activeReading = readings.find((r) => r.voltageIndex === voltageIndex);
  const activeMeter = attempt?.meterReadings.find((r) => r.voltageIndex === voltageIndex);
  const orderedWires = useMemo(() => wires.map((w) => w.split(':').sort().join(':')), [wires]);

  useEffect(() => {
    let mounted = true;
    let storedId = '';
    try { storedId = window.localStorage.getItem('prepora-vpa-current') ?? ''; } catch { /* storage may be disabled */ }
    if (storedId) api.vpaAttempt(storedId).then((saved) => {
      if (!mounted) return;
      setAttempt(saved);
      if (saved.status === 'SUBMITTED') {
        if (saved.report) setReport(saved.report);
        try { window.localStorage.removeItem('prepora-vpa-current'); } catch { /* storage may be disabled */ }
      }
    }).catch(() => { try { window.localStorage.removeItem('prepora-vpa-current'); } catch { /* storage may be disabled */ } }).finally(() => { if (mounted) setRestoring(false); });
    else setRestoring(false);
    return () => { mounted = false; };
  }, []);
  useEffect(() => { if (attempt?.status === 'SUBMITTED' && attempt.report) setReport(attempt.report); }, [attempt]);
  const begin = async () => {
    setBusy(true); setError(null);
    try {
      const next = await api.startVpa({ labId: 'ohms-law', chapterId: 'physics-current-electricity-ohms-law', mode, lessonId });
      try { window.localStorage.setItem('prepora-vpa-current', next.attemptId); } catch { /* storage may be disabled */ }
      setAttempt(next); setWires([]); setSelected(null); setReport(null); setVoltageIndex(0); setNotice(''); setCalculatedR(''); setSlope(''); setObservedVoltage(''); setObservedCurrent('');
    } catch (e) { setError(e as Error); } finally { setBusy(false); }
  };
  const connectPort = (port: Port) => {
    if (!selected) { setSelected(port); return; }
    if (selected === port) { setSelected(null); return; }
    const wire = normWire(selected, port);
    setWires((current) => current.includes(wire) ? current : [...current, wire]);
    setSelected(null); setNotice('');
  };
  const measure = async () => {
    if (!attempt) return;
    setBusy(true); setNotice('');
    try {
      const result = await api.measureVpa(attempt.attemptId, { wires: orderedWires, voltageIndex });
      if (!result.valid) setNotice(result.message ?? 'Check the connections and try again.');
      else {
        const fresh = await api.vpaAttempt(attempt.attemptId);
        setAttempt(fresh); setObservedVoltage(activeReading?.voltage.toFixed(2) ?? ''); setObservedCurrent(activeReading?.current.toFixed(2) ?? '');
        if (!activeReading) { setObservedVoltage(''); setObservedCurrent(''); }
        setNotice(result.alreadyRecorded ? 'Meters ready. Confirm or correct your observation below.' : 'Read both meters and enter the values to record this observation.');
      }
    } catch (e) { setError(e as Error); } finally { setBusy(false); }
  };
  const recordObservation = async () => {
    if (!attempt || !activeMeter || observedVoltage === '' || observedCurrent === '') return;
    setBusy(true); setNotice('');
    try {
      const result = await api.recordVpaObservation(attempt.attemptId, { wires: orderedWires, voltageIndex, observedVoltage: Number(observedVoltage), observedCurrent: Number(observedCurrent) });
      if (!result.recorded) setNotice(result.message ?? 'The observation could not be recorded.');
      else { setAttempt(await api.vpaAttempt(attempt.attemptId)); setNotice('Observation saved. Continue to the next voltage setting.'); }
    } catch (e) { setError(e as Error); } finally { setBusy(false); }
  };
  const submit = async () => {
    if (!attempt) return;
    setBusy(true); setError(null);
    try { const result = await api.submitVpa(attempt.attemptId, { wires: orderedWires, formula, calculatedResistance: Number(calculatedR) || 0, graphShape, graphSlope: Number(slope) || 0 }); setReport(result.report); setAttempt({ ...attempt, status: 'SUBMITTED', report: result.report }); try { window.localStorage.removeItem('prepora-vpa-current'); } catch { /* storage may be disabled */ } }
    catch (e) { setError(e as Error); } finally { setBusy(false); }
  };

  return <main className="mx-auto max-w-[1260px] px-4 pb-10 pt-4 sm:px-6">
    <header className="mb-5 flex items-center justify-between gap-3"><div><Link to="/lab/circuit" className="inline-flex items-center gap-1 text-sm font-medium text-[#527168] hover:text-[#174d43]"><ArrowLeft className="size-4" /> Circuit Bench</Link><p className="mt-2 text-xs font-bold uppercase tracking-[.17em] text-[#b95339]">Virtual practical assessment · Physics</p><h1 className="mt-1 text-2xl font-bold text-[#173f39] sm:text-3xl">Ohm’s law: build, measure, analyse</h1><p className="mt-1 text-sm text-[#687970]">Construct the circuit, collect three readings and determine the unknown resistance.</p></div><span className="hidden rounded-2xl bg-[#eaf0df] p-3 text-[#174d43] sm:block"><FlaskConical className="size-6" /></span></header>
    {error && <ErrorBox error={error} />}
    {restoring ? <section className="rounded-2xl border border-[#d8dfcf] bg-[#fffdf7] p-5"><Loading label="Restoring your practical" /></section> : !attempt ? <section className="rounded-2xl border border-[#d8dfcf] bg-[#fffdf7] p-5 shadow-sm sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr] lg:items-center"><div><p className="text-sm font-semibold text-[#174d43]">Choose how you want to work</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{(['INDEPENDENT', 'GUIDED'] as const).map((value) => <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`rounded-xl border p-4 text-left transition ${mode === value ? 'border-[#174d43] bg-[#edf2e5] shadow-sm' : 'border-[#e0e1d7] bg-[#fbfaf4] hover:border-[#b5c5b4]'}`}><span className="font-semibold text-[#173f39]">{value === 'INDEPENDENT' ? 'Independent assessment' : 'Guided lab'}</span><span className="mt-1 block text-sm leading-5 text-[#687970]">{value === 'INDEPENDENT' ? 'No step-by-step hints. Your procedure and decisions are scored.' : 'A concise apparatus checklist is available while you work.'}</span></button>)}</div></div><div className="rounded-xl bg-[#f5f5ec] p-4"><h2 className="font-semibold text-[#173f39]">Assessment brief</h2><p className="mt-1 text-sm leading-6 text-[#64736b]">Investigate an unknown resistor using a battery, an ammeter and a voltmeter. Record observations at three voltage settings, calculate R = V/I and interpret the V–I graph.</p><button type="button" onClick={begin} disabled={busy} className="mt-4 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#174d43] px-5 font-semibold text-[#e7f078] shadow-sm transition hover:bg-[#103d36] disabled:opacity-60">{busy ? 'Preparing task…' : 'Start practical'} <Zap className="size-4" /></button></div></div>
    </section> : <>
      <section className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d8dfcf] bg-[#fffdf7] px-4 py-3"><div><p className="text-xs font-bold uppercase tracking-[.12em] text-[#61746c]">Unknown resistance · randomized voltage settings</p><p className="mt-1 text-sm font-medium text-[#173f39]">{attempt.mode === 'GUIDED' ? 'Guided lab' : 'Independent assessment'} <span className="mx-1 text-[#a5aea4]">·</span> {readings.length}/3 readings recorded</p></div><button type="button" onClick={begin} disabled={busy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#d8dfcf] px-3 text-sm font-semibold text-[#527168] hover:bg-[#f4f5eb] disabled:opacity-50"><RotateCcw className="size-4" /> New attempt</button></section>
      {attempt.mode === 'GUIDED' && <aside className="mb-4 rounded-xl border border-[#e7d8b8] bg-[#fbf5e6] px-4 py-3 text-sm text-[#645a43]"><strong>Guided procedure:</strong> place the ammeter in series, connect the voltmeter across the resistor, record all three settings, then calculate resistance from the graph gradient.</aside>}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,.75fr)]">
        <section className="min-w-0 rounded-2xl border border-[#d8dfcf] bg-[#fffdf7] p-4 shadow-sm sm:p-5"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-bold text-[#173f39]">Build the circuit</h2><p className="text-sm text-[#687970]">Select two terminals to add a wire. Click a wire to remove it.</p></div><span className="rounded-full bg-[#f5e9df] px-3 py-1 text-xs font-semibold text-[#a34d37]">{wires.length} connections</span></div>
          <CircuitBoard wires={wires} selected={selected} onPort={connectPort} onRemove={(i) => setWires((current) => current.filter((_, k) => k !== i))} reading={activeMeter} />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f5f5ec] p-3"><label className="text-sm font-medium text-[#314d43]">Battery setting<select aria-label="Battery voltage setting" disabled={attempt.status !== 'IN_PROGRESS'} className="ml-2 h-10 rounded-lg border border-[#d8dfcf] bg-[#fffdf7] px-3 text-[#173f39]" value={voltageIndex} onChange={(e) => { setVoltageIndex(Number(e.target.value)); setNotice(''); setObservedVoltage(''); setObservedCurrent(''); }}>{attempt.voltageLevels.map((v, i) => <option key={v} value={i}>{v} V</option>)}</select></label><button type="button" onClick={measure} disabled={busy || attempt.status !== 'IN_PROGRESS' || activeMeter !== undefined} className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#174d43] px-4 font-semibold text-[#e7f078] hover:bg-[#103d36] disabled:cursor-not-allowed disabled:opacity-50"><Gauge className="size-4" /> {activeMeter ? 'Meters read' : 'Read meters'}</button></div>
          {notice && <p role="status" className={`mt-3 rounded-lg px-3 py-2 text-sm ${notice.startsWith('Circuit') ? 'bg-[#fff0e9] text-[#9d4431]' : 'bg-[#edf2e5] text-[#315b4d]'}`}>{notice}</p>}
          {activeMeter && <div className="mt-3 rounded-xl border border-[#d8dfcf] bg-[#fafaf4] p-3"><div className="grid grid-cols-2 gap-3" aria-live="polite"><div><p className="text-xs font-semibold uppercase tracking-wide text-[#738078]">Voltmeter</p><p className="mt-1 text-xl font-bold text-[#174d43]">{activeMeter.voltage.toFixed(2)} <small className="text-sm font-medium">V</small></p></div><div><p className="text-xs font-semibold uppercase tracking-wide text-[#738078]">Ammeter</p><p className="mt-1 text-xl font-bold text-[#b95339]">{activeMeter.current.toFixed(2)} <small className="text-sm font-medium">A</small></p></div></div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto]"><label className="text-xs font-semibold text-[#314d43]">Record voltage (V)<input type="number" inputMode="decimal" step="0.01" value={observedVoltage} onChange={(e) => setObservedVoltage(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[#d8dfcf] bg-white px-3 text-sm font-normal" placeholder="Read voltmeter" /></label><label className="text-xs font-semibold text-[#314d43]">Record current (A)<input type="number" inputMode="decimal" step="0.01" value={observedCurrent} onChange={(e) => setObservedCurrent(e.target.value)} className="mt-1 block h-10 w-full rounded-lg border border-[#d8dfcf] bg-white px-3 text-sm font-normal" placeholder="Read ammeter" /></label><button type="button" onClick={recordObservation} disabled={busy || observedVoltage === '' || observedCurrent === '' || attempt.status !== 'IN_PROGRESS'} className="self-end rounded-lg border border-[#b9cbb8] px-3 py-2.5 text-sm font-semibold text-[#174d43] hover:bg-[#edf2e5] disabled:opacity-50">{activeReading ? 'Update record' : 'Record values'}</button></div></div>}
        </section>
        <aside className="space-y-4"><section className="rounded-2xl border border-[#d8dfcf] bg-[#fffdf7] p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-[#173f39]">Observations</h2><span className="text-xs text-[#687970]">V–I table</span></div>{readings.length ? <div className="mt-3 overflow-hidden rounded-lg border border-[#e0e2d8]"><table className="w-full text-sm"><thead className="bg-[#f1f3e9] text-left text-xs text-[#62736a]"><tr><th className="px-3 py-2">Setting</th><th className="px-3 py-2">V (V)</th><th className="px-3 py-2">I (A)</th></tr></thead><tbody>{readings.slice().sort((a, b) => a.voltageIndex - b.voltageIndex).map((r) => <tr key={r.voltageIndex} className="border-t border-[#e6e7df]"><td className="px-3 py-2">{r.voltage} V</td><td className="px-3 py-2">{r.voltage.toFixed(2)}</td><td className="px-3 py-2">{r.current.toFixed(2)}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-[#78857e]">Your readings will appear here.</p>}</section>
          <section className="rounded-2xl border border-[#d8dfcf] bg-[#fffdf7] p-4 shadow-sm"><div className="flex items-center justify-between"><h2 className="font-bold text-[#173f39]">Your V–I graph</h2><span className="text-xs text-[#687970]">V against I</span></div><div className="mt-2"><ReadingGraph readings={readings} /></div></section></aside>
      </div>
      <section className="mt-4 rounded-2xl border border-[#d8dfcf] bg-[#fffdf7] p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold text-[#173f39]">Analysis & result</h2><p className="mt-1 text-sm text-[#687970]">Use your observations to calculate resistance and explain the graph.</p></div><span className="rounded-lg bg-[#f5f5ec] px-3 py-2 text-xs font-medium text-[#61746c]">Complete what you can for partial credit</span></div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><label className="text-sm font-semibold text-[#314d43]">Relationship<select className="mt-1 block h-10 w-full rounded-lg border border-[#d8dfcf] bg-[#fffdf7] px-3 font-normal" value={formula} onChange={(e) => setFormula(e.target.value as typeof formula)}><option value="V_OVER_I">R = V / I</option><option value="I_OVER_V">R = I / V</option><option value="V_TIMES_I">R = V × I</option></select></label><label className="text-sm font-semibold text-[#314d43]">Calculated resistance (Ω)<input inputMode="decimal" type="number" min="0" step="0.1" className="mt-1 block h-10 w-full rounded-lg border border-[#d8dfcf] bg-[#fffdf7] px-3 font-normal" value={calculatedR} onChange={(e) => setCalculatedR(e.target.value)} placeholder="e.g. 8.0" /></label><label className="text-sm font-semibold text-[#314d43]">Graph shape<select className="mt-1 block h-10 w-full rounded-lg border border-[#d8dfcf] bg-[#fffdf7] px-3 font-normal" value={graphShape} onChange={(e) => setGraphShape(e.target.value as typeof graphShape)}><option value="LINEAR_ORIGIN">Straight line through origin</option><option value="LINEAR_OFFSET">Straight line, not through origin</option><option value="CURVED">Curved</option><option value="NO_RELATION">No clear relationship</option></select></label><label className="text-sm font-semibold text-[#314d43]">Graph gradient (Ω)<input inputMode="decimal" type="number" min="0" step="0.1" className="mt-1 block h-10 w-full rounded-lg border border-[#d8dfcf] bg-[#fffdf7] px-3 font-normal" value={slope} onChange={(e) => setSlope(e.target.value)} placeholder="gradient of V against I" /></label></div>
        {attempt.status === 'IN_PROGRESS' ? <button type="button" onClick={submit} disabled={busy} className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#b95339] px-5 font-semibold text-white shadow-sm hover:bg-[#a64731] disabled:opacity-50">Submit for assessment <Check className="size-4" /></button> : <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-[#174d43]"><Check className="size-4" /> Attempt submitted. Your scorecard is below.</p>}
      </section>
      {report && <Scorecard report={report} />}
    </>}
  </main>;
}
