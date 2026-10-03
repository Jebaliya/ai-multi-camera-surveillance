import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/ToastContext";
import {
  IconCamera,
  IconPlay,
  IconStop,
  IconUpload,
  IconCheckCircle,
} from "../components/Icons";
import EmptyState from "../components/EmptyState";
import "../styles/camera.css";

export default function LiveMonitoring() {
  const toast = useToast();

  // Mode: "cctv" or "webcam"
  const [activeMode, setActiveMode] = useState("cctv");

  // CCTV cameras state
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [viewLayout, setViewLayout] = useState("grid"); // "grid" or "focus"

  // Webcam state
  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const photoInputRef = useRef(null);
  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const isProcessingRef = useRef(false);

  const [webcamOnline, setWebcamOnline] = useState(false);
  const [showWebcamPlaceholder, setShowWebcamPlaceholder] = useState(true);
  const [recentDetections, setRecentDetections] = useState([]);

  useEffect(() => {
    loadCameras();
    return () => stopWebcam();
  }, []);

  async function loadCameras() {
    try {
      const data = await api.getCameras();
      setCameras(data);
      if (data.length > 0 && !selectedCameraId) {
        setSelectedCameraId(data[0].id);
      }
    } catch (_) {
      /* silent */
    }
  }

  // ── Webcam Processing ─────────────────────────────────────
  async function startWebcam() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
      streamRef.current = stream;
      const video = videoRef.current;
      video.srcObject = stream;
      video.style.display = "";

      video.onloadedmetadata = () => {
        if (overlayRef.current) {
          overlayRef.current.width = video.videoWidth;
          overlayRef.current.height = video.videoHeight;
        }
      };

      setShowWebcamPlaceholder(false);
      setWebcamOnline(true);
      loopRef.current = setInterval(processWebcamFrame, 1200);
    } catch (err) {
      toast("Camera access denied or unavailable.", "error");
    }
  }

  function stopWebcam() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    if (overlayRef.current) {
      const ctx = overlayRef.current.getContext("2d");
      ctx.clearRect(0, 0, overlayRef.current.width, overlayRef.current.height);
    }
    setShowWebcamPlaceholder(true);
    setWebcamOnline(false);
  }

  async function processWebcamFrame() {
    if (isProcessingRef.current || !streamRef.current || !videoRef.current) return;
    isProcessingRef.current = true;

    try {
      const video = videoRef.current;
      const c = document.createElement("canvas");
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0);
      const dataUrl = c.toDataURL("image/jpeg", 0.75);

      const data = await api.recognize(dataUrl);
      drawWebcamDetections(data.faces);

      // Add to recent detections feed
      if (data.faces && data.faces.length > 0) {
        const timestamp = new Date().toLocaleTimeString();
        const newDetections = data.faces
          .filter((f) => f.name !== "Unknown")
          .map((f) => ({
            name: f.name,
            role: f.role || "User",
            score: f.score,
            time: timestamp,
            location: "Browser Webcam",
          }));
        if (newDetections.length > 0) {
          setRecentDetections((prev) => [...newDetections, ...prev].slice(0, 10));
        }
      }
    } catch (_) {
      /* silent */
    }

    isProcessingRef.current = false;
  }

  function drawWebcamDetections(faces) {
    const overlay = overlayRef.current;
    if (!overlay) return;
    const ctx = overlay.getContext("2d");
    ctx.clearRect(0, 0, overlay.width, overlay.height);

    for (const f of faces) {
      const isKnown = f.name !== "Unknown";
      const color = isKnown ? "#2dd4bf" : "#f87171";

      ctx.strokeStyle = color;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(f.left, f.top, f.right - f.left, f.bottom - f.top);

      const label = `${f.name} (${Math.round(f.score * 100)}%)`;
      ctx.font = "600 13px 'JetBrains Mono', monospace";
      const tw = ctx.measureText(label).width;

      ctx.fillStyle = color;
      ctx.fillRect(f.left, Math.max(0, f.top - 22), tw + 8, 22);

      ctx.fillStyle = "#052e2b";
      ctx.fillText(label, f.left + 4, Math.max(15, f.top - 6));
    }
  }

  return (
    <div className="cam-container">
      {/* Top Header & Mode Toggle */}
      <div className="cam-header">
        <div>
          <h1 className="erp-title">
            <IconCamera /> Live Surveillance &amp; Recognition
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Real-time face detection and person recognition across CCTV cameras and local streams.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div className="erp-tabs">
            <button
              className={`erp-tab ${activeMode === "cctv" ? "active" : ""}`}
              onClick={() => {
                stopWebcam();
                setActiveMode("cctv");
              }}
            >
              CCTV Cameras ({cameras.length})
            </button>
            <button
              className={`erp-tab ${activeMode === "webcam" ? "active" : ""}`}
              onClick={() => setActiveMode("webcam")}
            >
              Browser Webcam
            </button>
          </div>
        </div>
      </div>

      {/* CCTV Multi-Camera Mode */}
      {activeMode === "cctv" && (
        <div>
          {cameras.length === 0 ? (
            <EmptyState icon={<IconCamera />}>
              No CCTV cameras found. Go to "CCTV Cameras" to add RTSP or webcam sources.
            </EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Layout Switcher */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "0.5rem" }}>
                  {cameras.map((c) => (
                    <button
                      key={c.id}
                      className={`btn ${selectedCameraId === c.id ? "btn-primary" : "btn-secondary"}`}
                      style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
                      onClick={() => {
                        setSelectedCameraId(c.id);
                        setViewLayout("focus");
                      }}
                    >
                      {c.name}
                    </button>
                  ))}
                </div>

                <div style={{ display: "flex", gap: "0.5rem" }}>
                  <button
                    className={`btn ${viewLayout === "grid" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
                    onClick={() => setViewLayout("grid")}
                  >
                    Grid View
                  </button>
                  <button
                    className={`btn ${viewLayout === "focus" ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "0.35rem 0.75rem", fontSize: "0.85rem" }}
                    onClick={() => setViewLayout("focus")}
                  >
                    Focus View
                  </button>
                </div>
              </div>

              {/* Grid View */}
              {viewLayout === "grid" ? (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns:
                      cameras.length === 1 ? "1fr" : "repeat(auto-fit, minmax(440px, 1fr))",
                    gap: "1.25rem",
                  }}
                >
                  {cameras.map((cam) => {
                    const streamUrl = api.getCameraStreamUrl(cam.id);
                    return (
                      <div
                        key={cam.id}
                        className="cam-card"
                        style={{ background: "var(--void)", border: "1px solid var(--line)" }}
                      >
                        <div style={{ position: "relative", minHeight: "280px", background: "#000" }}>
                          <img
                            src={streamUrl}
                            alt={cam.name}
                            style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                          <div className="cam-status-overlay">
                            <span className="status-dot online" />
                            <span style={{ color: "var(--match)" }}>LIVE AI</span>
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "0.85rem 1.25rem",
                            display: "flex",
                            justifyContent: "space-between",
                            background: "var(--panel)",
                          }}
                        >
                          <div>
                            <strong style={{ color: "var(--ink)", display: "block" }}>
                              {cam.name}
                            </strong>
                            <span style={{ fontSize: "0.8rem", color: "var(--signal)" }}>
                              📍 {cam.location}
                            </span>
                          </div>
                          <span className="badge badge-dept">{cam.fps || 15} FPS</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Focus View */
                <div>
                  {(() => {
                    const focused = cameras.find((c) => c.id === selectedCameraId) || cameras[0];
                    const streamUrl = api.getCameraStreamUrl(focused.id);
                    return (
                      <div className="cam-card" style={{ background: "#000" }}>
                        <div style={{ position: "relative", minHeight: "480px" }}>
                          <img
                            src={streamUrl}
                            alt={focused.name}
                            style={{ width: "100%", maxHeight: "580px", objectFit: "contain" }}
                          />
                          <div className="cam-status-overlay">
                            <span className="status-dot online" />
                            <span style={{ color: "var(--match)" }}>LIVE AI RECOGNITION</span>
                          </div>
                        </div>
                        <div
                          style={{
                            padding: "1rem 1.5rem",
                            background: "var(--panel)",
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <div>
                            <h2 style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                              {focused.name}
                            </h2>
                            <p style={{ color: "var(--signal-strong)", fontSize: "0.9rem" }}>
                              📍 Location: {focused.location} &nbsp;|&nbsp; Stream: {focused.rtsp_url}
                            </p>
                          </div>
                          <span className="badge badge-dept">{focused.fps || 15} FPS</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Browser Webcam Mode */}
      {activeMode === "webcam" && (
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.5rem" }}>
          {/* Video Stream Container */}
          <section className="card camera-section">
            <div className="card-header">
              <h2>
                <IconCamera /> Browser Webcam Feed
              </h2>
              <div className="controls">
                {!webcamOnline ? (
                  <button className="btn btn-primary" onClick={startWebcam}>
                    <IconPlay /> Start Webcam
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={stopWebcam}>
                    <IconStop /> Stop
                  </button>
                )}
              </div>
            </div>

            <div className="viewfinder">
              <div className="video-wrap">
                <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%" }} />
                <canvas ref={overlayRef} className="overlay-canvas" />
                {showWebcamPlaceholder && (
                  <div className="placeholder">
                    <span className="placeholder-icon">
                      <IconCamera />
                    </span>
                    <p>Webcam is stopped</p>
                    <small>Click "Start Webcam" above to begin facial recognition</small>
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Real-time Recognition Feed */}
          <section className="card">
            <div className="card-header">
              <h3>Live Sighting Stream</h3>
            </div>
            <div style={{ padding: "1rem" }}>
              {recentDetections.length === 0 ? (
                <EmptyState icon={<IconCheckCircle />}>
                  No persons sighted recently. Start camera to detect faces.
                </EmptyState>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                  {recentDetections.map((d, i) => (
                    <div
                      key={i}
                      style={{
                        padding: "0.6rem 0.85rem",
                        background: "var(--panel-raised)",
                        borderRadius: "var(--radius-md)",
                        border: "1px solid var(--line)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div>
                        <strong style={{ color: "var(--ink)" }}>{d.name}</strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-dim)" }}>
                          {d.role} • {d.location}
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.75rem",
                            color: "var(--match)",
                          }}
                        >
                          {Math.round(d.score * 100)}%
                        </span>
                        <div style={{ fontSize: "0.7rem", color: "var(--ink-dim)" }}>{d.time}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
