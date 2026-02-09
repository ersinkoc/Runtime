import { describe, it, expect } from 'vitest';
import cryptoModule from '../../../src/shims/crypto.js';
import { Buffer } from '../../../src/shims/buffer.js';

describe('crypto shim', () => {
  describe('randomBytes', () => {
    it('should return buffer of correct size', () => {
      const buf = cryptoModule.randomBytes(16);
      expect(buf.length).toBe(16);
    });

    it('should return different values', () => {
      const a = cryptoModule.randomBytes(16);
      const b = cryptoModule.randomBytes(16);
      expect(a.toString('hex')).not.toBe(b.toString('hex'));
    });
  });

  describe('randomUUID', () => {
    it('should return valid UUID', () => {
      const uuid = cryptoModule.randomUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    });
  });

  describe('randomInt', () => {
    it('should return integer in range', () => {
      for (let i = 0; i < 20; i++) {
        const val = cryptoModule.randomInt(0, 10);
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThan(10);
      }
    });

    it('should support single argument (max)', () => {
      const val = cryptoModule.randomInt(100);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(100);
    });
  });

  describe('timingSafeEqual', () => {
    it('should return true for equal buffers', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 3]);
      expect(cryptoModule.timingSafeEqual(a, b)).toBe(true);
    });

    it('should return false for different buffers', () => {
      const a = new Uint8Array([1, 2, 3]);
      const b = new Uint8Array([1, 2, 4]);
      expect(cryptoModule.timingSafeEqual(a, b)).toBe(false);
    });

    it('should throw for different lengths', () => {
      const a = new Uint8Array([1, 2]);
      const b = new Uint8Array([1, 2, 3]);
      expect(() => cryptoModule.timingSafeEqual(a, b)).toThrow('same byte length');
    });
  });

  describe('createHash (MD5)', () => {
    it('should hash empty string', () => {
      const hash = cryptoModule.createHash('md5').update('').digest('hex');
      expect(hash).toBe('d41d8cd98f00b204e9800998ecf8427e');
    });

    it('should hash "hello"', () => {
      const hash = cryptoModule.createHash('md5').update('hello').digest('hex');
      expect(hash).toBe('5d41402abc4b2a76b9719d911017c592');
    });
  });

  describe('createHash (SHA1)', () => {
    it('should hash empty string', () => {
      const hash = cryptoModule.createHash('sha1').update('').digest('hex');
      expect(hash).toBe('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    });

    it('should hash "hello"', () => {
      const hash = cryptoModule.createHash('sha1').update('hello').digest('hex');
      expect(hash).toBe('aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d');
    });
  });

  describe('createHash (SHA256)', () => {
    it('should hash empty string', () => {
      const hash = cryptoModule.createHash('sha256').update('').digest('hex');
      expect(hash).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    });

    it('should hash "hello"', () => {
      const hash = cryptoModule.createHash('sha256').update('hello').digest('hex');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('should support chained updates', () => {
      const hash = cryptoModule.createHash('sha256')
        .update('hel')
        .update('lo')
        .digest('hex');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });

    it('should support base64 digest', () => {
      const hash = cryptoModule.createHash('sha256').update('hello').digest('base64');
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });

    it('should return Uint8Array for buffer digest', () => {
      const hash = cryptoModule.createHash('sha256').update('hello').digest('buffer');
      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32);
    });
  });

  describe('createHmac', () => {
    it('should create HMAC-SHA256', () => {
      const hmac = cryptoModule.createHmac('sha256', 'secret').update('hello').digest('hex');
      expect(typeof hmac).toBe('string');
      expect(hmac.length).toBe(64);
    });

    it('should produce consistent results', () => {
      const h1 = cryptoModule.createHmac('sha256', 'key').update('data').digest('hex');
      const h2 = cryptoModule.createHmac('sha256', 'key').update('data').digest('hex');
      expect(h1).toBe(h2);
    });

    it('should produce different results with different keys', () => {
      const h1 = cryptoModule.createHmac('sha256', 'key1').update('data').digest('hex');
      const h2 = cryptoModule.createHmac('sha256', 'key2').update('data').digest('hex');
      expect(h1).not.toBe(h2);
    });

    it('should update with Uint8Array data', () => {
      const data = new Uint8Array([104, 101, 108, 108, 111]); // "hello"
      const hmac = cryptoModule.createHmac('sha256', 'secret').update(data).digest('hex');
      const hmacStr = cryptoModule.createHmac('sha256', 'secret').update('hello').digest('hex');
      expect(hmac).toBe(hmacStr);
    });

    it('should handle key longer than block size', () => {
      // Key longer than 64 bytes should be hashed first
      const longKey = 'a'.repeat(100);
      const hmac = cryptoModule.createHmac('sha256', longKey).update('data').digest('hex');
      expect(typeof hmac).toBe('string');
      expect(hmac.length).toBe(64);
    });
  });

  describe('createHash with Uint8Array', () => {
    it('should hash Uint8Array input', () => {
      const data = new TextEncoder().encode('hello');
      const hash = cryptoModule.createHash('sha256').update(data).digest('hex');
      expect(hash).toBe('2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824');
    });
  });

  describe('createHash with hex encoding', () => {
    it('should update with hex-encoded string', () => {
      // '68656c6c6f' is hex for 'hello'
      const hash = cryptoModule.createHash('sha256').update('68656c6c6f', 'hex').digest('hex');
      const expected = cryptoModule.createHash('sha256').update('hello').digest('hex');
      expect(hash).toBe(expected);
    });
  });

  describe('unsupported algorithm', () => {
    it('should throw for unsupported hash', () => {
      expect(() => cryptoModule.createHash('sha512')).toThrow('Unsupported');
    });

    it('should throw for unsupported hmac', () => {
      expect(() => cryptoModule.createHmac('sha512', 'key')).toThrow('Unsupported');
    });
  });

  describe('Hmac with Uint8Array key', () => {
    it('should accept Uint8Array key directly', () => {
      const key = new TextEncoder().encode('secret');
      const hmac = cryptoModule.createHmac('sha256', key).update('hello').digest('hex');
      const hmacStr = cryptoModule.createHmac('sha256', 'secret').update('hello').digest('hex');
      expect(hmac).toBe(hmacStr);
    });
  });

  describe('Hmac digest encoding', () => {
    it('should return base64 digest', () => {
      const hmac = cryptoModule.createHmac('sha256', 'key').update('data').digest('base64');
      expect(typeof hmac).toBe('string');
      expect(hmac.length).toBeGreaterThan(0);
    });

    it('should return Uint8Array for buffer digest', () => {
      const hmac = cryptoModule.createHmac('sha256', 'key').update('data').digest('buffer');
      expect(hmac).toBeInstanceOf(Uint8Array);
    });

    it('should return Uint8Array for no encoding', () => {
      const hmac = cryptoModule.createHmac('sha256', 'key').update('data').digest();
      expect(hmac).toBeInstanceOf(Uint8Array);
    });
  });

  describe('Hash default digest', () => {
    it('should return Uint8Array for no encoding', () => {
      const hash = cryptoModule.createHash('sha256').update('hello').digest();
      expect(hash).toBeInstanceOf(Uint8Array);
      expect(hash.length).toBe(32);
    });
  });
});
