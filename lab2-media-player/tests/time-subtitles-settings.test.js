import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bufferedEnd, clamp, formatTime, positionToTime } from '../src/renderer/js/core/time.js';
import { srtToVtt } from '../src/renderer/js/core/subtitles.js';
import { DEFAULT_SETTINGS, Settings } from '../src/renderer/js/core/settings.js';

const timeRanges = (...ranges) => ({
  length: ranges.length,
  start: (i) => ranges[i][0],
  end: (i) => ranges[i][1],
});

test('formatTime renders m:ss, h:mm:ss and placeholders', () => {
  assert.equal(formatTime(0), '0:00');
  assert.equal(formatTime(5.9), '0:05');
  assert.equal(formatTime(75), '1:15');
  assert.equal(formatTime(3725), '1:02:05');
  assert.equal(formatTime(65, { forceHours: true }), '0:01:05');
  assert.equal(formatTime(NaN), '--:--');
  assert.equal(formatTime(Infinity), '--:--');
  assert.equal(formatTime(-1), '--:--');
});

test('clamp and positionToTime map pointer positions to media time', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-1, 0, 3), 0);
  assert.equal(positionToTime(50, 200, 120), 30);
  assert.equal(positionToTime(-10, 200, 120), 0);
  assert.equal(positionToTime(500, 200, 120), 120);
  assert.equal(positionToTime(50, 200, NaN), 0);
  assert.equal(positionToTime(50, 0, 120), 0);
});

test('bufferedEnd returns the end of the range containing the playhead', () => {
  const buffered = timeRanges([0, 10], [20, 35]);
  assert.equal(bufferedEnd(buffered, 4), 10);
  assert.equal(bufferedEnd(buffered, 25), 35);
  assert.equal(bufferedEnd(buffered, 15), 15);
  assert.equal(bufferedEnd(timeRanges(), 3), 3);
});

test('srtToVtt converts SubRip cues and timestamps', () => {
  const srt = '﻿1\r\n00:00:01,500 --> 00:00:04,000\r\nHello\r\n\r\n2\r\n00:00:05,000 --> 00:00:06,250\r\nWorld\r\nline 2\r\n';
  assert.equal(
    srtToVtt(srt),
    'WEBVTT\n\n00:00:01.500 --> 00:00:04.000\nHello\n\n00:00:05.000 --> 00:00:06.250\nWorld\nline 2\n',
  );
});

test('srtToVtt returns WebVTT unchanged', () => {
  const vtt = 'WEBVTT\n\n00:01.000 --> 00:02.000\nHi\n';
  assert.equal(srtToVtt(vtt), vtt);
});

function memoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), data };
}

test('Settings falls back to defaults on missing or corrupted storage', () => {
  assert.deepEqual(new Settings(null).values, { ...DEFAULT_SETTINGS });
  const corrupted = memoryStorage({ 'player.settings.v1': '{not json' });
  assert.equal(new Settings(corrupted).get('volume'), DEFAULT_SETTINGS.volume);
});

test('Settings persists values and keeps a de-duplicated recent URL list', () => {
  const storage = memoryStorage();
  const settings = new Settings(storage);
  settings.set('volume', 0.3);
  for (let i = 0; i < 10; i += 1) settings.addRecentUrl(`https://e.com/${i}.mp4`);
  settings.addRecentUrl('https://e.com/5.mp4');

  const restored = new Settings(storage);
  assert.equal(restored.get('volume'), 0.3);
  assert.equal(restored.get('recentUrls').length, 5);
  assert.equal(restored.get('recentUrls')[0], 'https://e.com/5.mp4');
  assert.equal(restored.get('recentUrls').filter((url) => url.endsWith('/5.mp4')).length, 1);
});

test('Settings tolerates storage write failures', () => {
  const settings = new Settings({
    getItem: () => null,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  });
  assert.doesNotThrow(() => settings.set('volume', 0.1));
  assert.equal(settings.get('volume'), 0.1);
});
