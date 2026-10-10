'use strict';

const { session } = require('electron');

const MEDIA_RESOURCE_TYPES = new Set(['media', 'xhr', 'other']);

/**
 * Remote media is loaded with crossOrigin="anonymous" (needed by the Web Audio
 * visualizer, frame capture and HLS/DASH segment fetches), but many media hosts
 * omit CORS headers. They are injected here for media requests of this app only.
 */
function relaxCorsForMedia() {
  session.defaultSession.webRequest.onHeadersReceived(
    { urls: ['http://*/*', 'https://*/*'] },
    (details, callback) => {
      if (!MEDIA_RESOURCE_TYPES.has(details.resourceType)) {
        callback({});
        return;
      }
      const headers = Object.fromEntries(
        Object.entries(details.responseHeaders ?? {}).filter(
          ([name]) => !name.toLowerCase().startsWith('access-control-'),
        ),
      );
      headers['Access-Control-Allow-Origin'] = ['*'];
      headers['Access-Control-Allow-Headers'] = ['*'];
      headers['Access-Control-Expose-Headers'] = ['*'];
      callback({ responseHeaders: headers });
    },
  );
}

module.exports = { relaxCorsForMedia };
