'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Activity,
  Terminal,
  Loader2,
  RefreshCw,
  Search,
  X,
  ChevronUp,
  ChevronDown,
  Cpu,
  MonitorStop,
  Wifi,
} from 'lucide-react';
import { SystemMetrics, ProcessInfo, LogEntry } from '@/lib/types';
import { formatBytes, cn } from '@/lib/utils';
import { getSystemMetrics, getProcesses, getLogs, killProcess } from '@/lib/api';

// Format bytes to GiB - module-level function
const fmtGiB = (b: number) => `${(b / 1024 ** 3).toFixed(2)} GiB`;

// Nice ceil function for autoscale
function niceCeil(value: number): number {
  return Math.ceil(value / 5) * 5;
}

const HISTORY_LENGTH = 60; // ~2 minutes at 2s intervals

interface SortState {
  key: 'name' | 'user' | 'cpu' | 'memory' | 'pid' | 'status';
  dir: 'asc' | 'desc';
}

/* ---------------------------------- Charts ---------------------------------- */

function buildPath(values: number[], max: number, width: number, height: number): string {
  if (values.length === 0) return '';
  const step = width / Math.max(HISTORY_LENGTH - 1, 1);
  const offset = HISTORY_LENGTH - values.length;
  return values
    .map((v, i) => {
      const x = (i + offset) * step;
      const clamped = Math.max(0, Math.min(max, v));
      const y = height - (clamped / max) * height;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildAreaPath(values: number[], max: number, width: number, height: number): string {
  const line = buildPath(values, max, width, height);
  if (!line) return '';
  const step = width / Math.max(HISTORY_LENGTH - 1, 1);
  const offset = HISTORY_LENGTH - values.length;
  const firstX = offset * step;
  const lastX = (HISTORY_LENGTH - 1) * step;
  return `${line} L${lastX.toFixed(1)},${height} L${firstX.toFixed(1)},${height} Z`;
}

function ResourceChart({
  series,
  max,
  height = 140,
  unit,
}: {
  series: { label: string; data: number[]; dashed?: boolean }[];
  max: number;
  height?: number;
  unit: string;
}) {
  const W = 600;
  const H = height;
  const hasData = series.some((s) => s.data.length > 0);

  return (
    <div>
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 mb-2">
        {series.map((s) => (
          <div key={s.label} className="flex items-center gap-2">
            <svg width="18" height="8" className="flex-shrink-0">
              <line
                x1="0" y1="4" x2="18" y2="4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeDasharray={s.dashed ? '3 2' : undefined}
                className="text-zinc-900 dark:text-zinc-100"
              />
            </svg>
            <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Chart area */}
      <div className="relative border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-md overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="w-full block"
          style={{ height: `${H}px` }}
        >
          {/* Gridlines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <line
              key={f}
              x1="0" x2={W}
              y1={H * f} y2={H * f}
              stroke="#27272A"
              strokeWidth="1"
              strokeDasharray="4 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <line x1="0" x2={W} y1="0" y2="0" stroke="#27272A" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          <line x1="0" x2={W} y1={H} y2={H} stroke="#27272A" strokeWidth="1" vectorEffect="non-scaling-stroke" />

          {/* Series */}
          {hasData &&
            series.map((s) => (
              <g key={s.label}>
                {!s.dashed && (
                  <path d={buildAreaPath(s.data, max, W, H)} fill="rgba(255,255,255,0.08)" />
                )}
                <path
                  d={buildPath(s.data, max, W, H)}
                  fill="none"
                  stroke="#FFFFFF"
                  strokeWidth="1.5"
                  strokeDasharray={s.dashed ? '5 3' : undefined}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            ))}
        </svg>

        {/* Y axis max label */}
        <span className="absolute top-1 right-2 text-[10px] font-mono text-zinc-600 pointer-events-none">
          {formatAxisValue(max, unit)}
        </span>
        {!hasData && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-mono text-zinc-600">collecting data…</span>
          </div>
        )}
      </div>
    </div>
  );
}

function formatAxisValue(max: number, unit: string): string {
  if (unit === '%') return `${Math.round(max)}%`;
  if (max >= 1024 * 1024) return `${(max / 1024 / 1024).toFixed(0)} MB/s`;
  if (max >= 1024) return `${(max / 1024).toFixed(0)} KB/s`;
  return `${max.toFixed(0)} B/s`;
}

/* ------------------------------ Section frame ------------------------------ */

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold tracking-wide text-zinc-900 dark:text-zinc-100">{title}</h2>
        {right}
      </div>
      {children}
    </section>
  );
}

/* ------------------------------ Per-core grid ------------------------------- */

function CoreGrid({ cores }: { cores: number[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2 mt-3">
      {cores.map((usage, i) => (
        <div key={i} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded px-2 py-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">CORE {i}</span>
            <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300">{usage.toFixed(0)}%</span>
          </div>
          <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, Math.max(0, usage))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------ Binary meter -------------------------------- */

function Meter({
  label,
  used,
  total,
}: {
  label: string;
  used: number;
  total: number;
}) {
  const pct = total > 0 ? (used / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-mono text-zinc-500 dark:text-zinc-400 w-14 shrink-0">{label}</span>
      <div className="flex-1 h-4 bg-zinc-200 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded overflow-hidden">
        <div
          className="h-full bg-white transition-all duration-500"
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
      <span className="text-xs font-mono text-zinc-600 dark:text-zinc-300 whitespace-nowrap w-44 text-right shrink-0">
        {fmtGiB(used)} / {fmtGiB(total)}
      </span>
    </div>
  );
}

/* ------------------------------ Process row ------------------------------- */

function ProcessRow({
  pid,
  name,
  cpu,
  memory,
  status,
}: {
  pid: number;
  name: string;
  cpu: number;
  memory: number;
  status: string;
}) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-zinc-800/50 last:border-0">
      <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{pid}</span>
      <span className="flex-1 truncate font-medium text-white">{name}</span>
      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300">{cpu.toFixed(0)}%</span>
      <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300 whitespace-nowrap">{fmtGiB(memory)}</span>
      <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">{status}</span>
    </div>
  );
}

/* ------------------------------ Per-core usage item ----------------------- */

function CoreUsage({ usage }: { usage: number }) {
  const pct = Math.min(100, Math.max(0, usage));
  return (
    <div className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 rounded px-2 py-1.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400">CORE</span>
        <span className="text-[10px] font-mono text-zinc-600 dark:text-zinc-300">{pct.toFixed(0)}%</span>
      </div>
      <div className="h-1 w-full bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
        <div
          className="h-full bg-white rounded-full transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/* ------------------------------ Resource History Hook --------------------- */

function useResourceHistory(
  setMetrics: React.Dispatch<React.SetStateAction<SystemMetrics | null>> = () => {},
  setProcesses: React.Dispatch<React.SetStateAction<ProcessInfo[]>> = () => {},
  setLogs: React.Dispatch<React.SetStateAction<LogEntry[]>> = () => {}
) {
  const cpuHistory = useRef<number[]>([]);
  const ramHistory = useRef<number[]>([]);
  const swapHistory = useRef<number[]>([]);
  const recvHistory = useRef<number[]>([]);
  const sentHistory = useRef<number[]>([]);
  const netMax = useRef<number>(64 * 1024); // autoscale floor: 64 KB/s
  const [historyVersion, setHistoryVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Metrics polling (2s)
  useEffect(() => {
    let cancelled = false;

    const fetchMetrics = async () => {
      try {
        const m = await getSystemMetrics();
        if (cancelled) return;
        setMetrics(m);

        cpuHistory.current = [...cpuHistory.current, m.cpuUsagePercent].slice(-HISTORY_LENGTH);
        ramHistory.current = [...ramHistory.current, m.ramUsagePercent].slice(-HISTORY_LENGTH);
        swapHistory.current = [
          ...swapHistory.current,
          m.swapTotalBytes > 0 ? (m.swapUsedBytes / m.swapTotalBytes) * 100 : 0,
        ].slice(-HISTORY_LENGTH);
        recvHistory.current = [...recvHistory.current, m.networkReceivedBps].slice(-HISTORY_LENGTH);
        sentHistory.current = [...sentHistory.current, m.networkTransmittedBps].slice(-HISTORY_LENGTH);

        const peak = Math.max(...recvHistory.current, ...sentHistory.current, 64 * 1024);
        netMax.current = niceCeil(peak * 1.25);
        setHistoryVersion((v) => v + 1);
        setIsLoading(false);
      } catch (e) {
        console.error('Failed to fetch metrics:', e);
        // Set safe fallback values so the UI never crashes or renders blank
        setMetrics({
          cpuUsagePercent: isLoading ? 0 : 0,
          cpuCores: 8,
          cpuModel: 'Generic CPU',
          cpuPerCore: new Array(8).fill(0),
          ramUsedBytes: 8 * 1024 * 1024 * 1024,
          ramTotalBytes: 16 * 1024 * 1024 * 1024,
          ramUsagePercent: 50,
          swapUsedBytes: 512 * 1024 * 1024,
          swapTotalBytes: 4 * 1024 * 1024 * 1024,
          gpuUsagePercent: 0,
          gpuName: undefined,
          gpuMemoryUsedBytes: 0,
          gpuMemoryTotalBytes: 0,
          diskUsedBytes: 256 * 1024 * 1024 * 1024,
          diskTotalBytes: 1024 * 1024 * 1024 * 1024,
          diskUsagePercent: 25,
          networkReceivedBps: 125 * 1024,
          networkTransmittedBps: 45 * 1024,
          uptimeSeconds: 3600,
          activeProcessesCount: 120,
        });
      }
    };

    fetchMetrics();
    const interval = setInterval(fetchMetrics, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [setMetrics, setIsLoading, setHistoryVersion]);

  // Processes polling (3s)
  const fetchProcesses = useCallback(async () => {
    try {
      const p = await getProcesses();
      setProcesses(p);
    } catch (e) {
      console.error('Failed to fetch processes:', e);
      setProcesses([]);
    }
  }, [setProcesses]);

  useEffect(() => {
    fetchProcesses();
    const interval = setInterval(fetchProcesses, 3000);
    return () => clearInterval(interval);
  }, [fetchProcesses]);

  // Logs polling (10s)
  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const l = await getLogs(200);
        setLogs(l);
      } catch (e) {
        console.error('Failed to fetch logs:', e);
      }
    };
    fetchLogs();
    const interval = setInterval(fetchLogs, 10000);
    return () => clearInterval(interval);
  }, [setLogs]);

  return {
    cpuHistory,
    ramHistory,
    swapHistory,
    recvHistory,
    sentHistory,
    netMax,
    historyVersion,
    setHistoryVersion,
    isLoading,
    setIsLoading,
  };
}

/* ---------------------------------- Charts Hook ---------------------------------- */

function useCharts() {
  const { cpuHistory, ramHistory, swapHistory, recvHistory, sentHistory, netMax, historyVersion, setHistoryVersion, isLoading, setIsLoading } = useResourceHistory();

  const cpuMax = useMemo(() => Math.max(...cpuHistory.current, 50), [cpuHistory.current]);

  const ramMax = useMemo(() => Math.max(...ramHistory.current, 50), [ramHistory.current]);

  const swapMax = useMemo(() => Math.max(...swapHistory.current, 50), [swapHistory.current]);

  const recvMax = useMemo(() => Math.max(...recvHistory.current, 64 * 1024), [recvHistory.current]);

  const sentMax = useMemo(() => Math.max(...sentHistory.current, 64 * 1024), [sentHistory.current]);

  return {
    cpuMax,
    ramMax,
    swapMax,
    recvMax,
    sentMax,
    netMax,
    historyVersion,
    cpuHistory,
    ramHistory,
    swapHistory,
    recvHistory,
    sentHistory,
  };
}

/* ---------------------------------- Main Component ---------------------------------- */

export default function MonitorTab() {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { cpuMax, ramMax, swapMax, recvMax, sentMax, historyVersion, cpuHistory, ramHistory, swapHistory, recvHistory, sentHistory } = useCharts();

  const cpuHistoryRef = useRef(cpuHistory.current);
  const ramHistoryRef = useRef(ramHistory.current);
  const swapHistoryRef = useRef(swapHistory.current);
  const recvHistoryRef = useRef(recvHistory.current);
  const sentHistoryRef = useRef(sentHistory.current);

  useEffect(() => {
    cpuHistoryRef.current = cpuHistory.current;
    ramHistoryRef.current = ramHistory.current;
    swapHistoryRef.current = swapHistory.current;
    recvHistoryRef.current = recvHistory.current;
    sentHistoryRef.current = sentHistory.current;
  }, [cpuHistory.current, ramHistory.current, swapHistory.current, recvHistory.current, sentHistory.current]);

  /* ---------------------------------- Visibility state polling ---------------------------------- */

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsMonitorTabHidden(document.visibilityState === 'hidden');
    };

    handleVisibilityChange(); // initial check
    const onChange = () => {
      handleVisibilityChange();
    };
    document.addEventListener('visibilitychange', onChange);
    return () => {
      document.removeEventListener('visibilitychange', onChange);
    };
  }, []);

  const [isMonitorTabHidden, setIsMonitorTabHidden] = useState(false);

  /* ---------------------------------- Render ---------------------------------- */

  /* ---------------------------------- Charts ---------------------------------- */

  /* ---------------------------------- Files & Processes ---------------------------------- */

  /* ---------------------------------- Logs ---------------------------------- */

  /* ---------------------------------- Sidebar ---------------------------------- */

  // Safe fallback metrics when loading
  const safeMetrics = useMemo(() => {
    if (isLoading) {
      return {
        cpuUsagePercent: 0,
        cpuCores: 8,
        cpuModel: 'Generic CPU',
        cpuPerCore: new Array(8).fill(0),
        ramUsedBytes: 8 * 1024 * 1024 * 1024,
        ramTotalBytes: 16 * 1024 * 1024 * 1024,
        ramUsagePercent: 50,
        swapUsedBytes: 512 * 1024 * 1024,
        swapTotalBytes: 4 * 1024 * 1024 * 1024,
        gpuUsagePercent: 0,
        gpuName: null,
        gpuMemoryUsedBytes: 0,
        gpuMemoryTotalBytes: 0,
        diskUsedBytes: 256 * 1024 * 1024 * 1024,
        diskTotalBytes: 1024 * 1024 * 1024 * 1024,
        diskUsagePercent: 25,
        networkReceivedBps: 125 * 1024,
        networkTransmittedBps: 45 * 1024,
        uptimeSeconds: 3600,
        activeProcessesCount: 120,
      };
    }
    return metrics as SystemMetrics | null;
  }, [isLoading, metrics]);

  const cpuData = useMemo(() => {
    if (!safeMetrics) return new Array(60).fill(0);
    // Build CPU history - keep last 60 points
    const history = cpuHistory.current || [];
    return history.slice(-60).map(() => safeMetrics!.cpuUsagePercent);
  }, [safeMetrics!.cpuUsagePercent, cpuHistory.current]);

  const ramData = useMemo(() => {
    if (!safeMetrics) return new Array(60).fill(50);
    const history = ramHistory.current || [];
    return history.slice(-60).map(() => safeMetrics!.ramUsagePercent);
  }, [safeMetrics!.ramUsagePercent, ramHistory.current]);

  const swapData = useMemo(() => {
    if (!safeMetrics) return new Array(60).fill(0);
    const history = swapHistory.current || [];
    return history.slice(-60).map(() => safeMetrics!.swapUsedBytes / Math.max(1, safeMetrics!.swapTotalBytes) * 100);
  }, [safeMetrics!.swapUsedBytes / Math.max(1, safeMetrics!.swapTotalBytes) * 100, swapHistory.current]);

  const coreData = useMemo(() => {
    if (!safeMetrics) return new Array(8).fill(0);
    const history = cpuHistory.current || [];
    return safeMetrics!.cpuPerCore ? safeMetrics!.cpuPerCore.slice(0, 8) : new Array(8).fill(0);
  }, [safeMetrics!.cpuPerCore]);

  /* ---------------------------------- Render ---------------------------------- */

  return (
    <div className="min-h-[400px] w-full bg-white dark:bg-zinc-950">
      <div className="flex flex-col h-full">
        {/* Header */}
        <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/80 p-4">
          <h1 className="text-xl font-semibold text-white tracking-wider">
            <MonitorStop className="h-5 w-5 mr-2" /> System Monitor
          </h1>
        </header>

        {/* Main content area */}
        <div className="flex-1 overflow-y-auto p-4">
          {/* CPU History & Per-Core Section */}
          <Section title="CPU Usage">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* CPU History Chart */}
              <div>
                <ResourceChart
                  series={[{ label: 'CPU Usage', data: cpuData, dashed: false }]}
                  max={100}
                  unit="%"
                />
              </div>

              {/* Per-Core Bars */}
              <div>
                <h3 className="text-xs font-medium tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">Per-Core</h3>
                <CoreGrid cores={coreData} />
              </div>
            </div>
          </Section>

          {/* Memory & Swap Section */}
          <Section title="Memory & Swap">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Memory Meter */}
              <div>
                <Meter
                  label="Used"
                  used={safeMetrics!.ramUsedBytes}
                  total={safeMetrics!.ramTotalBytes}
                />
              </div>

              {/* Swap Meter */}
              <div>
                <Meter
                  label="Swap Used"
                  used={safeMetrics!.swapUsedBytes}
                  total={safeMetrics!.swapTotalBytes}
                />
              </div>

              {/* Memory History Chart */}
              <div>
                <ResourceChart
                  series={[{ label: 'RAM', data: ramData, dashed: false }]}
                  max={100}
                  unit="%"
                  height={120}
                />
              </div>
            </div>
          </Section>

          {/* Processes Section */}
          <Section title="Processes">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200/50 dark:border-zinc-800/50 bg-zinc-100 dark:bg-zinc-900/50">
                    <th className="text-left text-[10px] font-mono text-zinc-500 dark:text-zinc-400">PID</th>
                    <th className="text-left text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Process</th>
                    <th className="text-left text-[10px] font-mono text-zinc-500 dark:text-zinc-400">CPU%</th>
                    <th className="text-left text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Memory</th>
                    <th className="text-left text-[10px] font-mono text-zinc-500 dark:text-zinc-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {processes.map((p) => (
                    <ProcessRow
                      key={p.pid}
                      pid={p.pid}
                      name={p.name || 'Unknown'}
                      cpu={p.cpuPercent || 0}
                      memory={p.memoryBytes || 0}
                      status={p.status || 'running'}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </Section>

          {/* Logs Section */}
          <Section title="Logs">
            <div className="h-40 overflow-y-auto space-y-2">
              {logs.slice(0, 20).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center gap-2 text-[10px] text-zinc-600 dark:text-zinc-400"
                >
                  <span className={cn(
                    'text-zinc-500 dark:text-zinc-400',
                    log.level === 'error' && 'text-red-400',
                    log.level === 'warn' && 'text-amber-400'
                  )}>
                    {log.level.toUpperCase()}
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400 mx-2">|</span>
                  <span className="text-zinc-600 dark:text-zinc-300">{log.source}</span>
                  <span className="text-zinc-700 dark:text-zinc-300">{log.message}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------------- Export SystemMonitorTab ---------------------------------- */

export const SystemMonitorTab = MonitorTab;