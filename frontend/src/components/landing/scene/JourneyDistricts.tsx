'use client';

import { Block, CommercePortal, FulfilmentIsland, Parcel, Pipe } from './CommerceObjects';

export function Plinth({ radius = 2.8 }: { radius?: number }) {
  return <group position={[0, -1.9, 0]}>
    <mesh><cylinderGeometry args={[radius, radius * 0.86, 0.35, 64]} /><meshStandardMaterial color="#3b8871" roughness={0.4} metalness={0.2} /></mesh>
    <mesh position={[0, 0.19, 0]}><cylinderGeometry args={[radius * 0.98, radius * 0.98, 0.045, 64]} /><meshStandardMaterial color="#a7c799" /></mesh>
    <mesh position={[0, -0.21, 0]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[radius * 0.9, 0.06, 8, 64]} /><meshStandardMaterial color="#c2f485" emissive="#679b38" emissiveIntensity={0.25} /></mesh>
  </group>;
}

function Tree({ x, z }: { x: number; z: number }) {
  return <group position={[x, -1.65, z]}>
    <Block size={[0.1, 0.7, 0.1]} at={[0, 0.3, 0]} color="#e8c197" />
    {[0, 1, 2].map(i => <mesh key={i} position={[0, 0.65 + i * 0.23, 0]}><coneGeometry args={[0.4 - i * 0.08, 0.65, 7]} /><meshStandardMaterial color={i % 2 ? '#b9dd81' : '#73ac7a'} /></mesh>)}
  </group>;
}

export function StoreDistrict() {
  return <group>
    <Plinth />
    <group position={[0, -0.35, 0]}><CommercePortal /></group>
    <group position={[-1.9, -0.6, -0.9]} rotation={[0, 0.4, 0]} scale={0.45}><CommercePortal /></group>
    <Parcel position={[1.85, -1.25, 0.6]} scale={0.8} open color="#edac7b" />
    <Parcel position={[-1.5, -1.4, 1.25]} scale={0.55} />
    <Tree x={1.75} z={-1.25} /><Tree x={-1.7} z={-1.6} />
    <Pipe points={[[-2.3, -1.65, 0.2], [-1.9, -1.65, 1.9], [0.4, -1.65, 2.2], [2.4, -1.65, 0.8]]} radius={0.055} color="#eff1c4" />
  </group>;
}

function Channel({ color }: { color: string }) {
  return <group>
    <Block size={[0.85, 1.25, 0.2]} color="#e5e8cb" radius={0.08} />
    <Block size={[0.7, 0.85, 0.025]} at={[0, 0.06, 0.12]} color={color} />
    <Block size={[0.25, 0.04, 0.03]} at={[0, -0.51, 0.12]} color="#28695c" />
    <group position={[0, 0.05, 0.2]} scale={0.37}><Parcel position={[0, 0, 0]} color="#eff0d5" /></group>
    {[0, 1, 2, 3, 4].map(i => <Block key={i} size={[0.168, 0.12, 0.35]} at={[-0.336 + i * 0.168, 0.54, 0.19]} color={i % 2 ? '#f1f0d5' : color} />)}
  </group>;
}

export function ChannelDistrict() {
  return <group>
    <Plinth radius={3.1} />
    <mesh position={[0, -0.7, 0]}><cylinderGeometry args={[0.87, 1.05, 1.9, 8]} /><meshStandardMaterial color="#286d5c" roughness={0.3} metalness={0.3} /></mesh>
    <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.9, 0.9, 0.16, 48]} /><meshStandardMaterial color="#d1f897" /></mesh>
    <Block size={[0.13, 0.68, 0.13]} at={[-0.2, 0.7, 0]} color="#f0f3cd" />
    <Block size={[0.13, 0.68, 0.13]} at={[0.2, 0.7, 0]} color="#f0f3cd" />
    <Block size={[0.45, 0.12, 0.13]} at={[0, 0.7, 0]} color="#f0f3cd" />
    {Array.from({ length: 7 }, (_, i) => {
      const a = i / 7 * Math.PI * 2;
      const x = Math.sin(a) * 2.3, z = Math.cos(a) * 2.3;
      return <group key={i}>
        <Pipe points={[[0, -1.65, 0], [x * 0.55, -1.65, z * 0.55], [x, -1.65, z], [x, -0.6, z]]} radius={0.045} color="#c9ef9a" />
        <group position={[x, -0.15 + (i % 2) * 0.6, z]} rotation={[0, a * 0.22, 0]}><Channel color={['#e9aa76', '#639e8a', '#b0d874'][i % 3]} /></group>
      </group>;
    })}
    <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 2, 0.12, 0]}><torusGeometry args={[2.65, 0.025, 6, 80]} /><meshStandardMaterial color="#a3d597" /></mesh>
  </group>;
}

export function FulfilmentDistrict({ motion }: { motion: boolean }) {
  return <group>
    <Plinth radius={3.2} />
    <group position={[-0.35, 0.42, 0.75]} scale={1.12}><FulfilmentIsland motion={motion} /></group>
    <group position={[-0.7, -0.65, -1]}>
      <Block size={[2.25, 1.85, 1.1]} color="#7faa8a" radius={0.07} />
      <Block size={[2.45, 0.18, 1.35]} at={[0, 1, 0]} color="#dbe6ad" />
      {[-0.7, 0, 0.7].map(x => <group key={x} position={[x, -0.2, 0.56]}>
        <Block size={[0.56, 1.15, 0.04]} color="#234f45" />
        {[0, 1, 2, 3, 4].map(i => <Block key={i} size={[0.48, 0.035, 0.035]} at={[0, -0.45 + i * 0.2, 0.035]} color="#7ba48a" />)}
      </group>)}
      <Block size={[1.2, 0.18, 0.06]} at={[0, 0.69, 0.57]} color="#b9ec85" />
    </group>
    {[0, 1, 2].map(i => <group key={i} position={[1.05 + i * 0.57, -1.65, -1.1]}>
      <Block size={[0.43, 1.6 + i * 0.6, 0.55]} at={[0, 0.8 + i * 0.3, 0]} color={['#81b37d', '#abd585', '#d5eea0'][i]} />
      {[0, 1, 2, 3].map(j => <Block key={j} size={[0.23, 0.06, 0.02]} at={[0, 0.4 + j * 0.32, 0.285]} color="#4f8a68" />)}
    </group>)}
    <Parcel position={[-2.25, -1.1, -0.55]} scale={0.7} color="#e7b17d" />
    <Parcel position={[-2.25, -0.58, -0.55]} scale={0.48} />
    <group position={[1.9, -1.22, 1.75]} rotation={[0, -0.3, 0]}>
      <Block size={[0.94, 0.62, 0.6]} color="#e6b27b" />
      <Block size={[0.48, 0.5, 0.6]} at={[0.69, -0.06, 0]} color="#c8eea0" />
      <Block size={[0.25, 0.21, 0.62]} at={[0.72, 0.03, 0]} color="#286c5d" />
      {[-0.3, 0.65].flatMap(x => [-0.32, 0.32].map(z => <mesh key={`${x}-${z}`} position={[x, -0.32, z]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[0.17, 0.17, 0.1, 12]} /><meshStandardMaterial color="#163f36" /></mesh>))}
    </group>
  </group>;
}
