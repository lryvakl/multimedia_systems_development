import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  evaluateProbeResponse,
  getExtension,
  getMediaKind,
  getStreamType,
  isSubtitleFile,
  isSupportedMediaFile,
  normalizeMediaUrl,
  titleFromUrl,
} from '../src/shared/formats.js';

test('getExtension handles paths, URLs, query strings and case', () => {
  assert.equal(getExtension('/music/Song.MP3'), 'mp3');
  assert.equal(getExtension('C:\\Videos\\clip.webm'), 'webm');
  assert.equal(getExtension('https://cdn.example.com/live/index.m3u8?token=1#t=5'), 'm3u8');
  assert.equal(getExtension('archive.tar.gz'), 'gz');
  assert.equal(getExtension('https://demo.dev/live/channel.isml/.m3u8'), 'm3u8');
  assert.equal(getExtension('README'), '');
  assert.equal(getExtension(''), '');
});

test('getMediaKind classifies audio, video and unknown sources', () => {
  for (const name of ['a.mp3', 'a.wav', 'a.ogg', 'a.flac', 'a.m4a']) assert.equal(getMediaKind(name), 'audio');
  for (const name of ['v.mp4', 'v.webm', 'v.mkv', 'v.mov', 'stream.m3u8']) assert.equal(getMediaKind(name), 'video');
  assert.equal(getMediaKind('notes.txt'), 'unknown');
});

test('getStreamType detects HLS and DASH manifests', () => {
  assert.equal(getStreamType('https://x.dev/a/master.m3u8'), 'hls');
  assert.equal(getStreamType('https://x.dev/a/manifest.mpd?x=1'), 'dash');
  assert.equal(getStreamType('https://x.dev/a/video.mp4'), 'progressive');
});

test('isSupportedMediaFile accepts local media only, isSubtitleFile accepts vtt/srt', () => {
  assert.equal(isSupportedMediaFile('movie.mp4'), true);
  assert.equal(isSupportedMediaFile('playlist.m3u8'), false);
  assert.equal(isSupportedMediaFile('image.png'), false);
  assert.equal(isSubtitleFile('movie.SRT'), true);
  assert.equal(isSubtitleFile('movie.vtt'), true);
  assert.equal(isSubtitleFile('movie.ass'), false);
});

test('normalizeMediaUrl validates and normalizes user input', () => {
  assert.deepEqual(normalizeMediaUrl('  https://example.com/a.mp4 '), { ok: true, url: 'https://example.com/a.mp4' });
  assert.deepEqual(normalizeMediaUrl('example.com/a.mp3'), { ok: true, url: 'https://example.com/a.mp3' });
  assert.equal(normalizeMediaUrl('').ok, false);
  assert.equal(normalizeMediaUrl('ftp://example.com/a.mp3').ok, false);
  assert.equal(normalizeMediaUrl('file:///etc/passwd').ok, false);
  assert.equal(normalizeMediaUrl('javascript:alert(1)').ok, false);
  assert.equal(normalizeMediaUrl('http://').ok, false);
});

test('titleFromUrl uses the decoded last path segment or the host', () => {
  assert.equal(titleFromUrl('https://example.com/media/My%20Song.mp3'), 'My Song.mp3');
  assert.equal(titleFromUrl('https://example.com/'), 'example.com');
});

test('evaluateProbeResponse rejects HTTP errors with readable messages', () => {
  const url = 'https://e.com/a.mp4';
  assert.match(evaluateProbeResponse({ url, status: 404 }).error, /not found/);
  assert.match(evaluateProbeResponse({ url, status: 403 }).error, /denied/);
  assert.match(evaluateProbeResponse({ url, status: 503 }).error, /HTTP 503/);
});

test('evaluateProbeResponse accepts media content types and generic binaries', () => {
  const ok = (url, contentType) => evaluateProbeResponse({ url, status: 200, contentType });
  assert.deepEqual(ok('https://e.com/a.mp4', 'video/mp4'), { ok: true, streamType: 'progressive' });
  assert.deepEqual(ok('https://e.com/a.mp3', 'audio/mpeg; charset=binary'), { ok: true, streamType: 'progressive' });
  assert.deepEqual(ok('https://e.com/a.webm', 'application/octet-stream'), { ok: true, streamType: 'progressive' });
  assert.deepEqual(ok('https://e.com/a.ogg', null), { ok: true, streamType: 'progressive' });
  assert.equal(evaluateProbeResponse({ url: 'https://e.com/a.mp4', status: 206, contentType: 'video/mp4' }).ok, true);
});

test('evaluateProbeResponse detects HLS/DASH by content type or manifest extension', () => {
  const probe = (url, contentType) => evaluateProbeResponse({ url, status: 200, contentType });
  assert.equal(probe('https://e.com/live', 'application/vnd.apple.mpegurl').streamType, 'hls');
  assert.equal(probe('https://e.com/stream?id=1', 'audio/mpegurl').streamType, 'hls');
  assert.equal(probe('https://e.com/manifest', 'application/dash+xml').streamType, 'dash');
  assert.equal(probe('https://e.com/a.m3u8', 'text/plain').streamType, 'hls');
  assert.equal(probe('https://e.com/a.mpd', 'application/xml').streamType, 'dash');
});

test('evaluateProbeResponse rejects web pages and other non-media resources', () => {
  const probe = (url, contentType) => evaluateProbeResponse({ url, status: 200, contentType });
  assert.match(probe('https://e.com/watch?v=1', 'text/html; charset=utf-8').error, /web page/);
  assert.match(probe('https://e.com/fake.mp4', 'text/html').error, /web page/);
  assert.match(probe('https://e.com/cat.png', 'image/png').error, /image\/png/);
  assert.equal(probe('https://e.com/data.json', 'application/json').ok, false);
});
