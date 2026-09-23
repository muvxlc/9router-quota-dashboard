import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuotaData } from '../lib/server/normalize.js';

test('normalizeQuotaData collapses real 9router Antigravity model IDs into families', () => {
  const rawAntigravity = {
    plan: 'Google One AI Premium',
    quotas: {
      'gemini-3.8-flash-high': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.8 Flash (High)' },
      'gemini-3.8-flash-medium': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.8 Flash (Medium)' },
      'gemini-3.8-flash-low': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.8 Flash (Low)' },
      'gemini-3.7-flash-high': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.7 Flash (High)' },
      'gemini-3.7-flash-medium': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.7 Flash (Medium)' },
      'gemini-3.7-flash-low': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.7 Flash (Low)' },
      'gemini-3.6-flash-high': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.6 Flash (High)' },
      'gemini-3.5-flash-low': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.5 Flash (Low)' },
      'gemini-pro-agent': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini Pro Agent' },
      'gemini-3.1-pro-low': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Gemini 3.1 Pro (Low)' },
      'claude-sonnet-4-6': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Claude Sonnet 4.6' },
      'claude-opus-4-6-thinking': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'Claude Opus 4.6 (Thinking)' },
      'gpt-oss-120b-medium': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46.3, unlimited: false, displayName: 'GPT-OSS 120B (Medium)' },
      'gemini-3.1-flash-image': { used: 0, total: 1000, resetAt: null, remainingPercentage: 100, unlimited: false, displayName: 'Gemini 3.1 Flash Image' },
      'gemini_weekly': { used: 100, total: 1000, resetAt: '2026-09-28T00:00:00.000Z', remainingPercentage: 90, unlimited: false, displayName: 'Gemini (Weekly)' },
      'claude_gpt_weekly': { used: 200, total: 1000, resetAt: '2026-09-28T00:00:00.000Z', remainingPercentage: 80, unlimited: false, displayName: 'Claude & GPT (Weekly)' },
    },
  };

  const normalized = normalizeQuotaData('c-test-1', 'antigravity', rawAntigravity);
  assert.equal(normalized.status, 'ok');

  // Should collapse 16 models into 6 windows: gemini, claude, gpt, image, gemini_weekly, claude_gpt_weekly
  assert.equal(normalized.windows.length, 6);

  const keys = normalized.windows.map((w) => w.key);
  assert.ok(keys.includes('gemini'));
  assert.ok(keys.includes('claude'));
  assert.ok(keys.includes('gpt'));
  assert.ok(keys.includes('gemini-3.1-flash-image'));
  assert.ok(keys.includes('gemini_weekly'));
  assert.ok(keys.includes('claude_gpt_weekly'));

  const geminiWin = normalized.windows.find((w) => w.key === 'gemini');
  assert.equal(geminiWin.remainingPercent, 46.3);
  assert.equal(geminiWin.label, 'Gemini (Flash / Pro)');

  const claudeWin = normalized.windows.find((w) => w.key === 'claude');
  assert.equal(claudeWin.remainingPercent, 46.3);
  assert.equal(claudeWin.label, 'Claude (Sonnet / Opus)');

  const gptWin = normalized.windows.find((w) => w.key === 'gpt');
  assert.equal(gptWin.remainingPercent, 46.3);
  assert.ok(gptWin.label.includes('GPT-OSS'));

  const imageWin = normalized.windows.find((w) => w.key === 'gemini-3.1-flash-image');
  assert.equal(imageWin.remainingPercent, 100);
  assert.equal(imageWin.label, 'Gemini 3.1 Flash Image');
});

test('normalizeQuotaData collapses Antigravity models keyed by display names', () => {
  const rawWithDisplayNames = {
    quotas: {
      'Gemini 3.1 Pro High': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46 },
      'Gemini 3.8 Flash Low': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46 },
      'Claude Opus 4.6 Thinking': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46 },
      'Claude Sonnet 4.6 Thinking': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46 },
      'GPT-OSS 120B Medium': { used: 537, total: 1000, resetAt: '2026-09-21T18:00:00.000Z', remainingPercentage: 46 },
      'Gemini 3.1 Flash Image': { used: 0, total: 1000, resetAt: null, remainingPercentage: 100 },
      'Gemini Weekly': { used: 100, total: 1000, resetAt: '2026-09-28T00:00:00.000Z', remainingPercentage: 90 },
      'Claude & GPT Weekly': { used: 200, total: 1000, resetAt: '2026-09-28T00:00:00.000Z', remainingPercentage: 80 },
    },
  };

  const normalized = normalizeQuotaData('c-test-2', 'antigravity', rawWithDisplayNames);
  assert.equal(normalized.windows.length, 6);

  const keys = normalized.windows.map((w) => w.key);
  assert.ok(keys.includes('gemini'));
  assert.ok(keys.includes('claude'));
  assert.ok(keys.includes('gpt'));
});

