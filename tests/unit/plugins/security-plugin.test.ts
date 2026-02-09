import { describe, it, expect } from 'vitest';
import { securityPlugin } from '../../../src/plugins/security/security-plugin.js';
import { createKernel } from '../../../src/kernel.js';
import { vfsPlugin } from '../../../src/plugins/core/vfs-plugin.js';

describe('securityPlugin', () => {
  function setup(options?: Parameters<typeof securityPlugin>[0]) {
    const kernel = createKernel();
    kernel.use(vfsPlugin());
    kernel.use(securityPlugin(options));
    return kernel;
  }

  it('should install successfully', () => {
    const kernel = setup();
    expect(kernel.listPlugins()).toContain('security');
  });

  it('should default to unrestricted mode', () => {
    const kernel = setup();
    const security = (kernel as any)._security;
    expect(security.context.mode).toBe('unrestricted');
    expect(security.context.canAccessNetwork).toBe(true);
    expect(security.context.canAccessDOM).toBe(true);
    expect(security.context.canEval).toBe(true);
  });

  it('should configure worker mode', () => {
    const kernel = setup({ mode: 'worker' });
    const security = (kernel as any)._security;
    expect(security.context.mode).toBe('worker');
    expect(security.context.canAccessDOM).toBe(false);
    expect(security.context.canEval).toBe(true);
  });

  it('should configure sandbox mode', () => {
    const kernel = setup({ mode: 'sandbox' });
    const security = (kernel as any)._security;
    expect(security.context.mode).toBe('sandbox');
    expect(security.context.canEval).toBe(false);
  });

  it('should configure locked mode', () => {
    const kernel = setup({ mode: 'locked' });
    const security = (kernel as any)._security;
    expect(security.context.mode).toBe('locked');
    expect(security.context.canAccessNetwork).toBe(false);
    expect(security.context.canEval).toBe(false);
  });

  it('should check access in unrestricted mode', () => {
    const kernel = setup();
    const security = (kernel as any)._security;
    expect(security.checkAccess('fetch')).toBe(true);
    expect(security.checkAccess('document')).toBe(true);
  });

  it('should check access in sandbox mode', () => {
    const kernel = setup({ mode: 'sandbox' });
    const security = (kernel as any)._security;
    expect(security.checkAccess('Array')).toBe(true);
    expect(security.checkAccess('eval')).toBe(false); // Not in allowed list
  });

  it('should check access in locked mode', () => {
    const kernel = setup({ mode: 'locked' });
    const security = (kernel as any)._security;
    expect(security.checkAccess('anything')).toBe(false);
  });

  it('should check access in worker mode', () => {
    const kernel = setup({ mode: 'worker' });
    const security = (kernel as any)._security;
    expect(security.checkAccess('fetch')).toBe(true);
    expect(security.checkAccess('anything')).toBe(true);
  });

  it('should create sandbox globals', () => {
    const kernel = setup({ mode: 'sandbox' });
    const security = (kernel as any)._security;
    const globals = security.createSandboxGlobals();
    expect(globals).toHaveProperty('Array');
    expect(globals).toHaveProperty('Object');
    expect(globals).toHaveProperty('Math');
  });

  it('should block execution in locked mode', () => {
    const kernel = setup({ mode: 'locked' });
    let allowed = true;
    kernel.emit('__beforeExecute', 'test.js', (result: boolean) => {
      allowed = result;
    });
    expect(allowed).toBe(false);
  });

  it('should allow execution in unrestricted mode', () => {
    const kernel = setup();
    let allowed = false;
    kernel.emit('__beforeExecute', 'test.js', (result: boolean) => {
      allowed = result;
    });
    expect(allowed).toBe(true);
  });

  it('should accept custom timeout', () => {
    const kernel = setup({ timeout: 5000 });
    const security = (kernel as any)._security;
    expect(security.context.timeout).toBe(5000);
  });
});
