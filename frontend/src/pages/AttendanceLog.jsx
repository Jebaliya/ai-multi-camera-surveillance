import { useEffect, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/ToastContext";
import { useConfirm } from "../components/ConfirmContext";
import { IconLog, IconTrash, IconCheckCircle } from "../components/Icons";
import EmptyState from "../components/EmptyState";
import Avatar from "../components/Avatar";
import "../styles/users.css";
import "../styles/log.css";

export default function AttendanceLog() {
  const toast = useToast();
  const confirm = useConfirm();

  // Mode: "daily" or "monthly"
  const [reportType, setReportType] = useState("daily");

  // Filters
  const [targetDate, setTargetDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedRole, setSelectedRole] = useState("all");
  const [selectedDept, setSelectedDept] = useState("all");
  const [search, setSearch] = useState("");

  // Monthly filters
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth() + 1);

  // Data
  const [dailyRecords, setDailyRecords] = useState([]);
  const [monthlyRecords, setMonthlyRecords] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (reportType === "daily") {
      loadDaily();
    } else {
      loadMonthly();
    }
  }, [reportType, targetDate, selectedRole, selectedDept, year, month]);

  async function loadDaily() {
    setLoading(true);
    try {
      const params = { date: targetDate };
      if (selectedRole !== "all") params.role = selectedRole;
      if (selectedDept !== "all") params.department = selectedDept;
      if (search.trim()) params.search = search.trim();
      const data = await api.getDailyAttendance(params);
      setDailyRecords(data);
    } catch (_) {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  async function loadMonthly() {
    setLoading(true);
    try {
      const params = {};
      if (selectedRole !== "all") params.role = selectedRole;
      if (selectedDept !== "all") params.department = selectedDept;
      const data = await api.getMonthlyAttendance(year, month, params);
      setMonthlyRecords(data);
    } catch (_) {
      /* silent */
    } finally {
      setLoading(false);
    }
  }

  async function handleClearToday() {
    const ok = await confirm(
      "This will clear all attendance records logged for today in the database.",
      {
        title: "Clear Today's Attendance?",
        confirmLabel: "Clear",
        danger: true,
      }
    );
    if (!ok) return;

    try {
      await api.clearAttendance();
      toast("Today's attendance cleared", "info");
      loadDaily();
    } catch (_) {
      /* silent */
    }
  }

  function handleExportCsv() {
    const url = api.getAttendanceExportUrl(targetDate);
    window.open(url, "_blank");
  }

  return (
    <div className="erp-container">
      {/* Header */}
      <div className="erp-header">
        <div>
          <h1 className="erp-title">
            <IconLog /> Attendance Automation &amp; Reports
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Automated facial recognition attendance with entry/exit tracking and exportable reports.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {reportType === "daily" && (
            <>
              <button className="btn btn-secondary" onClick={handleExportCsv}>
                ⬇ Export CSV
              </button>
              <button className="btn btn-outline" onClick={handleClearToday}>
                <IconTrash /> Clear Today
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tabs: Daily vs Monthly */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
        <div className="erp-tabs">
          <button
            className={`erp-tab ${reportType === "daily" ? "active" : ""}`}
            onClick={() => setReportType("daily")}
          >
            Daily Attendance
          </button>
          <button
            className={`erp-tab ${reportType === "monthly" ? "active" : ""}`}
            onClick={() => setReportType("monthly")}
          >
            Monthly Summary Report
          </button>
        </div>

        {/* Filter Controls */}
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          {reportType === "daily" ? (
            <>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <span style={{ fontSize: "0.85rem", color: "var(--ink-dim)" }}>Date:</span>
                <input
                  type="date"
                  value={targetDate}
                  onChange={(e) => setTargetDate(e.target.value)}
                  style={{
                    background: "var(--panel-raised)",
                    color: "var(--ink)",
                    border: "1px solid var(--line)",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "var(--radius-md)",
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.85rem",
                    outline: "none",
                  }}
                />
              </div>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  background: "var(--panel-raised)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              >
                <option value="all">All Roles</option>
                <option value="Student">Students</option>
                <option value="Teacher">Teachers</option>
                <option value="Employee">Employees</option>
              </select>
            </>
          ) : (
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <span style={{ fontSize: "0.85rem", color: "var(--ink-dim)" }}>Period:</span>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                style={{
                  background: "var(--panel-raised)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "var(--radius-md)",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              >
                {[
                  "January", "February", "March", "April", "May", "June",
                  "July", "August", "September", "October", "November", "December"
                ].map((m, i) => (
                  <option key={i + 1} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                style={{
                  background: "var(--panel-raised)",
                  color: "var(--ink)",
                  border: "1px solid var(--line)",
                  padding: "0.45rem 0.65rem",
                  borderRadius: "var(--radius-md)",
                  width: "80px",
                  fontSize: "0.85rem",
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* Report Table */}
      <div className="erp-table-wrapper">
        {loading ? (
          <div style={{ padding: "4rem", textAlign: "center", color: "var(--ink-dim)" }}>
            <span className="spinner" /> Generating attendance report...
          </div>
        ) : reportType === "daily" ? (
          dailyRecords.length === 0 ? (
            <EmptyState icon={<IconLog />}>
              No attendance records found for {targetDate}.
            </EmptyState>
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Entry Time</th>
                  <th>Exit Time</th>
                  <th>First Camera &amp; Location</th>
                  <th>Match Confidence</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dailyRecords.map((rec) => (
                  <tr key={rec.id}>
                    <td>
                      <div className="user-identity">
                        <Avatar name={rec.user_name} size={36} />
                        <div>
                          <strong style={{ color: "var(--ink)" }}>{rec.user_name}</strong>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-student">{rec.role}</span>
                    </td>
                    <td>
                      <span className="badge badge-dept">{rec.department}</span>
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--signal-strong)", fontWeight: 600 }}>
                      {rec.entry_time || "—"}
                    </td>
                    <td style={{ fontFamily: "var(--font-mono)", color: "var(--match)", fontWeight: 600 }}>
                      {rec.exit_time || rec.entry_time || "—"}
                    </td>
                    <td>
                      <div>
                        <span style={{ fontWeight: 500 }}>{rec.camera_name}</span>
                        <div style={{ fontSize: "0.75rem", color: "var(--ink-dim)" }}>
                          📍 {rec.location}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontFamily: "var(--font-mono)",
                          fontSize: "0.8rem",
                          color: "var(--match)",
                        }}
                      >
                        {Math.round(rec.confidence_score * 100)}%
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          padding: "0.2rem 0.55rem",
                          borderRadius: "var(--radius-full)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          background: "rgba(74, 222, 128, 0.12)",
                          color: "var(--match)",
                          border: "1px solid rgba(74, 222, 128, 0.3)",
                        }}
                      >
                        {rec.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          /* Monthly Summary Table */
          monthlyRecords.length === 0 ? (
            <EmptyState icon={<IconLog />}>
              No monthly data found for {month}/{year}.
            </EmptyState>
          ) : (
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Person</th>
                  <th>Role</th>
                  <th>Department</th>
                  <th>Days Present</th>
                  <th>First Sighted in Month</th>
                  <th>Latest Sighted in Month</th>
                  <th>Attendance %</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRecords.map((m) => {
                  const estDaysInMonth = 22; // working days estimate
                  const rate = Math.min(100, Math.round((m.days_present / estDaysInMonth) * 100));
                  return (
                    <tr key={m.user_id}>
                      <td>
                        <div className="user-identity">
                          <Avatar name={m.name} size={36} />
                          <strong style={{ color: "var(--ink)" }}>{m.name}</strong>
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-student">{m.role}</span>
                      </td>
                      <td>
                        <span className="badge badge-dept">{m.department}</span>
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "1.05rem", fontWeight: 700, color: "var(--signal-strong)" }}>
                        {m.days_present} Days
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
                        {m.first_seen || "—"}
                      </td>
                      <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--ink-dim)" }}>
                        {m.last_seen || "—"}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 600 }}>
                            {rate}%
                          </span>
                          <div
                            style={{
                              width: "60px",
                              height: "6px",
                              background: "var(--line)",
                              borderRadius: "3px",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${rate}%`,
                                height: "100%",
                                background: rate > 75 ? "var(--match)" : rate > 50 ? "var(--caution)" : "var(--alert)",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
