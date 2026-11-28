#!/bin/sh
# Render assigns the HTTP port at runtime through $PORT, and MediaMTX's YAML
# cannot read environment variables, so the config is generated here instead of
# being baked into the image.
set -eu

PORT="${PORT:-10000}"
NAME="${CCTV_PATH:-camera1}"
SRC="${CCTV_RTSP_URL:?CCTV_RTSP_URL is required, e.g. rtsp://user:pass@host:554/stream2}"
ORIGINS="${CCTV_ALLOWED_ORIGINS:-*}"
CONFIG="${CCTV_CONFIG_PATH:-/mediamtx.yml}"

# "https://a,https://b" -> ['https://a', 'https://b']; "*" keeps every origin.
if [ "$ORIGINS" = "*" ]; then
  ORIGIN_LIST="['*']"
else
  LIST=""
  OLD_IFS="$IFS"
  IFS=','
  for origin in $ORIGINS; do
    trimmed=$(printf '%s' "$origin" | tr -d ' ')
    [ -n "$trimmed" ] && LIST="$LIST'$trimmed',"
  done
  IFS="$OLD_IFS"
  ORIGIN_LIST="[${LIST%,}]"
fi

cat > "$CONFIG" <<EOF
logLevel: info
logDestinations: [stdout]

api: no
metrics: no
pprof: no
playback: no

# Ingest happens by pulling the camera, so nothing has to reach RTSP from the
# internet; the listener stays on loopback.
rtsp: yes
rtspAddress: 127.0.0.1:8554
rtspTransports: [tcp]
rtpAddress: 127.0.0.1:8000
rtcpAddress: 127.0.0.1:8001

rtmp: no
srt: no
webrtc: no
moq: no

hls: yes
hlsAddress: :$PORT
hlsAllowOrigins: $ORIGIN_LIST
hlsVariant: mpegts
hlsSegmentCount: 7
hlsSegmentDuration: 1s

paths:
  $NAME:
    source: "$SRC"
    sourceOnDemand: yes
    sourceOnDemandCloseAfter: 30s
    rtspTransport: tcp
EOF

echo "[cctv] serving /$NAME/index.m3u8 on :$PORT"
exec /usr/local/bin/mediamtx "$CONFIG"
