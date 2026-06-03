import { arch, freemem, hostname, platform, release, totalmem, type } from "node:os";
import si from "systeminformation";
import type { SystemStats } from "../domain/types.js";

const bytesInMb = 1024 * 1024;
const bytesInGb = 1024 * 1024 * 1024;

export interface DeviceSpecLineInput {
  cpu: {
    brand?: string | undefined;
    cores?: number | undefined;
    efficiencyCores?: number | undefined;
    manufacturer?: string | undefined;
    performanceCores?: number | undefined;
    physicalCores?: number | undefined;
    speed?: number | undefined;
    speedMax?: number | undefined;
  };
  diskEntries: Array<{
    fs?: string | undefined;
    mount?: string | undefined;
    size: number;
    used: number;
  }>;
  gpuControllers: Array<{
    model?: string | undefined;
    vendor?: string | undefined;
    vram?: number | null | undefined;
  }>;
  memoryTotalMb: number;
  memoryUsedMb: number;
  networkInterfaceNames: string[];
  networkStatus: SystemStats["networkStatus"];
  os: {
    arch: string;
    distro?: string | undefined;
    kernel: string;
    platform: string;
    release?: string | undefined;
    type: string;
  };
  system: {
    manufacturer?: string | undefined;
    model?: string | undefined;
    version?: string | undefined;
  };
}

export async function readLocalSystemStats(): Promise<SystemStats> {
  const memoryTotalMb = Math.round(totalmem() / bytesInMb);
  const memoryUsedMb = Math.round((totalmem() - freemem()) / bytesInMb);

  const [cpu, disk, network, osInfo, graphics, system] = await Promise.allSettled([
    si.cpu(),
    si.fsSize(),
    si.networkStats(),
    si.osInfo(),
    si.graphics(),
    si.system()
  ]);

  const cpuInfo = cpu.status === "fulfilled" ? cpu.value : undefined;
  const os = osInfo.status === "fulfilled" ? osInfo.value : undefined;
  const graphicsInfo = graphics.status === "fulfilled" ? graphics.value : undefined;
  const systemInfo = system.status === "fulfilled" ? system.value : undefined;
  const diskEntries = disk.status === "fulfilled" ? disk.value : [];
  const networkEntries = network.status === "fulfilled" ? network.value : [];
  const primaryDisk =
    diskEntries.find((entry) => entry.size > 0);
  const activeNetwork =
    network.status === "fulfilled"
      ? networkEntries.some((entry) => entry.operstate === "up")
      : undefined;
  const networkStatus = activeNetwork === undefined ? "unknown" : activeNetwork ? "online" : "offline";
  const cpuLabel = cpuInfo
    ? formatCpuLabel(cpuInfo.manufacturer, cpuInfo.brand)
    : "CPU unavailable";
  const osLabel = `${type()} ${platform()} ${arch()}`;

  return {
    memoryUsedMb,
    memoryTotalMb,
    cpuLabel,
    osLabel,
    deviceSpecLines: buildDeviceSpecLines({
      cpu: cpuInfo ?? {},
      diskEntries,
      gpuControllers: graphicsInfo?.controllers ?? [],
      memoryTotalMb,
      memoryUsedMb,
      networkInterfaceNames: networkEntries
        .filter((entry) => entry.operstate === "up")
        .map((entry) => entry.iface)
        .filter((name): name is string => Boolean(name)),
      networkStatus,
      os: {
        arch: arch(),
        distro: os?.distro,
        kernel: release(),
        platform: platform(),
        release: os?.release,
        type: type()
      },
      system: systemInfo ?? {}
    }),
    diskAvailableGb: primaryDisk
      ? Math.round((primaryDisk.size - primaryDisk.used) / bytesInGb)
      : undefined,
    networkStatus
  };
}

