# Face Attendance — React + FastAPI

A real-time face recognition attendance system, converted from a static
HTML/CSS/JS + FastAPI app into:

- **backend/** — FastAPI, organized into a small `app/` package
  (config, models loader, face service, routers) instead of one big `main.py`.
  Uses OpenCV YuNet (face detection) + SFace (face recognition).
- **frontend/** — React (Vite) single-page app with 3 routes:
  `/` (Live Camera), `/log` (Attendance Log), `/register` (Register People).

There are two ways to run this project: **Docker (recommended, one command)**
or **manual local setup (two terminals)**. Pick whichever you prefer.

---

## Option A — Run with Docker (easiest)

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running.

**Step 1 — Open a terminal in the project's root folder**
(the folder that contains `docker-compose.yml`, `backend/`, and `frontend/`).

```bash
cd project
```

**Step 2 — Build and start both services**

```bash
docker compose up --build
```

What this does:

- Reads `docker-compose.yml`, which defines two services: `backend` and `frontend`.
- Builds the `backend` image from `backend/Dockerfile` (installs Python + OpenCV
  system libraries, then `pip install`s everything in `requirements.txt`).
- Builds the `frontend` image from `frontend/Dockerfile` (installs npm packages,
  runs `npm run build`, then serves the built files with nginx).
- Starts both containers, connected on an internal Docker network so the
  frontend's nginx can proxy `/api/*` calls straight to the backend container
  — no CORS setup or extra config needed.
- `--build` forces a fresh image build; leave it off on later runs if you
  haven't changed any code and just want to restart faster.

**Step 3 — Open the app**

- Frontend (the actual UI): **http://localhost:8080**
- Backend API directly (optional, for testing): **http://localhost:8000/api/health**

if you view to save jpg
docker compose exec backend ls -la known_faces/

**Step 4 — Stop the app**

Press `Ctrl+C` in the terminal, then (optional, fully removes the containers):

```bash
docker compose down
```

Registered face photos and downloaded models are kept in Docker _named
volumes_ (`backend-models`, `backend-known-faces`), so they survive
`docker compose down` / restarts. To wipe them completely:

```bash
docker compose down -v
```

---

## Option B — Manual local setup (two terminals)

Useful during active development, since code changes reload instantly
without rebuilding any Docker image.

### Terminal 1 — Backend

**Step 1 — Go into the backend folder**

```bash
cd backend
```

**Step 2 — (Optional but recommended) create a virtual environment**

```bash
python -m venv venv
source venv/bin/activate        # on Windows: venv\Scripts\activate
```

**Step 3 — Install Python dependencies**

```bash
pip install -r requirements.txt
```

**Step 4 — Start the backend server**

```bash
python run.py
```

This starts FastAPI on **http://localhost:8000**. On the very first run it
downloads ~37MB of ONNX models into `backend/models/` — this only happens once.

### Terminal 2 — Frontend

**Step 1 — Go into the frontend folder**

```bash
cd frontend
```

**Step 2 — Install npm dependencies**

```bash
npm install
```

**Step 3 — Start the dev server**

```bash
npm run dev
```
```

This starts Vite on **http://localhost:5173**. Its dev server automatically
proxies any `/api/*` call to `http://localhost:8000` (configured in
`vite.config.js`), so the frontend and backend talk to each other with zero
extra setup.

**Step 4 — Open the app**

Go to **http://localhost:5173** in your browser.

---

## Project structure

```
project/
├── docker-compose.yml
├── .gitignore
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── run.py
│   └── app/
│       ├── main.py           # FastAPI app + CORS setup
│       ├── config.py         # paths, constants, allowed CORS origins
│       ├── models_loader.py  # downloads + builds YuNet/SFace models
│       ├── face_service.py   # FaceService: detection, recognition, attendance state
│       ├── utils.py          # image decoding helpers
│       └── routers/
│           ├── recognition.py   # POST /api/recognize
│           ├── registration.py  # POST /api/register, GET/DELETE /api/registered
│           └── attendance.py    # GET/DELETE /api/attendance
└── frontend/
    ├── Dockerfile
    ├── nginx.conf            # serves the build + proxies /api to the backend
    ├── .dockerignore
    ├── package.json
    ├── vite.config.js
    └── src/
        ├── main.jsx / App.jsx
        ├── api.js              # fetch wrapper for the backend API
        ├── components/         # Layout (nav/header), ToastContext
        ├── pages/               # LiveCamera, AttendanceLog, RegisterPeople
        └── styles/              # CSS split by page/concern
```