/**
 * Shim registry — maps Node.js module names to browser shim implementations.
 * @module shims/index
 */

import pathModule from './path.js';
import bufferModule from './buffer.js';
import eventsModule from './events.js';
import processModule from './process.js';
import utilModule from './util.js';
import osModule from './os.js';
import timersModule from './timers.js';
import consoleModule from './console.js';
import stringDecoderModule from './string-decoder.js';
import ttyModule from './tty.js';
import perfHooksModule from './perf-hooks.js';
import streamModule from './stream.js';
import fsModule from './fs.js';
import urlModule from './url.js';
import querystringModule from './querystring.js';
import cryptoModule from './crypto.js';
import httpModule from './http.js';
import zlibModule from './zlib.js';
import assertModule from './assert.js';
import netModule from './net.js';
import childProcessModule from './child_process.js';
import workerThreadsModule from './worker_threads.js';

export type ShimTier = 'full' | 'minimal' | 'custom';

/** Minimal tier — only the most essential modules */
const MINIMAL_SHIMS = ['path', 'buffer', 'events', 'process', 'util', 'os'];

/** All Tier 1 shims */
const TIER1_SHIMS = [
  ...MINIMAL_SHIMS,
  'timers', 'console', 'string_decoder', 'tty', 'perf_hooks',
  'stream', 'fs', 'url', 'querystring', 'crypto', 'http', 'https', 'zlib', 'assert',
  'net', 'child_process', 'worker_threads',
];

/** Tier 3 stub modules */
const STUB_MODULES = [
  'tls', 'dns', 'dgram', 'cluster', 'vm', 'v8', 'inspector',
  'async_hooks', 'readline', 'repl', 'domain', 'punycode',
  'sys', 'constants', 'module', 'trace_events', 'wasi',
];

function createStub(name: string): Record<string, unknown> {
  return new Proxy({}, {
    get(_, prop) {
      if (prop === Symbol.toPrimitive || prop === 'toString' || prop === 'valueOf') {
        return () => `[stub: ${name}]`;
      }
      if (typeof prop === 'string') {
        return () => {
          throw new Error(`${name}.${prop} is not supported in the browser runtime`);
        };
      }
      return undefined;
    },
  });
}

/**
 * Get all available shims based on tier configuration.
 */
export function getShims(options?: {
  tier?: ShimTier;
  include?: string[];
  exclude?: string[];
}): Map<string, unknown> {
  const tier = options?.tier ?? 'full';
  const include = options?.include;
  const exclude = new Set(options?.exclude ?? []);

  const shims = new Map<string, unknown>();

  // Core shim registry
  const allShims: Record<string, unknown> = {
    path: pathModule,
    buffer: bufferModule,
    events: eventsModule,
    process: processModule,
    util: utilModule,
    os: osModule,
    timers: timersModule,
    console: consoleModule,
    string_decoder: stringDecoderModule,
    tty: ttyModule,
    perf_hooks: perfHooksModule,
    stream: streamModule,
    fs: fsModule,
    url: urlModule,
    querystring: querystringModule,
    crypto: cryptoModule,
    http: httpModule,
    https: httpModule,
    zlib: zlibModule,
    assert: assertModule,
    net: netModule,
    child_process: childProcessModule,
    worker_threads: workerThreadsModule,
  };

  // Determine which shims to include
  let shimNames: string[];
  if (tier === 'custom' && include) {
    shimNames = include;
  } else if (tier === 'minimal') {
    shimNames = MINIMAL_SHIMS;
  } else {
    shimNames = [...TIER1_SHIMS];
  }

  for (const name of shimNames) {
    if (exclude.has(name)) continue;
    const shim = allShims[name];
    if (shim) {
      shims.set(name, shim);
    }
  }

  // Add stubs for Tier 3 modules (unless explicitly excluded)
  if (tier === 'full') {
    for (const name of STUB_MODULES) {
      if (exclude.has(name)) continue;
      if (!shims.has(name)) {
        shims.set(name, createStub(name));
      }
    }
  }

  return shims;
}
