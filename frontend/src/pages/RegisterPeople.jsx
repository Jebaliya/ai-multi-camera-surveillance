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
import "../styles/register.css";

export default function RegisterPeople() {
  const toast = useToast();
  const confirm = useConfirm();

  const [name, setName] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [camOpen, setCamOpen] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [names, setNames] = useState([]);

  const fileInputRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    loadRegistered();
    return () => stopCamera();
  }, []);

  async function loadRegistered() {
    try {
      const data = await api.getRegistered();
      setNames(data.names);
    } catch (_) {
      /* silent */
    }
  }

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
      if (err.name === "NotAllowedError") {
        toast(
          "Camera access denied. Please allow camera permissions.",
          "error",
        );
      } else if (err.name === "NotFoundError") {
        toast("No camera found on this device.", "error");
      } else {
        toast(`Could not start camera: ${err.message || err.name}`, "error");
      }
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
      0.9,
    );
  }

  async function registerFace() {
    const trimmed = name.trim();
    if (!trimmed || !selectedFile) return;

    setRegistering(true);
    try {
      const data = await api.register(trimmed, selectedFile);
      toast(`Registered "${data.name}" successfully!`, "success");
      setName("");
      setPreviewUrl(null);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      loadRegistered();
    } catch (err) {
      toast(err.data?.detail || "Registration failed", "error");
    }
    setRegistering(false);
  }

  async function removeRegistered(n) {
    const ok = await confirm(
      `This removes "${n}" from registered faces. This can't be undone.`,
      {
        title: "Remove this person?",
        confirmLabel: "Remove",
        danger: true,
      },
    );
    if (!ok) return;
    try {
      await api.removeRegistered(n);
      toast(`Removed "${n}"`, "info");
      loadRegistered();
    } catch (_) {
      /* silent */
    }
  }

  const canRegister = name.trim() && selectedFile;

  return (
    <section className="card register-section">
      <div className="card-header">
        <h2>
          <IconRegister />
          Register New Face
        </h2>
      </div>
      <div className="register-body">
        <div className="register-form">
          <div className="form-group">
            <label htmlFor="nameInput">Full Name</label>
            <input
              type="text"
              id="nameInput"
              placeholder="e.g. John Doe"
              autoComplete="off"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Upload Photo</label>
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
              <small>JPG / PNG — clear frontal face</small>
            </div>
          </div>

          <div className="divider">
            <span>OR</span>
          </div>

          <div className="camera-capture-container" hidden={!camOpen}>
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{ width: "100%" }}
            />
          </div>

          {!camOpen ? (
            <button
              className="btn btn-secondary btn-full"
              onClick={startCamera}
            >
              <IconCamera /> Open Webcam to Capture
            </button>
          ) : (
            <button className="btn btn-primary btn-full" onClick={capturePhoto}>
              <IconCheckCircle /> Take Photo
            </button>
          )}

          {previewUrl && (
            <img className="preview-img" src={previewUrl} alt="Preview" />
          )}

          <button
            className="btn btn-primary btn-full"
            style={{ marginTop: "1.5rem" }}
            disabled={!canRegister || registering}
            onClick={registerFace}
          >
            {registering ? (
              <>
                <span className="spinner" /> Registering…
              </>
            ) : (
              <>
                <IconCheckCircle /> Register Face
              </>
            )}
          </button>
        </div>

        <div className="registered-panel">
          <h3>Registered People</h3>
          {names.length === 0 ? (
            <EmptyState icon={<IconRegister />}>
              No faces registered yet
            </EmptyState>
          ) : (
            <ul>
              {names.map((n) => (
                <li key={n}>
                  <span className="person-info">
                    <Avatar name={n} size={30} />
                    <span className="person-name">{n}</span>
                  </span>
                  <button
                    className="btn-remove"
                    title="Remove"
                    onClick={() => removeRegistered(n)}
                  >
                    <IconTrash />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
