import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

const ToastCtx = createContext(null);

export function ToastProvider({ children }) {
  const [toast, setToast] = useState({ msg: "", type: "info", show: false });
  const timerRef = useRef(null);

  const showToast = useCallback((msg, type = "info") => {
    clearTimeout(timerRef.current);
    setToast({ msg, type, show: true });
    timerRef.current = setTimeout(() => {
      setToast((t) => ({ ...t, show: false }));
    }, 3500);
  }, []);

  return (
    <ToastCtx.Provider value={showToast}>
      {children}
      <div
        className={`toast toast-${toast.type} ${toast.show ? "show" : ""}`}
        role="status"
      >
        {toast.msg}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast must be used within a ToastProvider");
  return ctx;
}