export function buildDeviceSpecLines({
  cpu,
  diskEntries,
  gpuControllers,
  memoryTotalMb,
  memoryUsedMb,
  networkInterfaceNames,
  networkStatus,
  os,
  system
}: DeviceSpecLineInput): string[] {
  const systemLabel = joinParts([system.manufacturer, system.model, system.version]);
  const osDetailLabel = joinParts([os.distro, os.release, os.arch]);
  const cpuLabel = formatCpuLabel(cpu.manufacturer, cpu.brand);
  const gpuLabels = gpuControllers
    .map((gpu) => {
      const vramLabel =
        typeof gpu.vram === "number" && gpu.vram > 0
          ? `${Math.round(gpu.vram)} MB`
          : undefined;

      return joinParts([formatHardwareLabel(gpu.vendor, gpu.model), vramLabel]);
    })
    .filter(Boolean);
  const diskLines = diskEntries
    .filter((entry) => entry.size > 0)
    .map((entry) => {
      const label = entry.mount || entry.fs || "Disk";
      const freeGb = Math.round((entry.size - entry.used) / bytesInGb);
      const totalGb = Math.round(entry.size / bytesInGb);

      return `Disk ${label} ${freeGb}/${totalGb} GB free`;
    });
  const networkLabel =
    networkInterfaceNames.length > 0
      ? `${networkStatus} ${networkInterfaceNames.slice(0, 2).join(", ")}`
      : networkStatus;

  return [
    `Device ${systemLabel || "unknown"}`,
    `Host ${hostname()}`,
    `OS ${osDetailLabel || `${os.type} ${os.platform} ${os.arch}`}`,
    `Kernel ${os.type} ${os.platform} ${os.kernel}`,
    `CPU ${cpuLabel}`,
    `Cores ${formatCoreLabel(cpu)}`,
    `Speed ${formatCpuSpeed(cpu)}`,
    ...(gpuLabels.length > 0
      ? gpuLabels.map((gpu, index) => `GPU${gpuLabels.length > 1 ? ` ${index + 1}` : ""} ${gpu}`)
      : ["GPU unavailable"]),
    `RAM ${memoryUsedMb}/${memoryTotalMb} MB`,
    ...(diskLines.length > 0 ? diskLines : ["Disk unavailable"]),
    `Net ${networkLabel}`
  ];
}

function formatCoreLabel(cpu: DeviceSpecLineInput["cpu"]): string {
  const logicalCores = cpu.cores;
  const physicalCores = cpu.physicalCores;
  const performanceCores = cpu.performanceCores;
  const efficiencyCores = cpu.efficiencyCores;

  const baseLabel =
    typeof physicalCores === "number" && typeof logicalCores === "number"
      ? `${physicalCores}C/${logicalCores}T`
      : typeof logicalCores === "number"
        ? `${logicalCores}T`
        : "unknown";
  const hybridLabel =
    typeof performanceCores === "number"
    && typeof efficiencyCores === "number"
    && (typeof physicalCores !== "number" || performanceCores + efficiencyCores === physicalCores)
      ? ` ${performanceCores}P+${efficiencyCores}E`
      : "";

  return `${baseLabel}${hybridLabel}`;
}

function formatCpuSpeed(cpu: DeviceSpecLineInput["cpu"]): string {
  const currentSpeed =
    typeof cpu.speed === "number" && cpu.speed > 0 ? `${cpu.speed.toFixed(2)} GHz` : undefined;
  const maxSpeed =
    typeof cpu.speedMax === "number" && cpu.speedMax > 0
      ? `${cpu.speedMax.toFixed(2)} GHz max`
      : undefined;

  return joinParts([currentSpeed, currentSpeed === maxSpeed?.replace(" max", "") ? undefined : maxSpeed])
    || "unknown";
}

function formatCpuLabel(
  manufacturer?: string,
  brand?: string
): string {
  const normalizedManufacturer = manufacturer?.trim();
  const normalizedBrand = brand?.trim().replace(/^Gen\s+/i, "");

  if (!normalizedBrand) {
    return normalizedManufacturer || "CPU unavailable";
  }

  if (!normalizedManufacturer) {
    return normalizedBrand;
  }

  if (normalizedManufacturer.toLowerCase() === "gen") {
    return normalizedBrand;
  }

  const manufacturerRoot = normalizedManufacturer.toLowerCase().split(/\s+/)[0] ?? "";
  const normalizedBrandLower = normalizedBrand.toLowerCase();

  return normalizedBrandLower.includes(manufacturerRoot)
    ? normalizedBrand
    : `${normalizedManufacturer} ${normalizedBrand}`;
}

function formatHardwareLabel(
  vendor?: string,
  model?: string
): string {
  const normalizedVendor = vendor?.trim();
  const normalizedModel = model?.trim();

  if (!normalizedModel) {
    return normalizedVendor || "";
  }

  if (!normalizedVendor) {
    return normalizedModel;
  }

  const vendorRoot = normalizedVendor.toLowerCase().split(/\s+/)[0] ?? "";

  return normalizedModel.toLowerCase().includes(vendorRoot)
    ? normalizedModel
    : `${normalizedVendor} ${normalizedModel}`;
}

function joinParts(parts: Array<string | undefined>): string {
  return parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part))
    .join(" ");
}
