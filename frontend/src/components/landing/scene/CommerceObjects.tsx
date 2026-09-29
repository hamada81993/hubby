'use client';

import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';

type Vec3 = [number, number, number];
const mint = '#b9e995';
const dark = '#164f43';

export function Block({ size, at = [0, 0, 0], color = mint, radius = 0.035, metal = false }: { size: Vec3; at?: Vec3; color?: string; radius?: number; metal?: boolean }) {
  return <RoundedBox args={size} position={at} radius={radius} smoothness={2}>
    <meshStandardMaterial color={color} roughness={metal ? 0.28 : 0.5} metalness={metal ? 0.65 : 0.08} />
  </RoundedBox>;
}

export function Pipe({ points, radius = 0.04, color = mint }: { points: Vec3[]; radius?: number; color?: string }) {
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), [points]);
  return <mesh><tubeGeometry args={[curve, 32, radius, 8, false]} /><meshStandardMaterial color={color} metalness={0.3} roughness={0.3} /></mesh>;
}

export function Parcel({ position, rotation = [0, 0, 0], scale = 1, color = '#e9e8cd', open = false }: { position: Vec3; rotation?: Vec3; scale?: number; color?: string; open?: boolean }) {
  return <group position={position} rotation={rotation} scale={scale}>
    <Block size={[1.05, 0.85, 0.9]} color={color} />
    <Block size={[0.17, 0.854, 0.912]} color="#f3e9c9" radius={0.005} />
    <Block size={[0.35, 0.26, 0.008]} at={[0.27, -0.13, 0.456]} color="#f8f6e8" radius={0.006} />
    {Array.from({ length: 9 }, (_, i) => <mesh key={i} position={[0.15 + i * 0.028, -0.13, 0.465]}><planeGeometry args={[i % 3 ? 0.012 : 0.019, 0.13]} /><meshBasicMaterial color={dark} /></mesh>)}
    <Block size={[0.13, 0.024, 0.009]} at={[-0.31, 0.18, 0.457]} color={dark} radius={0.004} />
    <Block size={[0.024, 0.12, 0.009]} at={[-0.31, 0.15, 0.457]} color={dark} radius={0.004} />
    {open && <group position={[0, 0.44, 0]}>
      <Block size={[0.91, 0.015, 0.77]} color="#8a704b" radius={0.004} />
      <group position={[-0.51, 0, 0]} rotation={[0, 0, -0.65]}><Block size={[0.42, 0.035, 0.9]} at={[-0.2, 0, 0]} color={color} radius={0.008} /></group>
      <group position={[0.51, 0, 0]} rotation={[0, 0, 0.65]}><Block size={[0.42, 0.035, 0.9]} at={[0.2, 0, 0]} color={color} radius={0.008} /></group>
    </group>}
  </group>;
}

function Product({ at, color, bottle = false }: { at: Vec3; color: string; bottle?: boolean }) {
  return <group position={at}>
    {bottle ? <>
      <mesh position={[0, 0.11, 0]}><cylinderGeometry args={[0.065, 0.065, 0.22, 12]} /><meshStandardMaterial color={color} roughness={0.25} metalness={0.2} /></mesh>
      <mesh position={[0, 0.25, 0]}><cylinderGeometry args={[0.035, 0.035, 0.065, 10]} /><meshStandardMaterial color={dark} /></mesh>
    </> : <Block size={[0.13, 0.21, 0.12]} at={[0, 0.105, 0]} color={color} radius={0.015} />}
    <Block size={[0.07, 0.065, 0.01]} at={[0, 0.12, 0.065]} color="#f7f1de" radius={0.003} />
  </group>;
}

