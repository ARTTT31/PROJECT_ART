# CCTV (MediaMTX on Render)

**Purpose:** deploy the `art-workspace-cctv` service that turns the shop camera's RTSP stream into HLS the `/camera` page can play, and record every value that has to be set outside the repository.

Browsers cannot play RTSP. MediaMTX runs on Render, **pulls** the camera's RTSP stream and republishes it as HLS on the single HTTP port Render routes traffic to.

---

## 1. Shape

| Piece | Value |
|---|---|
| Camera | TP-Link RTSP server, `192.168.1.43:554`, Basic auth |
| Camera path (usable) | `/stream2` — H.264, 1280x720, 25 fps |
| Camera path (do **not** use) | `/stream1` — H.265, every browser refuses to decode it (LIVE badge, black frame) |
| MediaMTX | `1.21.4`, HLS variant `mpegts`, segment 1s, count 7 |
| Render service | `art-workspace-cctv`, `runtime: docker`, region `singapore` |
| Manifest URL | `https://art-workspace-cctv.onrender.com/camera1/index.m3u8` |
| Repository files | `mediamtx/Dockerfile`, `mediamtx/start.sh`, `render.yaml` (service `art-workspace-cctv`) |

`mediamtx/start.sh` generates `mediamtx.yml` at boot because MediaMTX cannot read environment variables and Render assigns `$PORT` at runtime. It also disables every protocol Render cannot route (`rtmp`, `srt`, `webrtc`, `moq`) and keeps RTSP on loopback, so exactly one port is public.

The camera has to be reachable **from Render**, so a `192.168.x.x` URL only works after step 2.

---

## 2. Publish the camera (router port-forward + DDNS)

Render pulls the stream, so no inbound port is needed on Render — but the camera must answer on a public address.

1. **Reserve the camera's LAN address.** In the router's DHCP table, bind `192.168.1.43` to the camera's MAC so the forward does not point at nothing after a reboot.
2. **Forward the RTSP port.** Router admin (`192.168.1.1`) → NAT / Port Forwarding → *external* TCP **15554** → `192.168.1.43:554`. Use a non-default external port; 554 is scanned continuously.
3. **Add DDNS.** The ISP address is PPPoE **dynamic** (it changes on reconnect), so a hostname is required:
   - the router's built-in DDNS, or
   - a `*.duckdns.org` host updated by the router (Custom DDNS) or any always-on LAN client.
4. **Verify from outside the LAN.** NAT loopback usually fails on consumer routers, so test from mobile data, not from the shop Wi-Fi:

   ```bash
   # RTSP/1.0 200 = reachable and the credentials were accepted;
   # 401 = reachable but wrong password; connection timeout = the forward or DDNS is wrong.
   curl -sv --max-time 15 "rtsp://<user>:<pass>@<ddns-host>:15554/stream2" 2>&1 | grep -i 'RTSP/1.0'
   ```

   If the service address is in `100.64.0.0/10` the line is behind CGNAT: port-forwarding cannot work and a relay inside the LAN is unavoidable.

The camera password must be URL-encoded in the RTSP URL — `@` becomes `%40`:

```
rtsp://ART%40IOT31:<password>@<ddns-host>:15554/stream2
```

---

## 3. Create the Render service

**Blueprint:** New → Blueprint → point at this repository; `render.yaml` defines both services.

**Manual:** New → Web Service → Docker, then:

| Field | Value |
|---|---|
| Name | `art-workspace-cctv` |
| Dockerfile Path | `mediamtx/Dockerfile` |
| Docker Context Directory | `mediamtx` |
| Health Check Path | *(empty — MediaMTX exposes no probe endpoint)* |
| Auto-Deploy | on |

Environment:

| Key | Value | Notes |
|---|---|---|
| `CCTV_PATH` | `camera1` | Becomes the manifest path: `/{CCTV_PATH}/index.m3u8` |
| `CCTV_RTSP_URL` | `rtsp://ART%40IOT31:<password>@<ddns-host>:15554/stream2` | **Secret.** Must be the H.264 `/stream2`; `/stream1` is H.265 |
| `CCTV_ALLOWED_ORIGINS` | `https://<frontend-origin>` | Comma-separated CORS allow-list. `*` accepts anyone; tighten it before real use |

`CCTV_RTSP_URL` is the only value the image needs; without it the container exits at boot with `CCTV_RTSP_URL is required`. Never commit it — put it in the Render dashboard (`sync: false` in `render.yaml`).

The free plan spins down after 15 idle minutes; the first viewer then waits ~1 min for a cold start and the camera panel shows its retry state. Use the starter plan when the stream must be up on first open.

