# CCTV edge for the Workspace.
#
# Browsers cannot play RTSP, so MediaMTX pulls the camera stream and republishes
# it as HLS. Render routes exactly one HTTP port per web service, therefore only
# the HLS listener is exposed and every other protocol stays on loopback or is
# switched off entirely.
#
# The official image is a scratch image (single layer, no /bin/sh), so its
# statically linked binary is staged onto alpine instead of running it directly:
# start.sh needs a shell to turn $PORT into a MediaMTX config.
FROM bluenviron/mediamtx:1.21.4 AS mediamtx

FROM alpine:3.21

COPY --from=mediamtx /mediamtx /usr/local/bin/mediamtx
COPY start.sh /usr/local/bin/cctv-start.sh
RUN chmod +x /usr/local/bin/cctv-start.sh /usr/local/bin/mediamtx

# Path name used in the manifest URL (/{CCTV_PATH}/index.m3u8).
ENV CCTV_PATH=camera1
EXPOSE 10000

ENTRYPOINT ["/usr/local/bin/cctv-start.sh"]
