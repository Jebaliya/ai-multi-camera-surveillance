import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/ToastContext";
import { IconRegister, IconCamera, IconCheckCircle, IconRadar } from "../components/Icons";
import EmptyState from "../components/EmptyState";
import Avatar from "../components/Avatar";
import "../styles/activity.css";
import "../styles/users.css";

export default function PersonActivity() {
  const toast = useToast();

  const [viewMode, setViewMode] = useState("timeline"); // "timeline" or "all_logs"
  const [users, setUsers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split("T")[0]);

  // Timeline state
  const [timeline, setTimeline] = useState([]);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  // All logs state
  const [allLogs, setAllLogs] = useState([]);
  const [loadingLogs, setLoadingLogs] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      loadTimeline(selectedUserId, targetDate);
    }
  }, [selectedUserId, targetDate]);

  useEffect(() => {
    if (viewMode === "all_logs") {
      loadAllLogs();
    }
  }, [viewMode, targetDate]);

  async function loadUsers() {
    try {
      const data = await api.getUsers();
      setUsers(data);
      if (data.length > 0 && !selectedUserId) {
        setSelectedUserId(data[0].id);
      }
    } catch (err) {
      toast("Failed to load people list", "error");
    }
  }

  async function loadTimeline(userId, dateStr) {
    setLoadingTimeline(true);
    try {
      const data = await api.getPersonTimeline(userId, dateStr);
      setTimeline(data);
    } catch (err) {
      toast("Failed to load timeline", "error");
    } finally {
      setLoadingTimeline(false);
    }
  }

  async function loadAllLogs() {
    setLoadingLogs(true);
    try {
      const data = await api.getActivityLogs({ date: targetDate, limit: 100 });
      setAllLogs(data);
    } catch (err) {
      toast("Failed to load activity logs", "error");
    } finally {
      setLoadingLogs(false);
    }
  }

  const selectedUser = users.find((u) => u.id === Number(selectedUserId));

  return (
    <div className="activity-container">
      {/* Header */}
      <div className="erp-header">
        <div>
          <h1 className="erp-title">
            <IconRadar /> Multi-Camera Person Activity Tracking
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Track person movement chronologically across campus CCTV cameras (Buses, Entrances, Classrooms, Labs).
          </p>
        </div>

        <div className="erp-tabs">
          <button
            className={`erp-tab ${viewMode === "timeline" ? "active" : ""}`}
            onClick={() => setViewMode("timeline")}
          >
            Person Timeline
          </button>
          <button
            className={`erp-tab ${viewMode === "all_logs" ? "active" : ""}`}
            onClick={() => setViewMode("all_logs")}
          >
            All Movement Logs
          </button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="activity-filter-bar">
        {viewMode === "timeline" ? (
          <div className="person-select-wrap">
            <label style={{ fontSize: "0.85rem", color: "var(--ink-dim)", fontWeight: 500 }}>
              Select Person:
            </label>
            <select
              style={{
                background: "var(--panel-raised)",
                color: "var(--ink)",
                border: "1px solid var(--line)",
                padding: "0.5rem 0.85rem",
                borderRadius: "var(--radius-md)",
                outline: "none",
                minWidth: "220px",
              }}
              value={selectedUserId || ""}
              onChange={(e) => setSelectedUserId(Number(e.target.value))}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.role} - {u.department})
                </option>
              ))}
            </select>

            {selectedUser && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Avatar name={selectedUser.name} size={32} />
                <span className="badge badge-student">{selectedUser.role}</span>
                <span className="badge badge-dept">{selectedUser.department}</span>
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: "var(--ink)", fontWeight: 500, fontSize: "0.95rem" }}>
            Activity Feed for {targetDate}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <label style={{ fontSize: "0.85rem", color: "var(--ink-dim)" }}>Date:</label>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            style={{
              background: "var(--panel-raised)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              padding: "0.45rem 0.75rem",
              borderRadius: "var(--radius-md)",
              fontFamily: "var(--font-mono)",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* View: Individual Person Timeline */}
      {viewMode === "timeline" && (
        <div className="timeline-card">
          {loadingTimeline ? (
            <div style={{ textAlign: "center", padding: "4rem", color: "var(--ink-dim)" }}>
              <span className="spinner" /> Tracing camera movements...
            </div>
          ) : timeline.length === 0 ? (
            <EmptyState icon={<IconRadar />}>
              No movement activity recorded for {selectedUser?.name || "this person"} on {targetDate}.
              <br />
              <small style={{ color: "var(--ink-dim)", marginTop: "0.5rem", display: "inline-block" }}>
                When this person passes by any connected CCTV camera (e.g. Bus CCTV, Classroom CCTV), their detection timeline will show up here.
              </small>
            </EmptyState>
          ) : (
            <div>
              {/* Timeline Header Metrics */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                  gap: "1rem",
                  marginBottom: "2rem",
                  paddingBottom: "1.5rem",
                  borderBottom: "1px solid var(--line)",
                }}
              >
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--ink-dim)" }}>First Sighted</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--signal-strong)" }}>
                    {timeline[0]?.time}
                  </div>
                  <small style={{ color: "var(--ink-dim)" }}>{timeline[0]?.camera_name}</small>
                </div>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--ink-dim)" }}>Latest Sighted</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--match)" }}>
                    {timeline[timeline.length - 1]?.time}
                  </div>
                  <small style={{ color: "var(--ink-dim)" }}>
                    {timeline[timeline.length - 1]?.camera_name}
                  </small>
                </div>
                <div>
                  <span style={{ fontSize: "0.8rem", color: "var(--ink-dim)" }}>Checkpoints Visited</span>
                  <div style={{ fontSize: "1.2rem", fontWeight: 600, color: "var(--ink)" }}>
                    {timeline.length} Locations
                  </div>
                </div>
              </div>

              {/* Vertical Visual Timeline Flow */}
              <div className="timeline-flow">
                {timeline.map((step, idx) => (
                  <div key={step.id || idx} className="timeline-step">
                    <div className="timeline-node">
                      <div className="timeline-node-inner" />
                    </div>

                    <div className="timeline-content">
                      <div className="timeline-details">
                        <span className="timeline-time-badge">{step.time}</span>
                        <h4>{step.camera_name}</h4>
                        <div className="timeline-location">📍 Location: {step.location}</div>
                      </div>

                      <div style={{ textAlign: "right" }}>
                        <span
                          style={{
                            fontFamily: "var(--font-mono)",
                            fontSize: "0.8rem",
                            color: "var(--match)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <IconCheckCircle /> {Math.round(step.confidence_score * 100)}% Match
                        </span>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-dim)", marginTop: "0.25rem" }}>
                          YuNet + SFace
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* View: All Movement Logs Table */}
      {viewMode === "all_logs" && (
        <div className="erp-table-wrapper">
          {loadingLogs ? (
            <div style={{ padding: "4rem", textAlign: "center", color: "var(--ink-dim)" }}>
              <span className="spinner" /> Loading logs...
            </div>
          ) : allLogs.length === 0 ? (
            <EmptyState icon={<IconRadar />}>
              No camera movement logs recorded on {targetDate}.
            </EmptyState>
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Person</th>
                  <th>Camera</th>
                  <th>Location</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {allLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--signal-strong)" }}>
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                        <Avatar name={log.user_name} size={30} />
                        <span style={{ fontWeight: 600 }}>{log.user_name}</span>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-dept">{log.camera_name}</span>
                    </td>
                    <td style={{ color: "var(--ink-dim)" }}>📍 {log.location}</td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.8rem",
                          color: "var(--match)",
                        }}
                      >
                        {Math.round(log.confidence_score * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
