export default function EmptyState({ icon, children }) {
  return (
    <div className="empty-state">
      {icon}
      <span>{children}</span>
    </div>
  );
}
