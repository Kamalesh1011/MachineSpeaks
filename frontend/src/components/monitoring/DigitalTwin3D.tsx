import { useRef, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Float, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { type DeviceType, type DeviceMetrics } from "@/data/simulatedData";

function tempToColor(temp: number): string {
  if (temp < 40) return "#10b981";
  if (temp < 60) return "#3b82f6";
  if (temp < 75) return "#f59e0b";
  if (temp < 85) return "#ef4444";
  return "#dc2626";
}

function ServerModel({ metrics }: { metrics: DeviceMetrics }) {
  const groupRef = useRef<THREE.Group>(null);
  const cpuColor = useMemo(() => tempToColor(metrics.cpuTemp), [metrics.cpuTemp]);
  const gpuColor = useMemo(() => tempToColor(metrics.gpuTemp), [metrics.gpuTemp]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Server chassis */}
      <RoundedBox args={[2.4, 3.2, 1.2]} radius={0.08} smoothness={4} position={[0, 0, 0]}>
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </RoundedBox>

      {/* Front panel */}
      <RoundedBox args={[2.2, 3.0, 0.05]} radius={0.04} smoothness={4} position={[0, 0, 0.63]}>
        <meshStandardMaterial color="#0a0a0a" metalness={0.5} roughness={0.5} />
      </RoundedBox>

      {/* Drive bays */}
      {[-0.8, -0.3, 0.2, 0.7].map((y, i) => (
        <group key={i} position={[0, y, 0.66]}>
          <RoundedBox args={[1.8, 0.35, 0.02]} radius={0.02} smoothness={2}>
            <meshStandardMaterial color="#111" metalness={0.6} roughness={0.4} />
          </RoundedBox>
          {/* Activity LED */}
          <mesh position={[0.75, 0, 0.02]}>
            <sphereGeometry args={[0.04, 8, 8]} />
            <meshStandardMaterial
              color={i < 2 ? "#10b981" : "#333"}
              emissive={i < 2 ? "#10b981" : "#000"}
              emissiveIntensity={i < 2 ? 0.8 : 0}
            />
          </mesh>
        </group>
      ))}

      {/* CPU heat zone */}
      <mesh position={[-0.4, -1.2, 0]}>
        <boxGeometry args={[0.7, 0.5, 0.8]} />
        <meshStandardMaterial
          color={cpuColor}
          emissive={cpuColor}
          emissiveIntensity={0.3}
          transparent
          opacity={0.6}
        />
      </mesh>
      <Text position={[-0.4, -0.85, 0.67]} fontSize={0.12} color="#888" anchorX="center">
        CPU {Math.round(metrics.cpuTemp)}°C
      </Text>

      {/* GPU heat zone */}
      <mesh position={[0.4, -1.2, 0]}>
        <boxGeometry args={[0.7, 0.5, 0.8]} />
        <meshStandardMaterial
          color={gpuColor}
          emissive={gpuColor}
          emissiveIntensity={metrics.gpuTemp > 0 ? 0.3 : 0}
          transparent
          opacity={metrics.gpuTemp > 0 ? 0.6 : 0.1}
        />
      </mesh>
      {metrics.gpuTemp > 0 && (
        <Text position={[0.4, -0.85, 0.67]} fontSize={0.12} color="#888" anchorX="center">
          GPU {Math.round(metrics.gpuTemp)}°C
        </Text>
      )}

      {/* Power indicator */}
      <mesh position={[0, 1.35, 0.66]}>
        <sphereGeometry args={[0.05, 8, 8]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1} />
      </mesh>

      {/* Fan grills on top */}
      {[-0.5, 0.5].map((x, i) => (
        <FanGrill key={i} position={[x, 1.61, 0]} rpm={metrics.fanSpeed} />
      ))}
    </group>
  );
}

function FanGrill({ position, rpm }: { position: [number, number, number]; rpm: number }) {
  const ref = useRef<THREE.Mesh>(null);
  const speed = rpm / 1000;

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.z += delta * speed * 4;
    }
  });

  return (
    <group position={position}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.35, 0.35, 0.05, 16]} />
        <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh ref={ref} position={[0, 0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        {/* Fan blades */}
        <cylinderGeometry args={[0.28, 0.28, 0.02, 4]} />
        <meshStandardMaterial color="#333" metalness={0.5} roughness={0.5} wireframe />
      </mesh>
    </group>
  );
}

