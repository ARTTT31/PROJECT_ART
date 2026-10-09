# 🚀 Technical Migration & Deployment Document
**Project:** ART Workspace  
**Document Purpose:** Record the history of migrating the system from Localhost to Cloud Production Environment, including troubleshooting and solutions.

---

## 1. Cloud Infrastructure Architecture
The system is designed and separated into parts for easy scaling and maintenance, using the following cloud services:

* **Frontend:** Developed with Next.js and deployed on **Vercel** for optimal client-side delivery performance (Edge Network).
* **Backend:** Developed with FastAPI and deployed as a Web Service on **Render**, which is suitable for processing and handling asynchronous connections.
* **Database:** Uses PostgreSQL running on **Neon.tech** (Serverless Postgres) for flexibility in connection pool management.

---

## 2. Key Changes & Configurations

### 2.1 Environment Variables Configuration
For the code on Render to communicate with external services correctly, important Environment Variables were configured as follows:
* `BACKEND_GOOGLE_CLIENT_ID`: Client ID from Google Cloud Console
* `BACKEND_GOOGLE_CLIENT_SECRET`: Secret from Google Cloud Console
* `BACKEND_GOOGLE_REDIRECT`: URL to receive callbacks from Google, must point to Render's domain (e.g., `https://<render-domain>/api/v1/auth/google/callback`)
* `DATABASE_URL`: Connection String to connect to Neon.tech database
* `FRONTEND_URL`: URL of the frontend running on Vercel, used to redirect back with data after a successful login
* `CORS_ORIGINS`: Comma-separated frontend origins; required because cookies cannot be combined with wildcards
* `TRUSTED_PROXY_IPS`: Optional. Leave empty on Render — the platform load balancer is a private address, which is trusted by default. Set it explicitly only when the proxy is not loopback/RFC1918, otherwise every request looks like it comes from that proxy and one client can exhaust the shared rate-limit budget.
* `SESSION_CLEANUP_INTERVAL_HOURS`: Optional (default `6`, `0` disables). Expired sessions are deleted by an in-app scheduler instead of needing a cron job.
* `WS_BROADCAST_REDIS_URL`: Optional. Set it to the same Redis used by `SLOWAPI_STORAGE_URI` when running more than one instance, so a broadcast reaches the clients of every instance.
* `NEXT_PUBLIC_WS_URL` (Vercel): Optional. Set it to the backend origin when the `/api` rewrite forwards plain requests but drops the WebSocket upgrade.

### 2.2 Migrating Database Connection Architecture to Asynchronous System
To prevent Event Loop Blocked issues on FastAPI, we changed the database connection architecture from Synchronous to fully Asynchronous:
* Changed from using `create_engine` to `create_async_engine`
* Changed the session manager from `sessionmaker` to `async_sessionmaker` bound to `AsyncSession`
* Upgraded the database driver in `requirements.txt` to use `asyncpg`

### 2.3 Authentication Hardening (2026-10)
The API now ships with several security defaults that deployments must be aware of:
* `CSRF_PROTECTION_ENABLED` (default `True`): cookie-authenticated writes must send the `X-CSRF-Token` header echoing the readable `csrf_token` cookie. Login/register/refresh/Google endpoints stay exempt so a session can always be established or renewed.
* `ENABLE_API_DOCS` (default `False`): `/docs`, `/redoc` and `/openapi.json` are only served when this is `True` (or when `DEBUG=True`).
* `SECRET_KEY` must be at least 32 characters and must not be a placeholder when `DEBUG=False`, otherwise the API refuses to start.
* Security headers: strict CSP with `connect-src` derived from `CORS_ORIGINS`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, and HSTS with `includeSubDomains; preload` outside `DEBUG`.
* Google Sign-In uses the authorization-code flow (`/api/v1/auth/google` → `/api/v1/auth/google/callback`) instead of implicit tokens in the browser URL.

### 2.4 Health Checks and Release Verification
The backend answers two probes; which one a platform points at changes what a database outage does to traffic:
* `GET /health` — liveness plus a real `SELECT 1` (2s timeout). Always `200`, with `status: healthy|degraded` and a `database` object.
* `GET /health/ready` — readiness. `503` while the database is unreachable, so a platform health check or load balancer stops routing to an instance that cannot serve.

Every response also carries `X-Request-ID` and the same value appears as `rid=…` in the logs, so a reported failure can be traced to the exact request.

Alembic remains the only schema authority, and CI now applies the chain (`alembic upgrade head`) and checks for model drift (`alembic check`) on every push — a broken revision fails the build instead of the deployment.

### 2.5 Enabling SSL Security (Database Connection)
Connecting to a Managed Database like Neon requires data transmission through an encrypted channel:
* Embedded the `connect_args={"ssl": True}` parameter at the SQLAlchemy Engine level to force `asyncpg` to always operate via SSL Mode.

---

## 3. Troubleshooting & Bug Fixes

During the cloud migration, the main issues encountered and successfully resolved are as follows:

### 🔴 Issue 1: `Error 400: redirect_uri_mismatch` (Google OAuth side)
* **Cause:** The source and destination URLs for OAuth did not match those in the system.
* **Solution:** Configured in the Google Cloud Console (API & Services > Credentials) to update **Authorized JavaScript origins** to match the Vercel domain and **Authorized redirect URIs** to match the Render path (`/api/v1/auth/google/callback`).