function StoreInterior() {
  return <group>
    <Block size={[1.76, 1.65, 0.08]} at={[0, -0.04, -0.39]} color="#407666" />
    <Block size={[1.8, 0.09, 0.85]} at={[0, -0.84, -0.04]} color="#e7e7c8" />
    {[-0.55, -0.02, 0.5].map(y => <group key={y} position={[0, y, -0.16]}>
      <Block size={[1.6, 0.045, 0.35]} color="#d5dcae" radius={0.008} />
      {[-0.6, -0.34, 0.22, 0.49].map((x, i) => <Product key={x} at={[x, 0.025, 0]} color={['#eaaa72', '#b9dd80', '#f1e5c7', '#8dc0b0'][i]} bottle={i % 2 === 0} />)}
    </group>)}
    <Block size={[0.4, 0.7, 0.34]} at={[0.54, -0.49, 0.24]} color="#74ac83" />
    <Block size={[0.49, 0.07, 0.43]} at={[0.54, -0.105, 0.24]} color="#f0eed4" />
    <group position={[0.54, 0.02, 0.23]} rotation={[-0.35, 0, 0]}>
      <Block size={[0.21, 0.16, 0.035]} color={dark} radius={0.015} />
      <Block size={[0.17, 0.11, 0.006]} at={[0, 0, 0.021]} color="#a8f69c" radius={0.005} />
    </group>
    {/* Striped canopy, scalloped valance and side supports. */}
    {Array.from({ length: 9 }, (_, i) => <group key={i} position={[-0.8 + i * 0.2, 0.62, 0.23]}>
      <group rotation={[0.2, 0, 0]}><Block size={[0.196, 0.08, 0.6]} color={i % 2 ? '#f3efd3' : '#40895d'} radius={0.012} /></group>
      <Block size={[0.196, 0.17, 0.075]} at={[0, -0.1, 0.29]} color={i % 2 ? '#f3efd3' : '#40895d'} radius={0.035} />
    </group>)}
    {[-0.8, 0.8].map(x => <Block key={x} size={[0.035, 1.45, 0.035]} at={[x, -0.12, 0.48]} color="#dfdda7" radius={0.008} metal />)}
  </group>;
}

function PortalFrame() {
  const shape = useMemo(() => {
    const frame = new THREE.Shape();
    frame.moveTo(-0.91, -1.2); frame.lineTo(0.91, -1.2);
    frame.quadraticCurveTo(1.1, -1.2, 1.1, -1.01); frame.lineTo(1.1, 1.01);
    frame.quadraticCurveTo(1.1, 1.2, 0.91, 1.2); frame.lineTo(-0.91, 1.2);
    frame.quadraticCurveTo(-1.1, 1.2, -1.1, 1.01); frame.lineTo(-1.1, -1.01);
    frame.quadraticCurveTo(-1.1, -1.2, -0.91, -1.2);
    const opening = new THREE.Path();
    opening.moveTo(-0.84, -0.88); opening.lineTo(-0.84, 0.73); opening.lineTo(0.84, 0.73); opening.lineTo(0.84, -0.88); opening.closePath();
    frame.holes.push(opening);
    return frame;
  }, []);
  return <mesh position={[0, 0, -0.42]}>
    <extrudeGeometry args={[shape, { depth: 0.78, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.045, bevelThickness: 0.04, curveSegments: 10 }]} />
    <meshPhysicalMaterial color={mint} roughness={0.3} metalness={0.16} clearcoat={0.4} />
  </mesh>;
}

export function CommercePortal() {
  return <group rotation={[0.04, -0.25, -0.08]}>
    <PortalFrame /><StoreInterior />
    {[-0.25, 0.27].map(z => <Pipe key={z} color="#d9f6b0" radius={0.057} points={[[-0.62, 1.19, z], [-0.59, 1.71, z], [0, 1.98, z], [0.59, 1.71, z], [0.62, 1.19, z]]} />)}
    {[-0.65, 0.65].map(x => <mesh key={x} position={[x, 1.08, 0.425]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.047, 0.047, 0.016, 16]} /><meshStandardMaterial color="#d4e6a3" metalness={0.7} roughness={0.2} /></mesh>)}
    <Block size={[0.63, 0.16, 0.025]} at={[0, 0.99, 0.43]} color={dark} radius={0.06} />
    {[0, 1, 2, 3, 4].map(i => <Block key={i} size={[0.045, 0.015, 0.01]} at={[-0.18 + i * 0.09, 0.99, 0.45]} color="#d0eea1" radius={0.002} />)}
    {Array.from({ length: 13 }, (_, i) => <Block key={i} size={[0.022, 0.008, 0.007]} at={[-0.78 + i * 0.13, -1.06, 0.42]} color="#6d9b62" radius={0.002} />)}
    <group position={[1.15, 0.44, 0.1]} rotation={[0.1, -0.2, -0.28]}>
      <Pipe radius={0.017} color="#dddeaa" points={[[-0.12, 0.75, 0], [0.1, 0.7, 0], [0.17, 0.35, 0]]} />
      <Block size={[0.39, 0.58, 0.06]} color="#f2b075" radius={0.04} />
      <mesh position={[0, 0.17, 0.036]}><ringGeometry args={[0.027, 0.04, 16]} /><meshStandardMaterial color={dark} /></mesh>
      <Block size={[0.23, 0.09, 0.015]} at={[0, -0.04, 0.039]} color="#f5e3ba" radius={0.008} />
      <Block size={[0.14, 0.025, 0.015]} at={[0, -0.14, 0.039]} color={dark} radius={0.003} />
    </group>
  </group>;
}

