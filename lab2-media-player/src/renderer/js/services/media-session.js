/**
 * Integrates with OS media controls (media keys, macOS Now Playing, Windows SMTC).
 * @param {import('../core/player.js').Player} player
 * @param {import('../ui/commands.js').CommandRegistry} commands
 */
export function bindMediaSession(player, commands) {
  const { mediaSession } = navigator;
  if (!mediaSession) return;

  const handlers = {
    play: () => player.play(),
    pause: () => player.pause(),
    stop: () => commands.run('stop'),
    previoustrack: () => commands.run('previous'),
    nexttrack: () => commands.run('next'),
    seekbackward: () => commands.run('backward'),
    seekforward: () => commands.run('forward'),
    seekto: ({ seekTime }) => player.seek(seekTime),
  };
  for (const [action, handler] of Object.entries(handlers)) mediaSession.setActionHandler(action, handler);

  player.addEventListener('sourcechange', () => {
    mediaSession.metadata = player.source
      ? new MediaMetadata({ title: player.source.title, artist: 'Player' })
      : null;
  });
  player.addEventListener('statechange', () => {
    mediaSession.playbackState = player.isPlaying ? 'playing' : player.source ? 'paused' : 'none';
  });
  const updatePosition = () => {
    if (!player.canSeek) return;
    mediaSession.setPositionState({
      duration: player.duration,
      position: Math.min(player.currentTime, player.duration),
      playbackRate: player.playbackRate,
    });
  };
  for (const type of ['durationchange', 'ratechange', 'seeked', 'playing']) {
    player.addEventListener(type, updatePosition);
  }
}
