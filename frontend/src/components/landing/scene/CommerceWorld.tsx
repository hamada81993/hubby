'use client';

import { Component, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Parcel, Pipe } from './CommerceObjects';
import { ChannelDistrict, FulfilmentDistrict, StoreDistrict } from './JourneyDistricts';

type WorldProps = { progress: RefObject<number>; motion: boolean; rtl: boolean };
const stations: [number, number, number][] = [[0, 0, 0], [17, -2, -7], [34, 1, -15]];
const ease = (value: number, from: number, to: number) => THREE.MathUtils.smootherstep(value, from, to);

function World({ progress, motion, rtl }: WorldProps) {
  const { camera, size, invalidate } = useThree();
  const compact = size.width <= 700;
  const travel = useRef(0);
  const cargo = useRef<THREE.Group>(null);
  const network = useRef<THREE.Group>(null);
  const city = useRef<THREE.Group>(null);
  const gateways = useRef<THREE.Group>(null);
  const scratch = useMemo(() => ({ target: new THREE.Vector3(), eye: new THREE.Vector3() }), []);
  const paths = useMemo(() => [
    new THREE.CatmullRomCurve3([new THREE.Vector3(...stations[0]), new THREE.Vector3(8, 1.5, -2), new THREE.Vector3(...stations[1])]),
    new THREE.CatmullRomCurve3([new THREE.Vector3(...stations[1]), new THREE.Vector3(25, -0.5, -13), new THREE.Vector3(...stations[2])]),
  ], []);

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;
    // Shift the composition without rotating/mirroring the models or putting them behind the copy.
    camera.setViewOffset(size.width, size.height, compact ? 0 : size.width * (rtl ? 0.23 : -0.23), compact ? size.height * 0.24 : 0, size.width, size.height);
    camera.updateProjectionMatrix();
    invalidate();
    return () => { camera.clearViewOffset(); };
  }, [camera, size.width, size.height, compact, rtl, invalidate]);

  useFrame((_, delta) => {
    // Every large movement is tied to scroll, so stopping and reversing scroll is predictable.
    travel.current = THREE.MathUtils.damp(travel.current, motion ? progress.current : 0, 8, Math.min(delta, 0.05));
    const p = travel.current;
    const first = ease(p, 0.08, 0.45), second = ease(p, 0.58, 0.96);
    if (p < 0.5) paths[0].getPoint(first, scratch.target);
    else paths[1].getPoint(second, scratch.target);
    const distance = compact ? Math.max(12, 3.65 / (Math.tan(THREE.MathUtils.degToRad(43 / 2)) * size.width / size.height)) : 11.8;
    const orbit = first * 0.45 - second * 0.85;
    const transit = Math.sin(first * Math.PI) + Math.sin(second * Math.PI);
    if (gateways.current) {
      gateways.current.visible = transit > 0.005;
      gateways.current.traverse(object => {
        if (object instanceof THREE.Mesh) {
          const material = object.material as THREE.MeshStandardMaterial;
          material.transparent = true;
          material.opacity = Math.min(1, transit * 2);
          material.depthWrite = material.opacity > 0.95;
        }
      });
    }
    scratch.eye.set(Math.sin(orbit) * distance, 2.4 + first * 1.8 + transit * 1.4, Math.cos(orbit) * distance - transit * 1.8).add(scratch.target);
    camera.position.copy(scratch.eye);
    camera.lookAt(scratch.target);
    if (network.current) {
      network.current.rotation.y = (1 - first) * -0.75 + second * 0.55;
      network.current.scale.setScalar(0.65 + first * 0.35);
    }
    if (city.current) {
      city.current.position.y = stations[2][1] - (1 - second) * 3;
      city.current.rotation.y = (1 - second) * 0.65;
    }
    if (cargo.current) {
      const route = p < 0.5 ? first : second;
      (p < 0.5 ? paths[0] : paths[1]).getPoint(Math.min(1, route + 0.12), cargo.current.position);
      cargo.current.position.y += 1.5;
      cargo.current.rotation.set(route * 0.7, route * Math.PI, route * 0.2);
      cargo.current.visible = transit > 0.12;
    }
  });

  return <>
    <ambientLight intensity={1.25} color="#d3edc3" />
    <directionalLight position={[-3, 7, 6]} intensity={3.5} color="#f8ffdf" />
    <directionalLight position={[5, 2, -3]} intensity={4} color="#bcff93" />
    <group position={stations[0]}><StoreDistrict /></group>
    <group ref={network} position={stations[1]}><ChannelDistrict /></group>
    <group ref={city} position={stations[2]}><FulfilmentDistrict motion={motion} /></group>
    <group ref={cargo}><Parcel position={[0, 0, 0]} scale={0.65} color="#e9ae79" /><Parcel position={[-0.8, -0.6, -0.5]} scale={0.35} /></group>
    {/* Continuous transport lines and gateway arches establish a world between the destinations. */}
    <group ref={gateways}>{[0, 1].map(leg => <group key={leg}>
      <Pipe points={[[stations[leg][0], stations[leg][1] - 2, stations[leg][2]], [stations[leg][0] + 8, -2, stations[leg][2] - 3], [stations[leg + 1][0], stations[leg + 1][1] - 2, stations[leg + 1][2]]]} radius={0.075} color="#82b68a" />
      {[0, 1, 2, 3].map(i => <group key={i} position={[stations[leg][0] + 5 + i * 2.4, -0.3, stations[leg][2] - 2 - i]} rotation={[0.2, Math.PI / 2.8, -0.1]}>
        <mesh><torusGeometry args={[1.6 + i * 0.12, 0.065, 8, 48]} /><meshStandardMaterial color={i % 2 ? '#d7e7b2' : '#72ab83'} roughness={0.3} metalness={0.3} /></mesh>
        <mesh position={[0, 1.65 + i * 0.12, 0]}><icosahedronGeometry args={[0.17, 0]} /><meshStandardMaterial color="#efb482" /></mesh>
      </group>)}
    </group>)}</group>
  </>;
}

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? null : this.props.children; }
}

export default function CommerceWorld(props: WorldProps) {
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  const [lost, setLost] = useState(false);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (holder.current) observer.observe(holder.current);
    return () => observer.disconnect();
  }, []);
  return <div ref={holder} style={{ position: 'absolute', inset: 0 }}>
    {!lost && <SceneBoundary><Canvas
      dpr={[1, 1.5]} camera={{ position: [0, 2.4, 11.8], fov: 43 }}
      frameloop={props.motion && visible ? 'always' : 'demand'}
      gl={{ alpha: true, antialias: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => { gl.domElement.addEventListener('webglcontextlost', () => setLost(true), { once: true }); }}
      fallback={<span />}
    ><World {...props} /></Canvas></SceneBoundary>}
  </div>;
}
