import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useToast } from "../components/ToastContext";
import {
  IconCamera,
  IconPlay,
  IconStop,
  IconUpload,
} from "../components/Icons";
import "../styles/camera.css";

export default function LiveCamera() {
  const toast = useToast();

  const videoRef = useRef(null);
  const overlayRef = useRef(null);
  const uploadedPreviewRef = useRef(null);
  const photoInputRef = useRef(null);

  const streamRef = useRef(null);
  const loopRef = useRef(null);
  const isProcessingRef = useRef(false);
  const uploadedMetaRef = useRef(null);

  const [online, setOnline] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(true);

  // Clean up camera + interval on unmount
  useEffect(() => stopCamera, []);

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
      const video = videoRef.current;
      video.srcObject = stream;
      video.style.display = "";

      video.onloadedmetadata = () => {
        overlayRef.current.width = video.videoWidth;
        overlayRef.current.height = video.videoHeight;
      };

      setShowPlaceholder(false);
      setOnline(true);

      loopRef.current = setInterval(processFrame, 1500);
    } catch (err) {
      toast("Camera access denied. Please allow camera permissions.", "error");
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
    const video = videoRef.current;
    const overlay = overlayRef.current;
    if (video) video.srcObject = null;
    if (overlay) {
      const ctx = overlay.getContext("2d");
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    }
    setShowPlaceholder(true);
    setOnline(false);
  }

  async function processFrame() {
    if (isProcessingRef.current || !streamRef.current) return;
    isProcessingRef.current = true;

    try {
      const video = videoRef.current;
      const c = document.createElement("canvas");
      c.width = video.videoWidth;
      c.height = video.videoHeight;
      c.getContext("2d").drawImage(video, 0, 0);
      const dataUrl = c.toDataURL("image/jpeg", 0.7);

      const data = await api.recognize(dataUrl);
      drawDetections(data.faces, { source: "video" });
    } catch (_) {
      /* silent */
    }

    isProcessingRef.current = false;
  }

  function handlePhotoUpload(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    processFile(file);
  }

  function processFile(file) {
    if (streamRef.current) stopCamera();

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target.result;
      if (videoRef.current) videoRef.current.style.display = "none";
      setShowPlaceholder(false);

      const img = uploadedPreviewRef.current;
      img.src = dataUrl;
      img.onload = async () => {
        const overlay = overlayRef.current;
        const containerRect = overlay.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        overlay.width = Math.round(containerRect.width * dpr);
        overlay.height = Math.round(containerRect.height * dpr);
        overlay.style.width = Math.round(containerRect.width) + "px";
        overlay.style.height = Math.round(containerRect.height) + "px";

        const ctx = overlay.getContext("2d");
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const naturalW = img.naturalWidth;
        const naturalH = img.naturalHeight;
        const clientW = containerRect.width;
        const clientH = containerRect.height;

        const scale = Math.max(clientW / naturalW, clientH / naturalH);
        const sWidth = clientW / scale;
        const sHeight = clientH / scale;
        const sx = Math.round((naturalW - sWidth) / 2);
        const sy = Math.round((naturalH - sHeight) / 2);

        uploadedMetaRef.current = {
          naturalWidth: naturalW,
          naturalHeight: naturalH,
          clientWidth: clientW,
          clientHeight: clientH,
          scale,
          sx,
          sy,
          sWidth,
          sHeight,
          dpr,
        };

        ctx.clearRect(0, 0, clientW, clientH);
        ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, clientW, clientH);

        await recognizeUploadedPhoto(dataUrl);
      };
    };
    reader.readAsDataURL(file);
  }

  async function recognizeUploadedPhoto(dataUrl) {
    try {
      const data = await api.recognize(dataUrl);
      drawDetections(data.faces, { source: "image" });
      toast(
        data.faces && data.faces.length ? "Photo processed" : "No faces found",
        "info",
      );
    } catch (e) {
      toast("Failed to process photo", "error");
    }
  }

  function drawDetections(faces, opts = {}) {
    const overlay = overlayRef.current;
    const ctx = overlay.getContext("2d");

    if (opts.source === "video") {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, overlay.width, overlay.height);

      for (const f of faces) {
        drawBox(ctx, f, f.left, f.top, f.right - f.left, f.bottom - f.top);
      }
      return;
    }

    // Uploaded image path
    const meta = uploadedMetaRef.current;
    const previewImg = uploadedPreviewRef.current;
    if (!meta || !previewImg) return;

    const {
      sx,
      sy,
      sWidth,
      sHeight,
      clientWidth: clientW,
      clientHeight: clientH,
      scale,
      dpr,
    } = meta;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, clientW, clientH);
    ctx.drawImage(previewImg, sx, sy, sWidth, sHeight, 0, 0, clientW, clientH);

    for (const f of faces) {
      const leftCss = (f.left - sx) * scale;
      const topCss = (f.top - sy) * scale;
      const widthCss = (f.right - f.left) * scale;
      const heightCss = (f.bottom - f.top) * scale;
      drawBox(ctx, f, leftCss, topCss, widthCss, heightCss);
    }
  }

  function drawBox(ctx, f, left, top, width, height) {
    const known = f.name !== "Unknown";
    const color = known ? "#4ade80" : "#f87171";

    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(left, top, width, height);

    const label = known
      ? `${f.name} (${(f.score * 100).toFixed(1)}%)`
      : "Unknown";
    ctx.font = "600 13px Inter, sans-serif";
    const pad = 8;
    const tw = ctx.measureText(label).width + pad * 2;
    const lh = 24;
    ctx.fillStyle = color;
    ctx.fillRect(left, top - lh - 2, tw, lh);

    ctx.fillStyle = "#0a0e13";
    ctx.fillText(label, left + pad, top - 8);
  }

  return (
    <section className="card camera-section">
      <div className="card-header">
        <h2>
          <IconCamera />
          Live Camera
        </h2>
        <div className="camera-controls">
          <button
            className="btn btn-primary"
            onClick={startCamera}
            disabled={online}
          >
            <IconPlay /> Start Camera
          </button>
          <button
            className="btn btn-danger"
            onClick={stopCamera}
            disabled={!online}
          >
            <IconStop /> Stop
          </button>
          <button
            className="btn btn-outline"
            onClick={() => photoInputRef.current.click()}
          >
            <IconUpload /> Upload Photo
          </button>
          <input
            type="file"
            accept="image/*"
            ref={photoInputRef}
            style={{ display: "none" }}
            onChange={handlePhotoUpload}
          />
        </div>
      </div>

      <div className="camera-container">
        <video ref={videoRef} autoPlay playsInline muted />
        <canvas ref={overlayRef} />
        <img
          ref={uploadedPreviewRef}
          className="static-upload"
          style={{ display: "none" }}
          alt=""
        />

        {showPlaceholder && (
          <div className="camera-placeholder">
            <IconCamera />
            <p>Start the camera or upload a photo to begin</p>
          </div>
        )}

        <div className={`reticle${online ? " is-live" : ""}`}>
          <span />
          <span />
          <span />
          <span />
        </div>
        {online && <div className="scan-sweep" />}
      </div>

      <div className="camera-status">
        <span className={`status-dot${online ? " online" : ""}`} />
        <span>
          {online ? "Camera active — recognizing faces" : "Camera offline"}
        </span>
      </div>
    </section>
  );
}
