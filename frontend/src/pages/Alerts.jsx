import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/ToastContext";
import { IconRadar, IconCheckCircle, IconTrash } from "../components/Icons";
import EmptyState from "../components/EmptyState";
import Avatar from "../components/Avatar";
import "../styles/alerts.css";
import "../styles/users.css";

export default function Alerts() {
  const toast = useToast();

  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [evaluating, setEvaluating] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [statusFilter]);

  async function loadAlerts() {
    setLoading(true);
    try {
      const params = {};
      if (statusFilter !== "all") params.status = statusFilter;
      const data = await api.getAlerts(params);
      setAlerts(data);
    } catch (_) {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusChange(alertId, newStatus) {
    try {
      await api.updateAlertStatus(alertId, newStatus);
      toast(`Alert marked as ${newStatus}`, "success");
      loadAlerts();
    } catch (err) {
      toast("Failed to update status", "error");
    }
  }

  async function handleDeleteAlert(alertId) {
    try {
      await api.deleteAlert(alertId);
      toast("Alert deleted", "info");
      loadAlerts();
    } catch (err) {
      toast("Failed to delete alert", "error");
    }
  }

  async function handleRunRuleCheck() {
    setEvaluating(true);
    try {
      const res = await api.evaluateAlerts();
      toast(res.message || "Rule check completed", "info");
      loadAlerts();
    } catch (err) {
      toast("Rule evaluation failed", "error");
    } finally {
      setEvaluating(false);
    }
  }

  return (
    <div className="alerts-container">
      {/* Header */}
      <div className="erp-header">
        <div>
          <h1 className="erp-title">
            <IconRadar /> Smart Surveillance Alerts
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Automated rule-based anomalies (e.g. Bus boarding without classroom arrival, unauthorized movement).
          </p>
        </div>

        <button
          className="btn btn-primary"
          disabled={evaluating}
          onClick={handleRunRuleCheck}
        >
          {evaluating ? "Evaluating Rules..." : "⚡ Run Rule Check Now"}
        </button>
      </div>

      {/* Tabs */}
      <div className="erp-tabs">
        {[
          { id: "all", label: "All Alerts" },
          { id: "pending", label: "Pending" },
          { id: "acknowledged", label: "Under Review" },
          { id: "resolved", label: "Resolved" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`erp-tab ${statusFilter === tab.id ? "active" : ""}`}
            onClick={() => setStatusFilter(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Alerts List */}
      <div className="alerts-list">
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--ink-dim)" }}>
            <span className="spinner" /> Loading alerts...
          </div>
        ) : alerts.length === 0 ? (
          <EmptyState icon={<IconCheckCircle />}>
            No alerts found under the "{statusFilter}" filter. All campus surveillance rules are in normal state.
          </EmptyState>
        ) : (
          alerts.map((al) => {
            const statusLower = al.status.toLowerCase();
            const cardClass =
              statusLower === "pending"
                ? "status-pending"
                : statusLower === "acknowledged"
                ? "status-acknowledged"
                : "status-resolved";

            const badgeClass =
              statusLower === "pending"
                ? "alert-badge-pending"
                : statusLower === "acknowledged"
                ? "alert-badge-ack"
                : "alert-badge-resolved";

            return (
              <div key={al.id} className={`alert-card ${cardClass}`}>
                <div className="alert-main">
                  <div className="alert-type-header">
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <Avatar name={al.user_name || "Unknown"} size={32} />
                      <strong style={{ color: "var(--ink)", fontSize: "1.05rem" }}>
                        {al.user_name}
                      </strong>
                    </div>

                    <span className={`badge ${badgeClass}`}>{al.status.toUpperCase()}</span>
                    <span className="badge badge-dept">{al.alert_type}</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--ink-dim)", marginLeft: "auto" }}>
                      {new Date(al.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} •{" "}
                      {new Date(al.created_at).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="alert-reason-box">{al.reason}</div>

                  <div className="alert-locations">
                    {al.last_detected_location && (
                      <div>
                        <strong style={{ color: "var(--ink-dim)" }}>Last Sighted:</strong>{" "}
                        <span style={{ color: "var(--signal-strong)" }}>{al.last_detected_location}</span>
                      </div>
                    )}
                    {al.expected_location && (
                      <div>
                        <strong style={{ color: "var(--ink-dim)" }}>Expected At:</strong>{" "}
                        <span style={{ color: "var(--match)" }}>{al.expected_location}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="alert-actions">
                  {statusLower === "pending" && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
                      onClick={() => handleStatusChange(al.id, "Acknowledged")}
                    >
                      Acknowledge
                    </button>
                  )}

                  {statusLower !== "resolved" && (
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: "0.8rem", padding: "0.4rem 0.75rem" }}
                      onClick={() => handleStatusChange(al.id, "Resolved")}
                    >
                      ✓ Resolve
                    </button>
                  )}

                  <button
                    className="btn-remove"
                    title="Delete Alert"
                    onClick={() => handleDeleteAlert(al.id)}
                  >
                    <IconTrash />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