### 🔴 Issue 2: `connection is insecure (try using sslmode=require)`
* **Cause:** Python's `asyncpg` driver does not allow connecting to Neon database without encryption.
* **Solution:** Removed the `?sslmode=require` query string from the end of the original `DATABASE_URL` and enabled the `{"ssl": True}` option in `connect_args` when creating `create_async_engine` instead.

### 🔴 Issue 3: `InvalidPasswordError` (Database connection)
* **Cause:** Incorrect password or Connection String, or not using the password for Neon's Connection Pooling.
* **Solution:** Cleaned up the connection string and switched to using the latest Pooler Connection String copied directly from the Neon dashboard.

### 🔴 Issue 4: `AttributeError: 'AsyncSession' object has no attribute 'query'`
* **Cause:** Calling the `.query()` method is a Syntax for Synchronous sessions, which is not supported on `AsyncSession`.
* **Solution:** Refactored the query syntax in the sub-services (e.g., `user_service.py`), switched to using SQLAlchemy 2.0's `select(...)` statement instead, and executed data via `await db.execute(...)`.

### 🔴 Issue 5: `AttributeError: 'coroutine' object has no attribute 'email'`
* **Cause:** An asynchronous/coroutine user checking function (e.g., `get_user_by_email`) was called, but the `await` keyword was forgotten to wait for the result, causing the returned data to remain a Coroutine object.
* **Solution:** Added the `await` keyword before asynchronous function calls in `auth.py` and all Service files to properly unpack the Model data before using it to generate a JWT Token.

### 🔴 Issue 6: "App not verified" warning screen during Google login
* **Cause:** The OAuth project on Google Cloud was still restricted to Testing mode.
* **Solution:** Changed the Publishing Status within the OAuth Consent Screen menu from **Testing** to **In Production** to unlock access for general Google accounts.

### 🔴 Issue 7: `HTTP 502 Bad Gateway` on Weather Forecast and GPS Reverse-Geocode
* **Cause:** Render shared egress IPs are rate-limited / throttled by external free API tiers (Open-Meteo for weather forecast, BigDataCloud for reverse geocoding), resulting in 429/502 errors when querying uncached coordinates.
* **Solution:**
  * Added automated failover to **MET Norway (`api.met.no`)** Locationforecast 2.0 when Open-Meteo fails.
  * Added automated failover to **OpenStreetMap Nominatim** when BigDataCloud fails, plus a graceful coordinates-only 200 OK fallback.
  * Persisted both responses into L1 memory and L2 Neon database (`weather_cache`) to protect future requests.

---

## 4. Current System Status
✅ **Status:** **LIVE (Production Ready)**
* The project can be successfully built and deployed 100% on both frontend (Vercel) and backend (Render) services.
* The API system is operating and ready to handle loads (Green Status).
* The login workflow (OAuth Callback Sequence) can communicate seamlessly between Vercel, Render, and Google.
* The database connection creates/saves user data and issues JWT Token security tickets to authorize secure dashboard access.

---

## 5. Docker-less & Fully Cloud-Managed (Completed)

**Status: done.** Docker was removed in commit `f4ad5d7` ("remove docker & fully migrate to serverless stack") — there is no `Dockerfile` or `docker-compose.yml` in the tree, and the schema is owned by Alembic rather than by startup repairs. What follows is the resulting setup, kept as the developer reference.

### 5.1 Target Architecture
* **No need to install Docker/Docker Desktop** on the developer's machine.
* **No local database running** (moved to connect directly with Neon.tech via encrypted channel).
* **GitHub-Driven Deployment (CI/CD):** 
  * All code edits will be done on the local machine (editing plain files).
  * When executing `git push` to push code to GitHub:
    * **Vercel** will be responsible for pulling frontend code to build and serve on the web automatically (Free).
    * **Render** will be responsible for pulling backend code to run as a Web Service automatically (Free).
    * Everything connects wirelessly to the **Neon.tech** database (Serverless Postgres Free).

### 5.2 Docker-less Local Development Workflow
Developers can write code and test the system locally right away with native tools:

#### A. For Backend (FastAPI):
1. Open Command Line and navigate to the `/backend` folder
2. Create a Python virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the environment:
   * Windows PowerShell: `.\venv\Scripts\Activate.ps1`
   * Windows Command Prompt: `.\venv\Scripts\activate.bat`
   * macOS/Linux: `source venv/bin/activate`
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
5. Run the backend server:
   ```bash
   uvicorn app.main:app --reload --port 8080
   ```

#### B. For Frontend (Next.js):
1. Open another Command Line window and navigate to the `/frontend` folder
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the frontend server:
   ```bash
   npm run dev
   ```

### 5.3 Benefits (realised)
1. **Reduced machine resource usage:** no RAM and CPU consumed by Docker Desktop.
2. **Development Speed:** hot reload runs directly against the OS file system.
3. **Reduced Complexity:** no `Dockerfile` or `docker-compose.yml` to maintain.

> Schema note: because there is no container-side startup hook, `alembic upgrade head` is the only way the production schema changes. Run it before deploying the backend.
