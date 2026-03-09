export type DeviceType = 'server' | 'gpu-workstation' | 'industrial-motor' | 'cnc-machine' | 'network-switch' | 'fan-pump';
export type DeviceStatus = 'healthy' | 'warning' | 'critical' | 'offline';

export interface DeviceMetrics {
  cpuUtil: number;
  memoryUtil: number;
  memoryUsedGB: number;
  memoryTotalGB: number;
  gpuUtil: number;
  gpuMemory: number;
  cpuTemp: number;
  gpuTemp: number;
  mbTemp: number;
  fanSpeed: number;
  powerWatts: number;
  diskReadMBs: number;
  diskWriteMBs: number;
  netUpMBs: number;
  netDownMBs: number;
  vibration: number;
  uptimeHours: number;
}

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  location: string;
  ip: string;
  status: DeviceStatus;
  healthScore: number;
  lastSeen: string;
  metrics: DeviceMetrics;
}

export interface Alert {
  id: string;
  deviceId: string;
  deviceName: string;
  severity: 'critical' | 'warning' | 'info';
  metric: string;
  value: string;
  threshold: string;
  message: string;
  timestamp: string;
  status: 'active' | 'acknowledged' | 'resolved';
}

const baseDevices: Omit<Device, 'metrics'>[] = [
  { id: 'srv-001', name: 'Production Server Alpha', type: 'server', location: 'Data Center A, Rack 12', ip: '192.168.1.101', status: 'healthy', healthScore: 92, lastSeen: 'Just now' },
  { id: 'srv-002', name: 'Production Server Beta', type: 'server', location: 'Data Center A, Rack 14', ip: '192.168.1.102', status: 'warning', healthScore: 71, lastSeen: 'Just now' },
  { id: 'gpu-001', name: 'ML Training Workstation', type: 'gpu-workstation', location: 'Lab B, Station 3', ip: '192.168.2.50', status: 'warning', healthScore: 65, lastSeen: 'Just now' },
  { id: 'mot-001', name: 'Conveyor Motor Unit 3', type: 'industrial-motor', location: 'Factory Floor, Zone C', ip: '10.0.3.20', status: 'critical', healthScore: 48, lastSeen: '2s ago' },
  { id: 'cnc-001', name: 'CNC Mill Station 7', type: 'cnc-machine', location: 'Manufacturing Bay 2', ip: '10.0.4.15', status: 'healthy', healthScore: 88, lastSeen: 'Just now' },
  { id: 'net-001', name: 'Core Network Switch', type: 'network-switch', location: 'Server Room B', ip: '192.168.0.1', status: 'healthy', healthScore: 96, lastSeen: 'Just now' },
];