---

## 4. Point the frontend at it

`NEXT_PUBLIC_*` values are inlined at build time, so set the variable **and redeploy**:

```bash
NEXT_PUBLIC_CCTV_STREAMS=[{"id":"front-door","name":"หน้าร้าน","location":"ภายนอก — ประตูหน้า","url":"https://art-workspace-cctv.onrender.com/camera1/index.m3u8","fps":25,"resolution":"1280x720"}]
```

- `next.config.js` derives `media-src` / `connect-src` from this variable and already allows `https://*.onrender.com`, so no CSP edit is needed for the onrender hostname. A custom domain has to be added the same way (it is parsed from the variable at build time).
- The list seeds the page only when the account has **no saved layout**. If `user.camera_config` (or the account-scoped `localStorage` key) exists, it wins: edit that camera to *HLS Live* with the manifest URL, or clear the saved layout.

---

## 5. Verify

```bash
CCTV=https://art-workspace-cctv.onrender.com
ORIGIN=https://<frontend-origin>
```

```bash
# 1. Master playlist. Expect: 302 (cookieCheck) then 200 application/vnd.apple.mpegurl,
#    with CODECS="avc1…" and RESOLUTION=1280x720. HEVC here means /stream1 was used.
curl -sS -L -D - "$CCTV/camera1/index.m3u8"

# 2. CORS for the deployed frontend. Expect the same origin in
#    Access-Control-Allow-Origin.
curl -sS -L -H "Origin: $ORIGIN" -D - -o /dev/null "$CCTV/camera1/index.m3u8" \
  | grep -i 'http/\|access-control-allow-origin\|content-type'

# 3. A foreign origin must NOT receive Access-Control-Allow-Origin.
curl -sS -L -H "Origin: https://example.com" -D - -o /dev/null "$CCTV/camera1/index.m3u8" \
  | grep -i 'access-control-allow-origin' || echo 'no ACAO (correct)'

# 4. Segments carry video, not an error page. Expect content-type video/mp2t.
curl -sS -L -c /tmp/cctv.jar -b /tmp/cctv.jar -o /tmp/v.m3u8 "$CCTV/camera1/index.m3u8"
curl -sS -L -c /tmp/cctv.jar -b /tmp/cctv.jar -o /tmp/vs.m3u8 "$CCTV/camera1/main_stream.m3u8"
SEG=$(grep '\.ts$' /tmp/vs.m3u8 | tail -1)
curl -sS -L -b /tmp/cctv.jar -o /tmp/seg.ts -w '%{http_code} %{content_type}\n' "$CCTV/camera1/$SEG"
```

Then open `/camera` signed in: the panel must show a moving picture, `LIVE`, and no console error. The 302 + `Set-Cookie: cookieCheck` on the first request is normal.

Render log lines that confirm health:

```
[path camera1] stream is available and online, 2 tracks (H264, G711)
[HLS] [muxer camera1] is converting into HLS, 1 track (H264)
```

G.711 audio is dropped on purpose: HLS carries video only here.

---

## 6. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `LIVE` badge but black frame | `/stream1` (H.265) in `CCTV_RTSP_URL` | Use `/stream2` (H.264) |
| Render log `stream is not available` / `401` | Wrong password, wrong port, or DDNS host stale | Re-check the URL outside the LAN (step 2) |
| Panel shows the Thai error + Retry immediately | Cold start on the free plan, or the camera is offline | Retry, or move to the starter plan |
| Console: CORS / blocked request | `CCTV_ALLOWED_ORIGINS` does not equal the frontend origin exactly | Exact `https://…` origin, no trailing slash, no wildcard path |
| Console: mixed content / cookie rejected | HLS reached over `http://` while the page is `https://` | Always use the `https://<service>.onrender.com` URL |
| Manifest URL was changed but the page still shows the old one | `NEXT_PUBLIC_CCTV_STREAMS` not rebuilt, or a saved `camera_config` wins | Redeploy the frontend; clear or edit the saved layout |
| `302` loops forever | Cookies disabled in the browser profile | Enable cookies for the frontend origin |

## 7. Security

- Port-forwarding RTSP publishes the camera to the whole internet with Basic auth (base64, not encrypted). Change the camera's password from the vendor default, use a non-standard external port, and rotate `CCTV_RTSP_URL` on Render when it leaks — it also appears in any support log that prints the env.
- `CCTV_ALLOWED_ORIGINS` limits who can *read* the stream from a browser; it is not authentication. Anyone who obtains the manifest URL can watch it directly.
- Keep `/camera` behind the existing page-access guard. That guard protects the page, not the stream: the manifest URL itself is the secret.
