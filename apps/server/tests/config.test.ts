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

  it('keeps the temporary audio indefinitely on local installs', () => {
    expect(loadConfig({}).audioCacheTtlMinutes).toBe(0);
    expect(
      loadConfig({ HOST: '0.0.0.0', CORS_ORIGIN: 'http://localhost:3000' }).audioCacheTtlMinutes,
    ).toBe(0);
  });

  it('expires the cache on remote installs unless a TTL is set', () => {
    expect(
      loadConfig({ HOST: '0.0.0.0', CORS_ORIGIN: 'https://app.example.com' }).audioCacheTtlMinutes,
    ).toBe(60);
    expect(loadConfig({ AUDIO_CACHE_TTL_MINUTES: '15' }).audioCacheTtlMinutes).toBe(15);
    expect(
      loadConfig({
        HOST: '0.0.0.0',
        CORS_ORIGIN: 'https://app.example.com',
        AUDIO_CACHE_TTL_MINUTES: '0',
      }).audioCacheTtlMinutes,
    ).toBe(0);
  });

  it('sets the daily analysis quota and allows disabling it', () => {
    expect(loadConfig({}).analysisDailyQuota).toBe(50);
    expect(loadConfig({ ANALYSIS_DAILY_QUOTA: '5' }).analysisDailyQuota).toBe(5);
    expect(loadConfig({ ANALYSIS_DAILY_QUOTA: '0' }).analysisDailyQuota).toBe(0);
  });

  it('reads the optional YouTube extractor configuration', () => {
    const config = loadConfig({
      YOUTUBE_EXTRACTOR_URL: 'https://extractor.example.com',
      YOUTUBE_EXTRACTOR_TOKEN: 'secret',
    });
    expect(config.youtubeExtractorUrl).toBe('https://extractor.example.com');
    expect(config.youtubeExtractorToken).toBe('secret');
  });

  it('requires a token when the extractor URL is set', () => {
    expect(() => loadConfig({ YOUTUBE_EXTRACTOR_URL: 'https://extractor.example.com' })).toThrow(
      'YOUTUBE_EXTRACTOR_TOKEN',
    );
  });

  it('requires Google auth and Cloud Run details for the analysis worker', () => {
    expect(() => loadConfig({ ANALYSIS_JOB_NAME: 'chordifree-analysis' })).toThrow(
      'CLOUD_RUN_REGION and GOOGLE_CLOUD_PROJECT',
    );
    expect(() =>
      loadConfig({
        ANALYSIS_JOB_NAME: 'chordifree-analysis',
        CLOUD_RUN_REGION: 'europe-west1',
        GOOGLE_CLOUD_PROJECT: 'chordifree',
      }),
    ).toThrow('AUTH_MODE=google');

    const config = loadConfig({
      AUTH_MODE: 'google',
      ANALYSIS_JOB_NAME: 'chordifree-analysis',
      CLOUD_RUN_REGION: 'europe-west1',
      GOOGLE_CLOUD_PROJECT: 'chordifree',
    });
    expect(config.analysisJobName).toBe('chordifree-analysis');
    expect(config.cloudRunRegion).toBe('europe-west1');
  });
});
