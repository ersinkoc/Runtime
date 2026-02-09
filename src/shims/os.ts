/**
 * Node.js `os` module shim — simulated browser values.
 * @module shims/os
 */

export const EOL = '\n';

export function platform(): string { return 'browser'; }
export function arch(): string { return 'wasm'; }
export function type(): string { return 'Browser'; }
export function release(): string { return '1.0.0'; }
export function hostname(): string { return 'localhost'; }
export function homedir(): string { return '/home/user'; }
export function tmpdir(): string { return '/tmp'; }

export function cpus(): Array<{ model: string; speed: number }> {
  const count = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency ?? 1 : 1;
  return Array.from({ length: count }, () => ({ model: 'Virtual CPU', speed: 2400 }));
}

export function totalmem(): number { return 4 * 1024 * 1024 * 1024; } // 4GB
export function freemem(): number { return 2 * 1024 * 1024 * 1024; } // 2GB

export function uptime(): number {
  return typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
}

export function loadavg(): [number, number, number] { return [0, 0, 0]; }

export function endianness(): 'LE' | 'BE' {
  const buffer = new ArrayBuffer(2);
  new DataView(buffer).setInt16(0, 256, true);
  return new Int16Array(buffer)[0] === 256 ? 'LE' : 'BE';
}

export function networkInterfaces(): Record<string, Array<{ address: string; netmask: string; family: string; internal: boolean }>> {
  return {
    lo: [{ address: '127.0.0.1', netmask: '255.0.0.0', family: 'IPv4', internal: true }],
  };
}

export function userInfo(): { username: string; uid: number; gid: number; shell: string; homedir: string } {
  return { username: 'user', uid: 1000, gid: 1000, shell: '/bin/sh', homedir: '/home/user' };
}

const osModule = {
  EOL, platform, arch, type, release, hostname, homedir, tmpdir,
  cpus, totalmem, freemem, uptime, loadavg, endianness, networkInterfaces, userInfo,
};

export default osModule;
