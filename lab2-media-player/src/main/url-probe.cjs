"use strict";

const { net } = require("electron");
const {
  evaluateProbeResponse,
  normalizeMediaUrl,
} = require("../shared/formats.js");

const PROBE_TIMEOUT_MS = 10_000;
const HEAD_REJECTED_STATUSES = new Set([400, 403, 405, 501]);
const NETWORK_ERRORS = {
  ERR_NAME_NOT_RESOLVED: "The host name could not be resolved",
  ERR_CONNECTION_REFUSED: "The server refused the connection",
  ERR_INTERNET_DISCONNECTED: "No internet connection",
  ERR_ADDRESS_UNREACHABLE: "The server is unreachable",
};

async function request(url, method) {
  const response = await net.fetch(url, {
    method,
    headers: method === "GET" ? { Range: "bytes=0-1023" } : {},
    signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
  });
  await response.body?.cancel();
  return {
    status: response.status,
    contentType: response.headers.get("content-type"),
  };
}

function describeNetworkError(error) {
  if (error.name === "TimeoutError")
    return `The server did not respond within ${PROBE_TIMEOUT_MS / 1000} s`;
  const code = /net::(ERR_[A-Z_]+)/.exec(error.message)?.[1];
  if (code?.startsWith("ERR_CERT_"))
    return "The server has an invalid TLS certificate";
  return (
    NETWORK_ERRORS[code] ?? `Could not reach the server (${error.message})`
  );
}

/**
 * Checks that a URL is reachable and serves playable media before it is opened.
 * HEAD is tried first; servers that reject it get a one-kilobyte ranged GET.
 * @param {string} input
 */
async function probeMediaUrl(input) {
  const normalized = normalizeMediaUrl(input);
  if (!normalized.ok) return normalized;
  const { url } = normalized;
  try {
    let response = await request(url, "HEAD");
    if (HEAD_REJECTED_STATUSES.has(response.status))
      response = await request(url, "GET");
    const verdict = evaluateProbeResponse({ url, ...response });
    return verdict.ok ? { ...verdict, url } : verdict;
  } catch (error) {
    return { ok: false, error: describeNetworkError(error) };
  }
}

module.exports = { probeMediaUrl };
