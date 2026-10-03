import { createContext, useCallback, useContext, useRef, useState } from "react";

const ConfirmCtx = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null); // { title, message, confirmLabel, danger }
  const resolverRef = useRef(null);

  const confirm = useCallback((message, opts = {}) => {
    setState({
      message,
      title: opts.title || "Are you sure?",
      confirmLabel: opts.confirmLabel || "Confirm",
      danger: opts.danger ?? false,
    });
    return new Promise((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  function settle(result) {
    setState(null);
    if (resolverRef.current) {
      resolverRef.current(result);
      resolverRef.current = null;
    }
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-overlay" onClick={() => settle(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{state.title}</h3>
            <p>{state.message}</p>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => settle(false)}>
                Cancel
              </button>
              <button
                className={`btn ${state.danger ? "btn-danger" : "btn-primary"}`}
                onClick={() => settle(true)}
              >
                {state.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmCtx.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used within a ConfirmProvider");
  return ctx;
}
