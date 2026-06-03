import { describe, expect, it } from "vitest";
import { buildDeviceSpecLines } from "../src/services/systemStats.js";

describe("system stats formatting", () => {
  it("includes detailed CPU, GPU, OS, RAM, disk, and network specs", () => {
    const lines = buildDeviceSpecLines({
      cpu: {
        brand: "Core i5-13420H",
        cores: 12,
        efficiencyCores: 4,
        manufacturer: "Intel",
        performanceCores: 4,
        physicalCores: 8,
        speed: 2.1,
        speedMax: 4.6
      },
      diskEntries: [
        {
          fs: "NTFS",
          mount: "C:",
          size: 512 * 1024 * 1024 * 1024,
          used: 256 * 1024 * 1024 * 1024
        }
      ],
      gpuControllers: [
        {
          model: "GeForce RTX 4050 Laptop GPU",
          vendor: "NVIDIA",
          vram: 6144
        },
        {
          model: "UHD Graphics",
          vendor: "Intel",
          vram: 1024
        }
      ],
      memoryTotalMb: 16054,
      memoryUsedMb: 10557,
      networkInterfaceNames: ["Wi-Fi"],
      networkStatus: "online",
      os: {
        arch: "x64",
        distro: "Windows 11 Pro",
        kernel: "10.0.26100",
        platform: "win32",
        release: "23H2",
        type: "Windows_NT"
      },
      system: {
        manufacturer: "Acer",
        model: "Nitro V",
        version: "ANV15"
      }
    });

    expect(lines).toContain("Device Acer Nitro V ANV15");
    expect(lines).toContain("OS Windows 11 Pro 23H2 x64");
    expect(lines).toContain("CPU Intel Core i5-13420H");
    expect(lines).toContain("Cores 8C/12T 4P+4E");
    expect(lines).toContain("Speed 2.10 GHz 4.60 GHz max");
    expect(lines).toContain("GPU 1 NVIDIA GeForce RTX 4050 Laptop GPU 6144 MB");
    expect(lines).toContain("GPU 2 Intel UHD Graphics 1024 MB");
    expect(lines).toContain("RAM 10557/16054 MB");
    expect(lines).toContain("Disk C: 256/512 GB free");
    expect(lines).toContain("Net online Wi-Fi");
  });
});
