// Thin wrapper around fetch for the backend API.
// Vite's dev proxy forwards /api/* to the FastAPI server (see vite.config.js),
// so relative paths work in both dev and a same-origin production build.

// In dev, Vite's proxy forwards /api/* to localhost:8000 (see vite.config.js),
// so the default "/api" works with no setup. In production (e.g. Vercel), set
// VITE_API_BASE_URL to your deployed backend's URL, e.g.:
//   VITE_API_BASE_URL=https://face-attendance-backend.onrender.com/api
const BASE = import.meta.env.VITE_API_BASE_URL || "/api";

async function asJson(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.detail || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  // ── Existing Face Recognition & Legacy Methods ──────────────
  recognize: (imageDataUrl) =>
    fetch(`${BASE}/recognize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: imageDataUrl }),
    }).then(asJson),

  register: (name, file) => {
    const fd = new FormData();
    fd.append("name", name);
    fd.append("image", file);
    return fetch(`${BASE}/register`, { method: "POST", body: fd }).then(asJson);
  },

  getRegistered: () => fetch(`${BASE}/registered`).then(asJson),

  removeRegistered: (name) =>
    fetch(`${BASE}/registered/${encodeURIComponent(name)}`, {
      method: "DELETE",
    }).then(asJson),

  getAttendance: () => fetch(`${BASE}/attendance`).then(asJson),

  getDailyAttendance: (params = {}) => {
    const query = new URLSearchParams();
    if (params.date) query.append("target_date", params.date);
    if (params.role) query.append("role", params.role);
    if (params.department) query.append("department", params.department);
    if (params.search) query.append("search", params.search);
    const qs = query.toString();
    return fetch(`${BASE}/attendance/daily${qs ? `?${qs}` : ""}`).then(asJson);
  },

  getMonthlyAttendance: (year, month, params = {}) => {
    const query = new URLSearchParams({ year, month });
    if (params.role) query.append("role", params.role);
    if (params.department) query.append("department", params.department);
    return fetch(`${BASE}/attendance/monthly?${query.toString()}`).then(asJson);
  },

  getAttendanceExportUrl: (targetDate) => {
    const q = targetDate ? `?target_date=${targetDate}` : "";
    return `${BASE}/attendance/export${q}`;
  },

  deleteAttendanceRecord: (id) =>
    fetch(`${BASE}/attendance/${id}`, { method: "DELETE" }).then(asJson),

  clearAttendance: () =>
    fetch(`${BASE}/attendance`, { method: "DELETE" }).then(asJson),

  getDashboardStats: () => fetch(`${BASE}/dashboard/stats`).then(asJson),


  // ── ERP User Management ─────────────────────────────────────
  getUsers: (params = {}) => {
    const query = new URLSearchParams();
    if (params.role) query.append("role", params.role);
    if (params.department) query.append("department", params.department);
    if (params.search) query.append("search", params.search);
    const qs = query.toString();
    return fetch(`${BASE}/users${qs ? `?${qs}` : ""}`).then(asJson);
  },

  getUser: (id) => fetch(`${BASE}/users/${id}`).then(asJson),

  createUser: (formData) =>
    fetch(`${BASE}/users`, {
      method: "POST",
      body: formData,
    }).then(asJson),

  updateUser: (id, formData) =>
    fetch(`${BASE}/users/${id}`, {
      method: "PUT",
      body: formData,
    }).then(asJson),

  deleteUser: (id) =>
    fetch(`${BASE}/users/${id}`, {
      method: "DELETE",
    }).then(asJson),

  getUserPhotoUrl: (filename) => {
    if (!filename) return null;
    return `${BASE}/faces/${filename}`;
  },

  // ── Camera Management & RTSP ────────────────────────────────
  getCameras: () => fetch(`${BASE}/cameras`).then(asJson),

  getCamera: (id) => fetch(`${BASE}/cameras/${id}`).then(asJson),

  createCamera: (data) =>
    fetch(`${BASE}/cameras`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(asJson),

  updateCamera: (id, data) =>
    fetch(`${BASE}/cameras/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    }).then(asJson),

  deleteCamera: (id) =>
    fetch(`${BASE}/cameras/${id}`, {
      method: "DELETE",
    }).then(asJson),

  testCameraSource: (source) =>
    fetch(`${BASE}/cameras/test-source`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ source }),
    }).then(asJson),

  getCameraStreamUrl: (id) => `${BASE}/cameras/${id}/stream`,

  // ── Multi-Camera Activity Tracking ──────────────────────────
  getActivityLogs: (params = {}) => {
    const query = new URLSearchParams();
    if (params.userId) query.append("user_id", params.userId);
    if (params.cameraId) query.append("camera_id", params.cameraId);
    if (params.date) query.append("log_date", params.date);
    if (params.limit) query.append("limit", params.limit);
    if (params.offset) query.append("offset", params.offset);
    const qs = query.toString();
    return fetch(`${BASE}/activity/logs${qs ? `?${qs}` : ""}`).then(asJson);
  },

  getPersonTimeline: (userId, targetDate) => {
    const query = targetDate ? `?timeline_date=${targetDate}` : "";
    return fetch(`${BASE}/activity/timeline/${userId}${query}`).then(asJson);
  },

  getRecentSightings: () => fetch(`${BASE}/activity/recent`).then(asJson),

  // ── Smart Surveillance Alerts ───────────────────────────────
  getAlerts: (params = {}) => {
    const query = new URLSearchParams();
    if (params.status) query.append("status", params.status);
    if (params.alertType) query.append("alert_type", params.alertType);
    const qs = query.toString();
    return fetch(`${BASE}/alerts${qs ? `?${qs}` : ""}`).then(asJson);
  },

  updateAlertStatus: (id, status) =>
    fetch(`${BASE}/alerts/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then(asJson),

  evaluateAlerts: () =>
    fetch(`${BASE}/alerts/evaluate`, { method: "POST" }).then(asJson),

  deleteAlert: (id) =>
    fetch(`${BASE}/alerts/${id}`, { method: "DELETE" }).then(asJson),
};