function MotorModel({ metrics }: { metrics: DeviceMetrics }) {
  const groupRef = useRef<THREE.Group>(null);
  const shaftRef = useRef<THREE.Mesh>(null);
  const bodyColor = useMemo(() => tempToColor(metrics.cpuTemp), [metrics.cpuTemp]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
    if (shaftRef.current) {
      shaftRef.current.rotation.x += delta * 3;
    }
  });

  return (
    <group ref={groupRef}>
      {/* Motor body */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.9, 0.9, 2.2, 24]} />
        <meshStandardMaterial color="#222" metalness={0.85} roughness={0.25} />
      </mesh>
      {/* Heat glow */}
      <mesh rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.92, 0.92, 2.0, 24]} />
        <meshStandardMaterial color={bodyColor} emissive={bodyColor} emissiveIntensity={0.2} transparent opacity={0.3} />
      </mesh>
      {/* Shaft */}
      <mesh ref={shaftRef} position={[1.5, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.15, 0.15, 1.2, 12]} />
        <meshStandardMaterial color="#555" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* End caps */}
      {[-1.1, 1.1].map((x, i) => (
        <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.95, 0.85, 0.15, 24]} />
          <meshStandardMaterial color="#1a1a1a" metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      {/* Cooling fins */}
      {Array.from({ length: 8 }, (_, i) => {
        const angle = (i / 8) * Math.PI * 2;
        return (
          <mesh key={i} position={[0, Math.sin(angle) * 0.95, Math.cos(angle) * 0.95]} rotation={[angle, 0, 0]}>
            <boxGeometry args={[1.8, 0.03, 0.12]} />
            <meshStandardMaterial color="#2a2a2a" metalness={0.7} roughness={0.3} />
          </mesh>
        );
      })}
      <Text position={[0, -1.4, 0]} fontSize={0.15} color="#666" anchorX="center">
        {Math.round(metrics.cpuTemp)}°C | {metrics.vibration.toFixed(1)}g
      </Text>
    </group>
  );
}

function GenericModel({ metrics }: { metrics: DeviceMetrics }) {
  const groupRef = useRef<THREE.Group>(null);
  const color = useMemo(() => tempToColor(metrics.cpuTemp), [metrics.cpuTemp]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.3) * 0.15;
    }
  });

  return (
    <group ref={groupRef}>
      <RoundedBox args={[2, 1.5, 1.5]} radius={0.1} smoothness={4}>
        <meshStandardMaterial color="#1a1a1a" metalness={0.7} roughness={0.3} />
      </RoundedBox>
      <mesh position={[0, 0, 0.76]}>
        <planeGeometry args={[1.6, 1.1]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.15} transparent opacity={0.4} />
      </mesh>
      <mesh position={[0.7, 0.55, 0.76]}>
        <sphereGeometry args={[0.04, 8, 8]} />
        <meshStandardMaterial color="#10b981" emissive="#10b981" emissiveIntensity={1} />
      </mesh>
    </group>
  );
}

interface DigitalTwin3DProps {
  deviceType: DeviceType;
  metrics: DeviceMetrics;
}

export function DigitalTwin3D({ deviceType, metrics }: DigitalTwin3DProps) {
  const ModelComponent = deviceType === 'server' || deviceType === 'gpu-workstation'
    ? ServerModel
    : deviceType === 'industrial-motor'
    ? MotorModel
    : GenericModel;

  return (
    <div className="w-full h-full rounded-xl overflow-hidden bg-gradient-to-b from-card to-background">
      <Canvas
        camera={{ position: [3, 2, 4], fov: 40 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <color attach="background" args={['#050505']} />
        <fog attach="fog" args={['#050505', 8, 16]} />

        {/* Lighting */}
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 5, 5]} intensity={0.4} color="#fff" />
        <directionalLight position={[-3, 3, -3]} intensity={0.2} color="#10b981" />
        <pointLight position={[0, 3, 0]} intensity={0.3} color="#fff" />

        {/* Grid floor */}
        <gridHelper args={[10, 20, '#1a1a1a', '#0d0d0d']} position={[0, -2, 0]} />

        <Float speed={1} rotationIntensity={0.1} floatIntensity={0.3}>
          <ModelComponent metrics={metrics} />
        </Float>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          minDistance={3}
          maxDistance={8}
          autoRotate={false}
          maxPolarAngle={Math.PI / 1.8}
        />
      </Canvas>
    </div>
  );
}
