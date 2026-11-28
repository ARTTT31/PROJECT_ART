#!/bin/sh
# Render assigns the HTTP port at runtime through $PORT, and MediaMTX's YAML
# cannot read environment variables, so the config is generated here instead of
# being baked into the image.
#
# Caddy listens on :$PORT and exposes both:
#   /*           -> MediaMTX HLS (127.0.0.1:8888)
#   /_control/*  -> MediaMTX Control API (127.0.0.1:9997), gated by Bearer token
set -eu

PORT="${PORT:-10000}"
NAME="${CCTV_PATH:-camera1}"
SRC="${CCTV_RTSP_URL:-}"
CONTROL_SECRET="${CCTV_CONTROL_SECRET:-}"
ORIGINS="${CCTV_ALLOWED_ORIGINS:-*}"
CONFIG="${CCTV_CONFIG_PATH:-/mediamtx.yml}"
CADDYFILE="${CCTV_CADDYFILE_PATH:-/etc/caddy/Caddyfile}"

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

if [ -n "$CONTROL_SECRET" ]; then
  API_ENABLED="yes"
else
  API_ENABLED="no"
fi

cat > "$CONFIG" <<EOF
logLevel: info
logDestinations: [stdout]

api: $API_ENABLED
apiAddress: 127.0.0.1:9997
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
hlsAddress: 127.0.0.1:8888
hlsAllowOrigins: $ORIGIN_LIST
hlsVariant: mpegts
hlsSegmentCount: 7
hlsSegmentDuration: 1s

EOF

if [ -n "$SRC" ]; then
  cat >> "$CONFIG" <<EOF
paths:
  $NAME:
    source: "$SRC"
    sourceOnDemand: yes
    sourceOnDemandCloseAfter: 30s
    rtspTransport: tcp
EOF
else
  cat >> "$CONFIG" <<EOF
paths: {}
EOF
fi

mkdir -p "$(dirname "$CADDYFILE")"
if [ -n "$CONTROL_SECRET" ]; then
  cat > "$CADDYFILE" <<EOF
{
  admin off
  auto_https off
}

:$PORT {
  handle_path /_control/* {
    @unauthorized not header Authorization "Bearer $CONTROL_SECRET"
    respond @unauthorized 403
    reverse_proxy 127.0.0.1:9997
  }
  handle {
    reverse_proxy 127.0.0.1:8888
  }
}
EOF
else
  cat > "$CADDYFILE" <<EOF
{
  admin off
  auto_https off
}

:$PORT {
  handle /_control/* {
    respond 403
  }
  handle {
    reverse_proxy 127.0.0.1:8888
  }
}
EOF
fi

echo "[cctv] starting mediamtx + caddy on :$PORT (control_api=$API_ENABLED)"
/usr/local/bin/mediamtx "$CONFIG" &
MTX_PID=$!

trap 'kill "$MTX_PID" 2>/dev/null || true' INT TERM

caddy run --config "$CADDYFILE" --adapter caddyfile &
CADDY_PID=$!

# Exit if either process dies so Render restarts the container cleanly.
while kill -0 "$MTX_PID" 2>/dev/null && kill -0 "$CADDY_PID" 2>/dev/null; do
  sleep 2
done
kill "$MTX_PID" "$CADDY_PID" 2>/dev/null || true
exit 1
