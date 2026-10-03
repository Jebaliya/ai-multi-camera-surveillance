import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/ToastContext";
import { useConfirm } from "../components/ConfirmContext";
import {
  IconRegister,
  IconUploadCloud,
  IconCamera,
  IconCheckCircle,
  IconTrash,
} from "../components/Icons";
import EmptyState from "../components/EmptyState";
import Avatar from "../components/Avatar";
import "../styles/users.css";
import "../styles/register.css";

export default function UserManagement() {
  const toast = useToast();
  const confirm = useConfirm();

  // ERP Users state
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  // Modal & Registration form state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [name, setName] = useState("");
  const [role, setRole] = useState("Student");
  const [department, setDepartment] = useState("Computer Science");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [camOpen, setCamOpen] = useState(false);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadUsers();
    return () => stopCamera();
  }, [activeTab]);

  async function loadUsers() {
    setLoading(true);
    try {
      const params = {};
      if (activeTab !== "all") params.role = activeTab;
      if (searchTerm.trim()) params.search = searchTerm.trim();
      const data = await api.getUsers(params);
      setUsers(data);
    } catch (err) {
      toast(err.message || "Failed to load ERP users", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    loadUsers();
  }

  // Camera & Photo logic
  function showPreview(file) {
    const url = URL.createObjectURL(file);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return url;
    });
    setSelectedFile(file);
  }

  function onFileChosen(file) {
    if (!file) return;
    showPreview(file);
    stopCamera();
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files[0]) onFileChosen(e.dataTransfer.files[0]);
  }

  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });
      streamRef.current = stream;
      videoRef.current.srcObject = stream;
      setCamOpen(true);
      setPreviewUrl(null);
      setSelectedFile(null);
    } catch (err) {
      toast(`Camera error: ${err.message || err.name}`, "error");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setCamOpen(false);
  }

  function capturePhoto() {
    if (!streamRef.current) return;
    const video = videoRef.current;
    const c = document.createElement("canvas");
    c.width = video.videoWidth;
    c.height = video.videoHeight;
    c.getContext("2d").drawImage(video, 0, 0);

    c.toBlob(
      (blob) => {
        const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
        showPreview(file);
        stopCamera();
        toast("Photo captured!", "success");
      },
      "image/jpeg",
      0.9
    );
  }

  function resetForm() {
    setName("");
    setRole("Student");
    setDepartment("Computer Science");
    setEmail("");
    setPhone("");
    setSelectedFile(null);
    setPreviewUrl(null);
    stopCamera();
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!name.trim()) {
      toast("Please enter the person's name", "error");
      return;
    }
    if (!selectedFile) {
      toast("Please provide a face photo (upload or webcam capture)", "error");
      return;
    }

    setRegistering(true);
    try {
      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("role", role);
      fd.append("department", department.trim());
      if (email.trim()) fd.append("email", email.trim());
      if (phone.trim()) fd.append("phone", phone.trim());
      fd.append("image", selectedFile);

      const created = await api.createUser(fd);
      toast(`Successfully registered "${created.name}" as ${created.role}!`, "success");
      setIsModalOpen(false);
      resetForm();
      loadUsers();
    } catch (err) {
      toast(err.data?.detail || err.message || "Registration failed", "error");
    } finally {
      setRegistering(false);
    }
  }

  async function handleDelete(user) {
    const ok = await confirm(
      `Remove "${user.name}" (${user.role}) from the ERP directory? Face embedding and attendance records will also be deleted.`,
      {
        title: "Delete Person?",
        confirmLabel: "Delete",
        danger: true,
      }
    );
    if (!ok) return;

    try {
      await api.deleteUser(user.id);
      toast(`Deleted "${user.name}"`, "info");
      loadUsers();
    } catch (err) {
      toast(err.message || "Failed to delete user", "error");
    }
  }

  const roleCounts = {
    all: users.length,
    student: users.filter((u) => u.role.toLowerCase() === "student").length,
    teacher: users.filter((u) => u.role.toLowerCase() === "teacher").length,
    employee: users.filter((u) => u.role.toLowerCase() === "employee").length,
  };

  return (
    <div className="erp-container">
      {/* Top Header & Actions */}
      <div className="erp-header">
        <div>
          <h1 className="erp-title">
            <IconRegister /> ERP Person Management
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "0.9rem", marginTop: "0.25rem" }}>
            Manage students, teachers, and employees with AI-powered face biometric profiles.
          </p>
        </div>

        <div className="erp-controls">
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "0.5rem" }}>
            <input
              type="text"
              className="erp-search-input"
              placeholder="Search by name, email, dept..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">
              Search
            </button>
          </form>

          <button
            className="btn btn-primary"
            onClick={() => {
              resetForm();
              setIsModalOpen(true);
            }}
          >
            <IconRegister /> + Register Person
          </button>
        </div>
      </div>

      {/* Role Filter Tabs */}
      <div className="erp-tabs">
        {[
          { id: "all", label: "All People" },
          { id: "student", label: "Students" },
          { id: "teacher", label: "Teachers" },
          { id: "employee", label: "Employees" },
        ].map((tab) => (
          <button
            key={tab.id}
            className={`erp-tab ${activeTab === tab.id ? "active" : ""}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* People Table */}
      <div className="erp-table-wrapper">
        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--ink-dim)" }}>
            <span className="spinner" /> Loading ERP directory...
          </div>
        ) : users.length === 0 ? (
          <EmptyState icon={<IconRegister />}>
            No people found. Click "+ Register Person" to add a student, teacher, or employee.
          </EmptyState>
        ) : (
          <table className="erp-table">
            <thead>
              <tr>
                <th>Person</th>
                <th>Role</th>
                <th>Department</th>
                <th>Contact</th>
                <th>AI Biometric</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const photoUrl = api.getUserPhotoUrl(user.profile_image);
                const roleLower = user.role.toLowerCase();
                const badgeClass =
                  roleLower === "teacher"
                    ? "badge-teacher"
                    : roleLower === "employee"
                    ? "badge-employee"
                    : roleLower === "admin"
                    ? "badge-admin"
                    : "badge-student";

                return (
                  <tr key={user.id}>
                    <td>
                      <div className="user-identity">
                        {photoUrl ? (
                          <img
                            src={photoUrl}
                            alt={user.name}
                            className="user-avatar-img"
                            onError={(e) => {
                              e.target.style.display = "none";
                            }}
                          />
                        ) : (
                          <Avatar name={user.name} size={42} />
                        )}
                        <div className="user-names">
                          <span className="user-name">{user.name}</span>
                          <span className="user-email">{user.email || "No email"}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>{user.role}</span>
                    </td>
                    <td>
                      <span className="badge badge-dept">{user.department}</span>
                    </td>
                    <td style={{ color: "var(--ink-dim)", fontSize: "0.85rem" }}>
                      {user.phone ? <div>📞 {user.phone}</div> : <div>—</div>}
                    </td>
                    <td>
                      {user.has_embedding ? (
                        <span
                          style={{
                            color: "var(--match)",
                            fontSize: "0.8rem",
                            fontFamily: "var(--font-mono)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                          }}
                        >
                          <IconCheckCircle /> SFace 128-d
                        </span>
                      ) : (
                        <span style={{ color: "var(--alert)", fontSize: "0.8rem" }}>
                          No Face Enrolled
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      <button
                        className="btn-remove"
                        title="Delete User"
                        onClick={() => handleDelete(user)}
                      >
                        <IconTrash />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Register Person Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => !registering && setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Register New Person (ERP)</h3>
              <button
                className="modal-close"
                onClick={() => !registering && setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRegister}>
              <div className="modal-body">
                {/* Name */}
                <div className="form-group">
                  <label>Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dr. Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>

                {/* Role & Department */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Role *</label>
                    <select value={role} onChange={(e) => setRole(e.target.value)}>
                      <option value="Student">Student</option>
                      <option value="Teacher">Teacher</option>
                      <option value="Employee">Employee</option>
                      <option value="Admin">Admin</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label>Department *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Computer Science"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                    />
                  </div>
                </div>

                {/* Email & Phone */}
                <div className="form-row">
                  <div className="form-group">
                    <label>Email Address</label>
                    <input
                      type="email"
                      placeholder="jane@university.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="form-group">
                    <label>Phone Number</label>
                    <input
                      type="tel"
                      placeholder="+1 555-0199"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                    />
                  </div>
                </div>

                {/* Photo Upload or Webcam */}
                <div className="form-group">
                  <label>Face Biometric Photo *</label>
                  <div
                    className={`upload-area${dragOver ? " drag-over" : ""}`}
                    onClick={() => fileInputRef.current.click()}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      hidden
                      ref={fileInputRef}
                      onChange={(e) => onFileChosen(e.target.files[0])}
                    />
                    <div className="upload-icon">
                      <IconUploadCloud />
                    </div>
                    <p>Click to upload or drag &amp; drop</p>
                    <small>JPG / PNG — clear frontal face with good lighting</small>
                  </div>
                </div>

                <div className="divider">
                  <span>OR</span>
                </div>

                {/* Webcam capture option */}
                <div className="camera-capture-container" hidden={!camOpen}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{ width: "100%", borderRadius: "var(--radius-md)" }}
                  />
                </div>

                {!camOpen ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-full"
                    onClick={startCamera}
                  >
                    <IconCamera /> Open Webcam to Capture
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn btn-primary btn-full"
                    onClick={capturePhoto}
                  >
                    <IconCheckCircle /> Take Snapshot
                  </button>
                )}

                {previewUrl && (
                  <div style={{ textAlign: "center", marginTop: "0.5rem" }}>
                    <p style={{ fontSize: "0.8rem", color: "var(--ink-dim)", marginBottom: "0.25rem" }}>
                      Photo Selected:
                    </p>
                    <img
                      className="preview-img"
                      src={previewUrl}
                      alt="Preview"
                      style={{ maxHeight: "140px", borderRadius: "var(--radius-md)" }}
                    />
                  </div>
                )}
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={registering}
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={registering || !name.trim() || !selectedFile}
                >
                  {registering ? (
                    <>
                      <span className="spinner" /> Enrolling Face…
                    </>
                  ) : (
                    <>
                      <IconCheckCircle /> Save &amp; Enroll Face
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
