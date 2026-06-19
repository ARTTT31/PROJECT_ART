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

### 2.2 Migrating Database Connection Architecture to Asynchronous System
To prevent Event Loop Blocked issues on FastAPI, we changed the database connection architecture from Synchronous to fully Asynchronous:
* Changed from using `create_engine` to `create_async_engine`
* Changed the session manager from `sessionmaker` to `async_sessionmaker` bound to `AsyncSession`
* Upgraded the database driver in `requirements.txt` to use `asyncpg`

### 2.3 Enabling SSL Security (Database Connection)
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

---

## 4. Current System Status
✅ **Status:** **LIVE (Production Ready)**
* The project can be successfully built and deployed 100% on both frontend (Vercel) and backend (Render) services.
* The API system is operating and ready to handle loads (Green Status).
* The login workflow (OAuth Callback Sequence) can communicate seamlessly between Vercel, Render, and Google.
* The database connection creates/saves user data and issues JWT Token security tickets to authorize secure dashboard access.

---

## 5. Future Roadmap: Transitioning to Docker-less & Fully Cloud-Managed

To reduce the workload on developers' local machines and migrate all processing and execution fully to the cloud (Fully Cloud-Managed), this project plans to **eliminate the use of Docker for development and setup**, with the following approach and steps:

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
   uvicorn app.main:app --reload --port 8000
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

### 5.3 Benefits
1. **Reduce machine resource usage:** No RAM and CPU consumption from running computer simulations via Docker Desktop.
2. **Development Speed:** The Hot-Reload system works at maximum efficiency directly via the OS File System.
3. **Reduce Complexity:** No longer need to maintain `Dockerfile` and `docker-compose.yml` files after the complete transition.