test('normalizeQuotaData selects pessimistic minimum remaining and same representative', () => {
  const rawMismatched = {
    quotas: {
      'gemini-3.8-flash-high': { used: 400, total: 1000, resetAt: '2026-09-21T14:00:00.000Z', remainingPercentage: 60 },
      'gemini-3.1-pro-low': { used: 800, total: 1000, resetAt: '2026-09-21T19:00:00.000Z', remainingPercentage: 20 },
      'gemini-pro-agent': { used: 500, total: 1000, resetAt: '2026-09-21T16:00:00.000Z', remainingPercentage: 50 },
    },
  };

  const normalized = normalizeQuotaData('c-test-3', 'antigravity', rawMismatched);
  const geminiWin = normalized.windows.find((w) => w.key === 'gemini');
  assert.ok(geminiWin);
  assert.equal(geminiWin.remainingPercent, 20);
  assert.equal(geminiWin.resetAt, new Date('2026-09-21T19:00:00.000Z').toISOString());
  assert.equal(geminiWin.used, 80);
});

test('normalizeQuotaData handles null vs 0 honestly without fake healthy', () => {
  // Model with 0% remaining (exhausted) vs 40% vs malformed null
  const rawWithZeroAndNull = {
    quotas: {
      'gemini-3.8-flash-high': { used: 600, total: 1000, resetAt: '2026-09-21T12:00:00.000Z', remainingPercentage: 40 },
      'gemini-3.1-pro-low': { used: 1000, total: 1000, resetAt: '2026-09-21T15:00:00.000Z', remainingPercentage: 0 },
      'gemini-pro-agent': { used: null, total: null, resetAt: null, remainingPercentage: null },
    },
  };

  const normalized = normalizeQuotaData('c-test-4', 'antigravity', rawWithZeroAndNull);
  const geminiWin = normalized.windows.find((w) => w.key === 'gemini');
  assert.ok(geminiWin);
  // 0% is strictly less than 40%, and null is not fabricated as 100%
  assert.equal(geminiWin.remainingPercent, 0);
  assert.equal(geminiWin.resetAt, new Date('2026-09-21T15:00:00.000Z').toISOString());

  // All members malformed -> remainingPercent is null, not 100
  const allMalformed = {
    quotas: {
      'gemini-3.8-flash-high': { used: null, total: null, resetAt: null, remainingPercentage: null },
    },
  };
  const malformedNorm = normalizeQuotaData('c-test-5', 'antigravity', allMalformed);
  const malformedGemini = malformedNorm.windows.find((w) => w.key === 'gemini');
  assert.ok(malformedGemini);
  assert.equal(malformedGemini.remainingPercent, null);
});

test('normalizeQuotaData preserves actual non-synthetic scale', () => {
  const rawNonSynthetic = {
    quotas: {
      'gemini-custom': { used: 12, total: 50, remainingPercentage: 76, unit: 'req' },
    },
  };
  const normalized = normalizeQuotaData('c-test-6', 'antigravity', rawNonSynthetic);
  const win = normalized.windows.find((w) => w.key === 'gemini');
  assert.ok(win);
  assert.equal(win.used, 12);
  assert.equal(win.total, 50);
  assert.equal(win.remainingPercent, 76);
  assert.equal(win.unit, 'req');
});

test('normalizeQuotaData auto-detects Antigravity provider when provider is unknown', () => {
  const rawAntigravity = {
    quotas: {
      'gemini-3.8-flash-high': { used: 537, total: 1000, remainingPercentage: 46.3 },
      'claude-sonnet-4-6': { used: 537, total: 1000, remainingPercentage: 46.3 },
      'gemini_weekly': { used: 100, total: 1000, remainingPercentage: 90 },
    },
  };
  const normalized = normalizeQuotaData('c-test-7', 'unknown', rawAntigravity);
  assert.equal(normalized.windows.length, 3);
  const keys = normalized.windows.map((w) => w.key);
  assert.ok(keys.includes('gemini'));
  assert.ok(keys.includes('claude'));
  assert.ok(keys.includes('gemini_weekly'));
});

test('normalizeQuotaData keeps separate accounts independent without quota leaking', () => {
  const acc1Raw = {
    quotas: {
      'gemini-3.8-flash-high': { used: 700, total: 1000, remainingPercentage: 30 },
    },
  };
  const acc2Raw = {
    quotas: {
      'gemini-3.8-flash-high': { used: 200, total: 1000, remainingPercentage: 80 },
    },
  };

  const norm1 = normalizeQuotaData('acc-1', 'antigravity', acc1Raw);
  const norm2 = normalizeQuotaData('acc-2', 'antigravity', acc2Raw);

  const win1 = norm1.windows.find((w) => w.key === 'gemini');
  const win2 = norm2.windows.find((w) => w.key === 'gemini');

  assert.equal(win1.remainingPercent, 30);
  assert.equal(win2.remainingPercent, 80);
});
