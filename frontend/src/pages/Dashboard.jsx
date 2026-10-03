import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import {
  IconRadar,
  IconCamera,
  IconCheckCircle,
  IconRegister,
  IconLog,
} from "../components/Icons";
import Avatar from "../components/Avatar";
import EmptyState from "../components/EmptyState";
import "../styles/dashboard.css";
import "../styles/users.css";

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 8000);
    return () => clearInterval(interval);
  }, []);

  async function loadData() {
    try {
      const [statsData, camsData] = await Promise.all([
        api.getDashboardStats(),
        api.getCameras(),
      ]);
      setStats(statsData);
      setCameras(camsData);
    } catch (_) {
      /* silent during background poll */
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="dashboard-container">
      {/* Top Banner */}
      <div className="erp-header">
        <div>
          <h1 className="erp-title">
            <IconRadar /> Surveillance &amp; ERP Overview
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Campus multi-camera monitoring, biometric facial attendance, and person activity status.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem" }}>
          <Link to="/live" className="btn btn-primary">
            <IconRadar /> View Live Surveillance
          </Link>
          <Link to="/users" className="btn btn-secondary">
            <IconRegister /> Register Person
          </Link>
        </div>
      </div>

      {/* KPI Stat Cards Grid */}
      <div className="kpi-grid">
        {/* Total Users */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-teal">
            <IconRegister />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Registered People</span>
            <span className="kpi-value">{stats ? stats.total_users : "—"}</span>
            <span className="kpi-sub">
              {stats ? `${stats.students_count} Students • ${stats.teachers_count} Teachers` : "Loading..."}
            </span>
          </div>
        </div>

        {/* Active Cameras */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-amber">
            <IconCamera />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">CCTV Cameras</span>
            <span className="kpi-value">
              {stats ? `${stats.active_cameras} / ${stats.total_cameras}` : "—"}
            </span>
            <span className="kpi-sub">
              {stats && stats.active_cameras > 0 ? "Cameras streaming online" : "No active streams"}
            </span>
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-green">
            <IconCheckCircle />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Today's Attendance</span>
            <span className="kpi-value">
              {stats ? `${stats.today_attendance_count}` : "—"}
            </span>
            <span className="kpi-sub">
              {stats ? `${stats.attendance_percentage}% present today` : "Loading..."}
            </span>
          </div>
        </div>

        {/* Alerts */}
        <div className="kpi-card">
          <div className="kpi-icon-wrap kpi-icon-rose">
            <IconRadar />
          </div>
          <div className="kpi-data">
            <span className="kpi-label">Surveillance Alerts</span>
            <span className="kpi-value">{stats ? stats.pending_alerts_count : "0"}</span>
            <span className="kpi-sub">
              {stats && stats.pending_alerts_count > 0
                ? "Requires administrative review"
                : "All systems normal"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Split: Live CCTV Cameras Preview & Recent Check-ins */}
      <div className="dashboard-split">
        {/* Left: Connected CCTV Cameras */}
        <div className="erp-table-wrapper" style={{ padding: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                Live CCTV Camera Feeds
              </h3>
              <p style={{ color: "var(--ink-dim)", fontSize: "0.85rem" }}>
                Real-time video feeds with YuNet + SFace recognition overlays
              </p>
            </div>
            <Link to="/cameras" className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
              Manage Cameras
            </Link>
          </div>

          {cameras.length === 0 ? (
            <EmptyState icon={<IconCamera />}>
              No cameras configured. Go to "CCTV Cameras" to add RTSP streams.
            </EmptyState>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns:
                  cameras.length === 1 ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))",
                gap: "1rem",
              }}
            >
              {cameras.slice(0, 4).map((cam) => {
                const streamUrl = api.getCameraStreamUrl(cam.id);
                return (
                  <div
                    key={cam.id}
                    style={{
                      background: "var(--void)",
                      borderRadius: "var(--radius-md)",
                      overflow: "hidden",
                      border: "1px solid var(--line)",
                    }}
                  >
                    <div style={{ position: "relative", height: "190px", background: "#000" }}>
                      <img
                        src={streamUrl}
                        alt={cam.name}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        onError={(e) => {
                          e.target.style.display = "none";
                        }}
                      />
                      <div className="cam-status-overlay">
                        <span className="status-dot online" />
                        <span style={{ color: "var(--match)" }}>LIVE</span>
                      </div>
                    </div>
                    <div
                      style={{
                        padding: "0.75rem 1rem",
                        background: "var(--panel-raised)",
                        display: "flex",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <strong style={{ color: "var(--ink)", fontSize: "0.9rem" }}>
                          {cam.name}
                        </strong>
                        <div style={{ fontSize: "0.75rem", color: "var(--signal)" }}>
                          📍 {cam.location}
                        </div>
                      </div>
                      <span className="badge badge-dept">{cam.fps || 15} FPS</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Today's Recent Check-ins */}
        <div className="erp-table-wrapper" style={{ padding: "1.5rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "1.25rem",
            }}
          >
            <div>
              <h3 style={{ fontFamily: "var(--font-display)", color: "var(--ink)" }}>
                Today's Check-ins
              </h3>
              <p style={{ color: "var(--ink-dim)", fontSize: "0.85rem" }}>
                Live facial attendance events
              </p>
            </div>
            <Link to="/log" className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
              Full Log
            </Link>
          </div>

          {!stats || !stats.recent_attendance || stats.recent_attendance.length === 0 ? (
            <EmptyState icon={<IconCheckCircle />}>
              No check-ins recorded yet today.
            </EmptyState>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {stats.recent_attendance.map((att, i) => (
                <div
                  key={i}
                  style={{
                    padding: "0.75rem 1rem",
                    background: "var(--panel-raised)",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--line)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                    <Avatar name={att.name} size={36} />
                    <div>
                      <strong style={{ color: "var(--ink)", fontSize: "0.9rem" }}>
                        {att.name}
                      </strong>
                      <div style={{ fontSize: "0.75rem", color: "var(--ink-dim)" }}>
                        {att.role}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div
                      style={{
                        fontFamily: "var(--font-mono)",
                        color: "var(--signal-strong)",
                        fontWeight: 600,
                        fontSize: "0.85rem",
                      }}
                    >
                      {att.time}
                    </div>
                    <span
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.7rem",
                        color: "var(--match)",
                      }}
                    >
                      {att.confidence}% Match
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