function noise(base: number, amplitude: number, t: number, freq: number = 1): number {
  return base + Math.sin(t * freq) * amplitude + (Math.random() - 0.5) * amplitude * 0.5;
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

export function generateMetrics(deviceId: string, t: number): DeviceMetrics {
  const seed = deviceId.charCodeAt(deviceId.length - 1);
  const phase = seed * 0.7;
  
  const profiles: Record<string, Partial<DeviceMetrics>> = {
    'srv-001': { cpuUtil: noise(45, 15, t + phase, 0.3), memoryUtil: noise(62, 8, t, 0.1), cpuTemp: noise(58, 8, t, 0.2), gpuUtil: 0, gpuTemp: 35, vibration: 0, powerWatts: noise(280, 40, t, 0.15) },
    'srv-002': { cpuUtil: noise(72, 12, t + phase, 0.4), memoryUtil: noise(85, 6, t, 0.2), cpuTemp: noise(72, 10, t, 0.3), gpuUtil: 0, gpuTemp: 38, vibration: 0, powerWatts: noise(350, 50, t, 0.2) },
    'gpu-001': { cpuUtil: noise(55, 20, t + phase, 0.25), memoryUtil: noise(78, 10, t, 0.15), cpuTemp: noise(65, 12, t, 0.2), gpuUtil: noise(88, 8, t, 0.35), gpuTemp: noise(82, 10, t, 0.3), gpuMemory: noise(75, 12, t, 0.2), vibration: 0, powerWatts: noise(520, 80, t, 0.25) },
    'mot-001': { cpuUtil: noise(30, 10, t + phase, 0.1), memoryUtil: noise(40, 5, t, 0.05), cpuTemp: noise(55, 15, t, 0.15), gpuUtil: 0, gpuTemp: 0, vibration: noise(3.2, 1.5, t, 0.5), powerWatts: noise(1200, 200, t, 0.1), fanSpeed: 0 },
    'cnc-001': { cpuUtil: noise(40, 15, t + phase, 0.2), memoryUtil: noise(55, 8, t, 0.1), cpuTemp: noise(52, 8, t, 0.15), gpuUtil: 0, gpuTemp: 0, vibration: noise(1.8, 0.8, t, 0.3), powerWatts: noise(800, 120, t, 0.15) },
    'net-001': { cpuUtil: noise(15, 8, t + phase, 0.1), memoryUtil: noise(35, 5, t, 0.05), cpuTemp: noise(42, 5, t, 0.1), gpuUtil: 0, gpuTemp: 0, vibration: 0, powerWatts: noise(85, 15, t, 0.05) },
  };

  const p = profiles[deviceId] || {};
  return {
    cpuUtil: clamp(p.cpuUtil ?? 50, 0, 100),
    memoryUtil: clamp(p.memoryUtil ?? 50, 0, 100),
    memoryUsedGB: clamp((p.memoryUtil ?? 50) / 100 * 64, 0, 64),
    memoryTotalGB: 64,
    gpuUtil: clamp(p.gpuUtil ?? 0, 0, 100),
    gpuMemory: clamp(p.gpuMemory ?? 0, 0, 100),
    cpuTemp: clamp(p.cpuTemp ?? 50, 20, 105),
    gpuTemp: clamp(p.gpuTemp ?? 0, 0, 100),
    mbTemp: clamp((p.cpuTemp ?? 50) - 15, 20, 80),
    fanSpeed: clamp(p.fanSpeed ?? noise(2200, 400, t, 0.2), 0, 5000),
    powerWatts: clamp(p.powerWatts ?? 200, 0, 2000),
    diskReadMBs: clamp(noise(120, 60, t, 0.4), 0, 500),
    diskWriteMBs: clamp(noise(80, 40, t, 0.35), 0, 500),
    netUpMBs: clamp(noise(25, 15, t, 0.3), 0, 100),
    netDownMBs: clamp(noise(45, 25, t, 0.25), 0, 200),
    vibration: clamp(p.vibration ?? 0, 0, 10),
    uptimeHours: 720 + Math.floor(t / 60),
  };
}

export function getDevices(t: number): Device[] {
  return baseDevices.map(d => ({
    ...d,
    metrics: generateMetrics(d.id, t),
  }));
}

export function getHealthScore(deviceId: string, t: number): number {
  const found = baseDevices.find(d => d.id === deviceId);
  return found ? clamp(found.healthScore + Math.sin(t * 0.1) * 5, 0, 100) : 50;
}

export const demoAlerts: Alert[] = [
  { id: 'a1', deviceId: 'mot-001', deviceName: 'Conveyor Motor Unit 3', severity: 'critical', metric: 'Vibration', value: '4.7g', threshold: '3.0g', message: 'Vibration exceeds critical threshold — possible bearing wear', timestamp: '2 min ago', status: 'active' },
  { id: 'a2', deviceId: 'gpu-001', deviceName: 'ML Training Workstation', severity: 'warning', metric: 'GPU Temp', value: '87°C', threshold: '85°C', message: 'GPU temperature elevated during sustained workload', timestamp: '8 min ago', status: 'active' },
  { id: 'a3', deviceId: 'srv-002', deviceName: 'Production Server Beta', severity: 'warning', metric: 'Memory', value: '91%', threshold: '90%', message: 'Memory usage approaching critical levels', timestamp: '15 min ago', status: 'acknowledged' },
  { id: 'a4', deviceId: 'srv-001', deviceName: 'Production Server Alpha', severity: 'info', metric: 'CPU Util', value: '78%', threshold: '80%', message: 'CPU utilization trending upward', timestamp: '1 hr ago', status: 'resolved' },
  { id: 'a5', deviceId: 'mot-001', deviceName: 'Conveyor Motor Unit 3', severity: 'critical', metric: 'Power', value: '1450W', threshold: '1400W', message: 'Power consumption spike detected', timestamp: '25 min ago', status: 'active' },
  { id: 'a6', deviceId: 'cnc-001', deviceName: 'CNC Mill Station 7', severity: 'info', metric: 'Uptime', value: '720h', threshold: '—', message: 'Scheduled maintenance recommended', timestamp: '3 hr ago', status: 'resolved' },
];

export function generateTimeSeriesData(deviceId: string, points: number = 60) {
  const data = [];
  const now = Date.now();
  for (let i = points; i >= 0; i--) {
    const t = (now - i * 2000) / 1000;
    const m = generateMetrics(deviceId, t);
    data.push({
      time: new Date(now - i * 2000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      cpuTemp: Math.round(m.cpuTemp),
      gpuTemp: Math.round(m.gpuTemp),
      cpuUtil: Math.round(m.cpuUtil),
      gpuUtil: Math.round(m.gpuUtil),
      memoryUtil: Math.round(m.memoryUtil),
      powerWatts: Math.round(m.powerWatts),
      vibration: +m.vibration.toFixed(2),
    });
  }
  return data;
}
