import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/ToastContext";
import { useConfirm } from "../components/ConfirmContext";
import { IconCamera, IconTrash, IconCheckCircle } from "../components/Icons";
import EmptyState from "../components/EmptyState";
import "../styles/camera-mgmt.css";
import "../styles/users.css";

export default function CameraManagement() {
  const toast = useToast();
  const confirm = useConfirm();

  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add/Edit modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [rtspUrl, setRtspUrl] = useState("");
  const [fps, setFps] = useState(15);

  useEffect(() => {
    loadCameras();
    // Poll camera statuses periodically
    const interval = setInterval(loadCameras, 6000);
    return () => clearInterval(interval);
  }, []);

  async function loadCameras() {
    try {
      const data = await api.getCameras();
      setCameras(data);
    } catch (err) {
      /* silent during polling */
    } finally {
      setLoading(false);
    }
  }

  function openAddModal() {
    setName("");
    setLocation("");
    setRtspUrl("");
    setFps(15);
    setTestResult(null);
    setIsModalOpen(true);
  }

  async function handleTestConnection() {
    if (!rtspUrl.trim()) {
      toast("Please enter an RTSP URL or device index first", "error");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const res = await api.testCameraSource(rtspUrl.trim());
      setTestResult(res);
      if (res.success) {
        toast(res.message, "success");
      } else {
        toast(res.message, "error");
      }
    } catch (err) {
      setTestResult({ success: false, message: err.message || "Failed to reach camera" });
      toast(err.message || "Connection failed", "error");
    } finally {
      setTesting(false);
    }
  }

  async function handleSaveCamera(e) {
    e.preventDefault();
    if (!name.trim() || !location.trim() || !rtspUrl.trim()) {
      toast("Please fill in all required fields", "error");
      return;
    }

    setSaving(true);
    try {
      await api.createCamera({
        name: name.trim(),
        location: location.trim(),
        rtsp_url: rtspUrl.trim(),
        fps: parseInt(fps, 10) || 15,
      });
      toast(`Camera "${name}" registered successfully!`, "success");
      setIsModalOpen(false);
      loadCameras();
    } catch (err) {
      toast(err.data?.detail || err.message || "Failed to save camera", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(camera) {
    const ok = await confirm(
      `Remove camera "${camera.name}" located at "${camera.location}"? Live streaming and detection for this source will stop immediately.`,
      {
        title: "Delete Camera?",
        confirmLabel: "Delete",
        danger: true,
      }
    );
    if (!ok) return;

    try {
      await api.deleteCamera(camera.id);
      toast(`Camera "${camera.name}" removed`, "info");
      loadCameras();
    } catch (err) {
      toast(err.message || "Failed to delete camera", "error");
    }
  }

  return (
    <div className="cam-container">
      <div className="cam-header">
        <div>
          <h1 className="erp-title">
            <IconCamera /> CCTV Camera Management
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Connect and configure RTSP IP cameras, buses, and classroom feeds for live AI surveillance.
          </p>
        </div>

        <button className="btn btn-primary" onClick={openAddModal}>
          <IconCamera /> + Add CCTV Camera
        </button>
      </div>

      {loading ? (
        <div style={{ padding: "3rem", textAlign: "center", color: "var(--ink-dim)" }}>
          <span className="spinner" /> Loading cameras...
        </div>
      ) : cameras.length === 0 ? (
        <EmptyState icon={<IconCamera />}>
          No CCTV cameras configured yet. Click "+ Add CCTV Camera" to connect an RTSP stream (e.g. Bus CCTV, Classroom CCTV) or local camera.
        </EmptyState>
      ) : (
        <div className="cam-grid">
          {cameras.map((cam) => {
            const streamUrl = api.getCameraStreamUrl(cam.id);
            const isOnline = cam.status === "online";

            return (
              <div key={cam.id} className="cam-card">
                {/* Live Stream / Preview box */}
                <div className="cam-preview-box">
                  <img
                    src={streamUrl}
                    alt={cam.name}
                    className="cam-stream-img"
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                  <div className="cam-status-overlay">
                    <span className={`status-dot ${isOnline ? "online" : "offline"}`} />
                    <span style={{ color: isOnline ? "var(--match)" : "var(--ink-dim)" }}>
                      {isOnline ? "LIVE" : "OFFLINE"}
                    </span>
                  </div>
                </div>

                {/* Info body */}
                <div className="cam-body">
                  <div className="cam-name-row">
                    <div>
                      <h3 className="cam-title">{cam.name}</h3>
                      <span className="cam-loc">📍 {cam.location}</span>
                    </div>
                    <span className="badge badge-dept">{cam.fps || 15} FPS</span>
                  </div>

                  <div className="cam-url-mono" title={cam.rtsp_url}>
                    {cam.rtsp_url}
                  </div>

                  <div className="cam-actions">
                    <button
                      className="btn-remove"
                      title="Delete Camera"
                      onClick={() => handleDelete(cam)}
                    >
                      <IconTrash />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Camera Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !saving && setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Connect CCTV Camera</h3>
              <button
                className="modal-close"
                onClick={() => !saving && setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveCamera}>
              <div className="modal-body">
                <div className="form-group">
                  <label>Camera Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Bus CCTV, Classroom A CCTV"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Location *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. College Bus 1, Classroom A"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>RTSP Stream URL or Device Index *</label>
                  <div style={{ display: "flex", gap: "0.5rem" }}>
                    <input
                      type="text"
                      required
                      placeholder="rtsp://admin:pass@192.168.1.100:554/stream1 or 0"
                      value={rtspUrl}
                      onChange={(e) => setRtspUrl(e.target.value)}
                    />
                    <button
                      type="button"
                      className="btn btn-secondary"
                      disabled={testing || !rtspUrl.trim()}
                      onClick={handleTestConnection}
                    >
                      {testing ? "Testing..." : "Test Stream"}
                    </button>
                  </div>
                  <small style={{ color: "var(--ink-dim)", marginTop: "0.35rem", display: "block" }}>
                    Tip: For USB or local laptop cameras, enter <code>0</code> or <code>1</code>. For IP cameras, enter the full RTSP URL.
                  </small>
                </div>

                {testResult && (
                  <div
                    style={{
                      padding: "0.6rem 0.85rem",
                      borderRadius: "var(--radius-md)",
                      fontSize: "0.85rem",
                      background: testResult.success
                        ? "rgba(74, 222, 128, 0.12)"
                        : "rgba(239, 68, 68, 0.12)",
                      color: testResult.success ? "var(--match)" : "var(--alert)",
                      border: `1px solid ${testResult.success ? "rgba(74, 222, 128, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
                    }}
                  >
                    {testResult.success ? "✓ " : "⚠ "} {testResult.message}
                  </div>
                )}

                <div className="form-group">
                  <label>Processing FPS (Frames Per Second)</label>
                  <select value={fps} onChange={(e) => setFps(e.target.value)}>
                    <option value={10}>10 FPS (Low CPU)</option>
                    <option value={15}>15 FPS (Recommended)</option>
                    <option value={20}>20 FPS (High Performance)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={saving}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving || !name.trim() || !location.trim() || !rtspUrl.trim()}
                >
                  {saving ? (
                    <>
                      <span className="spinner" /> Saving…
                    </>
                  ) : (
                    <>
                      <IconCheckCircle /> Add Camera
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
