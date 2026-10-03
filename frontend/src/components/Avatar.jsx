const PALETTE = ["#2dd4bf", "#818cf8", "#f472b6", "#fb923c", "#4ade80", "#38bdf8", "#facc15"];

function colorFor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function initialsFor(name) {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] || "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export default function Avatar({ name, size = 36 }) {
  const bg = colorFor(name);
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
    >
      {initialsFor(name)}
    </span>
  );
}
