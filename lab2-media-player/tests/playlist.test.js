import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Playlist } from '../src/renderer/js/core/playlist.js';

const entries = (...titles) => titles.map((title) => ({ title, url: `file:///${title}`, origin: 'file' }));

function createPlaylist(...titles) {
  const playlist = new Playlist({ random: () => 0 });
  playlist.add(entries(...titles));
  return playlist;
}

test('add returns the index of the first new item and assigns unique ids', () => {
  const playlist = createPlaylist('a', 'b');
  assert.equal(playlist.add(entries('c', 'd')), 2);
  assert.equal(new Set(playlist.items.map((item) => item.id)).size, 4);
});

test('nextIndex walks forward and stops at the end when repeat is off', () => {
  const playlist = createPlaylist('a', 'b', 'c');
  assert.equal(playlist.nextIndex(), 0);
  playlist.select(1);
  assert.equal(playlist.nextIndex(), 2);
  playlist.select(2);
  assert.equal(playlist.nextIndex({ auto: true }), -1);
});

test('repeat "all" wraps around in both directions', () => {
  const playlist = createPlaylist('a', 'b', 'c');
  playlist.setRepeat('all');
  playlist.select(2);
  assert.equal(playlist.nextIndex(), 0);
  playlist.select(0);
  assert.equal(playlist.previousIndex(), 2);
});

test('repeat "one" repeats only automatic advances', () => {
  const playlist = createPlaylist('a', 'b');
  playlist.setRepeat('one');
  playlist.select(0);
  assert.equal(playlist.nextIndex({ auto: true }), 0);
  assert.equal(playlist.nextIndex(), 1);
});

test('previousIndex stays on the first track when repeat is off', () => {
  const playlist = createPlaylist('a', 'b');
  playlist.select(0);
  assert.equal(playlist.previousIndex(), 0);
});

test('cycleRepeat goes off → all → one → off; unknown modes are rejected', () => {
  const playlist = createPlaylist('a');
  assert.deepEqual([playlist.cycleRepeat(), playlist.cycleRepeat(), playlist.cycleRepeat()], ['all', 'one', 'off']);
  assert.throws(() => playlist.setRepeat('forever'), RangeError);
});

test('shuffle visits every track exactly once per cycle, starting after the current one', () => {
  const playlist = new Playlist();
  playlist.add(entries('a', 'b', 'c', 'd', 'e'));
  playlist.select(2);
  playlist.setShuffle(true);
  const visited = [];
  for (let index = playlist.nextIndex(); index !== -1; index = playlist.nextIndex()) {
    visited.push(index);
    playlist.select(index);
  }
  assert.deepEqual([...visited].sort(), [0, 1, 3, 4]);
});

test('remove keeps the current item selected and disposes resources', () => {
  const playlist = createPlaylist('a', 'b', 'c');
  let disposed = false;
  playlist.items[0].dispose = () => (disposed = true);
  playlist.select(2);
  playlist.remove(playlist.items[0].id);
  assert.equal(disposed, true);
  assert.equal(playlist.current.title, 'c');
  playlist.remove(playlist.current.id);
  assert.equal(playlist.current, null);
});

test('change events are emitted on mutations', () => {
  const playlist = createPlaylist('a');
  let changes = 0;
  playlist.addEventListener('change', () => (changes += 1));
  playlist.add(entries('b'));
  playlist.select(1);
  playlist.clear();
  assert.equal(changes, 3);
  assert.equal(playlist.length, 0);
});
