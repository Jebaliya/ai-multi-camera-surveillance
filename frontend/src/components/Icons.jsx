// Small, dependency-free SVG icon set. Each icon takes standard svg props
// (className, style, etc.) and inherits color via currentColor / stroke.

const base = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
};

export function IconCamera(props) {
  return (
    <svg {...base} {...props}>
      <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

export function IconLog(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 3.5h9.5L20 8v12.5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" />
      <path d="M15 3.5V8h5" />
      <path d="M8.5 12h5M8.5 15.5h7M8.5 19h4" />
    </svg>
  );
}

export function IconRegister(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <path d="M18 8.5v5M15.5 11h5" />
    </svg>
  );
}

export function IconPlay(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 4.5v15l13-7.5-13-7.5Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconStop(props) {
  return (
    <svg {...base} {...props}>
      <rect x="5.5" y="5.5" width="13" height="13" rx="2" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconUpload(props) {
  return (
    <svg {...base} {...props}>
      <path d="M12 15.5V4M8 8l4-4 4 4" />
      <path d="M4.5 15v3.5a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V15" />
    </svg>
  );
}

export function IconUploadCloud(props) {
  return (
    <svg {...base} {...props}>
      <path d="M7 17.5a4 4 0 0 1-.7-7.94 5 5 0 0 1 9.6-1.8A4.2 4.2 0 0 1 17.5 17.5H7Z" />
      <path d="M12 10.5v6M9.5 13l2.5-2.5 2.5 2.5" />
    </svg>
  );
}

export function IconClose(props) {
  return (
    <svg {...base} {...props}>
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

export function IconTrash(props) {
  return (
    <svg {...base} {...props}>
      <path d="M5 7h14M9.5 7V5a1.5 1.5 0 0 1 1.5-1.5h2A1.5 1.5 0 0 1 14.5 5v2M7 7l1 12.5A1.5 1.5 0 0 0 9.5 21h5a1.5 1.5 0 0 0 1.5-1.5L17 7" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export function IconCheckCircle(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 12.5l2.3 2.3 4.7-5" />
    </svg>
  );
}

export function IconRadar(props) {
  return (
    <svg {...base} {...props}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" opacity="0.5" />
      <path d="M12 12l5-5" />
    </svg>
  );
}
