import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('config defaults', () => {
  it('binds to loopback and does not trust proxy headers by default', () => {
    const config = loadConfig({});
    expect(config.host).toBe('127.0.0.1');
    expect(config.trustProxy).toBe(0);
    expect(config.analyzerUrl).toBe('http://localhost:8001');
  });

  it('still allows an explicit container or proxy configuration', () => {
    const config = loadConfig({ HOST: '0.0.0.0', TRUST_PROXY: '1' });
    expect(config.host).toBe('0.0.0.0');
    expect(config.trustProxy).toBe(1);
  });
});
