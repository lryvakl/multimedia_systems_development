#!/usr/bin/env bash
# Generates short test media in every supported container (requires ffmpeg).
set -euo pipefail

OUT_DIR="$(cd "$(dirname "$0")/.." && pwd)/samples"
mkdir -p "$OUT_DIR"

command -v ffmpeg >/dev/null || { echo "ffmpeg is required: https://ffmpeg.org/download.html" >&2; exit 1; }

AUDIO_SRC=(-f lavfi -i "sine=frequency=220:duration=20" -f lavfi -i "sine=frequency=330:duration=20"
  -filter_complex "[0][1]amix=inputs=2,volume=2,afade=t=in:d=1,afade=t=out:st=18:d=2")
VIDEO_SRC=(-f lavfi -i "testsrc2=size=1280x720:rate=30:duration=20" -f lavfi -i "sine=frequency=440:duration=20")
FFMPEG=(ffmpeg -hide_banner -loglevel error -y)

"${FFMPEG[@]}" "${AUDIO_SRC[@]}" -c:a libmp3lame -b:a 192k "$OUT_DIR/tone.mp3"
"${FFMPEG[@]}" "${AUDIO_SRC[@]}" -c:a pcm_s16le "$OUT_DIR/tone.wav"
"${FFMPEG[@]}" "${AUDIO_SRC[@]}" -c:a vorbis -strict experimental -ac 2 "$OUT_DIR/tone.ogg"
"${FFMPEG[@]}" "${AUDIO_SRC[@]}" -c:a flac "$OUT_DIR/tone.flac"
"${FFMPEG[@]}" "${AUDIO_SRC[@]}" -c:a aac -b:a 160k "$OUT_DIR/tone.m4a"

"${FFMPEG[@]}" "${VIDEO_SRC[@]}" -c:v libx264 -pix_fmt yuv420p -c:a aac -shortest "$OUT_DIR/testcard.mp4"
"${FFMPEG[@]}" "${VIDEO_SRC[@]}" -c:v libvpx-vp9 -b:v 1M -c:a libopus -shortest "$OUT_DIR/testcard.webm"
"${FFMPEG[@]}" "${VIDEO_SRC[@]}" -c:v libx264 -pix_fmt yuv420p -c:a libopus -shortest "$OUT_DIR/testcard.mkv"

cat >"$OUT_DIR/testcard.srt" <<'SRT'
1
00:00:01,000 --> 00:00:05,000
Test subtitles (SubRip)

2
00:00:06,000 --> 00:00:12,000
Player converts SRT to WebVTT
SRT

echo "Samples written to $OUT_DIR:"
ls -1 "$OUT_DIR"