export function FulfilmentIsland({ motion }: { motion: boolean }) {
  const packageRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (packageRef.current) packageRef.current.position.x = motion ? Math.sin(clock.elapsedTime * 0.5) * 0.85 : 0.35;
  });
  return <group position={[0, -2.13, 0]} rotation={[0.06, -0.15, 0]}>
    <Block size={[3.8, 0.23, 2.35]} color="#307563" radius={0.1} />
    <Block size={[3.61, 0.055, 2.16]} at={[0, 0.15, 0]} color="#8cb08b" radius={0.09} />
    {/* Recessed conveyor belt with visible individual metal rollers. */}
    <Block size={[3.05, 0.15, 0.72]} at={[0, 0.28, 0.72]} color={dark} />
    {Array.from({ length: 16 }, (_, i) => <mesh key={i} position={[-1.4 + i * 0.185, 0.38, 0.72]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.067, 0.067, 0.63, 10]} /><meshStandardMaterial color={i % 2 ? '#759e8b' : '#c3d9ba'} metalness={0.65} roughness={0.28} /></mesh>)}
    {[-1, 1].map(side => <Block key={side} size={[3.18, 0.09, 0.05]} at={[0, 0.41, 0.72 + side * 0.38]} color="#d6e7af" metal radius={0.012} />)}
    <group ref={packageRef}><Parcel position={[0, 0.67, 0.72]} scale={0.53} color="#d7ad7b" /></group>
    {/* Stepped loading dock. */}
    {[0, 1, 2, 3].map(i => <Block key={i} size={[0.6, 0.09 + i * 0.085, 0.25]} at={[-1.62, -0.01 + i * 0.043, -0.62 + i * 0.23]} color="#b9cda1" radius={0.012} />)}
    {/* Scanner arch and signal lights. */}
    {[-0.36, 0.36].map(z => <Block key={z} size={[0.07, 0.87, 0.07]} at={[1.04, 0.81, 0.72 + z]} color="#497568" metal radius={0.012} />)}
    <Block size={[0.11, 0.09, 0.83]} at={[1.04, 1.28, 0.72]} color="#b7dca4" radius={0.015} />
    <mesh position={[1.04, 1.08, 0.72]}><boxGeometry args={[0.018, 0.36, 0.65]} /><meshBasicMaterial color="#b6ff9c" transparent opacity={0.13} depthWrite={false} /></mesh>
    {[-1, 1].map(side => <group key={side} position={[side * 1.62, 0.15, -0.74]}>
      <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.14, 0.1, 0.27, 16]} /><meshStandardMaterial color="#e6c393" /></mesh>
      {[0, 1, 2, 3, 4].map(i => <mesh key={i} position={[Math.sin(i * 2.4) * 0.12, 0.35 + i * 0.07, Math.cos(i * 2.4) * 0.09]} rotation={[0.3, i * 1.3, 0.35]} scale={[0.07, 0.23, 0.025]}><sphereGeometry args={[1, 10, 10]} /><meshStandardMaterial color={i % 2 ? '#b7d894' : '#528463'} /></mesh>)}
    </group>)}
  </group>;
}
