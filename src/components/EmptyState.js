import { Library, Search, Inbox } from "lucide-react";

const EmptyState = ({ 
  icon = "library", 
  title, 
  message, 
  actionText, 
  onAction,
  style = {} 
}) => {
  const icons = {
    library: Library,
    search: Search,
    inbox: Inbox
  };

  const IconComponent = icons[icon] || Library;

  return (
    <div style={{
      background: "var(--bg-glass)",
      backdropFilter: "blur(20px)",
      border: "var(--glass-border)",
      borderRadius: "16px",
      padding: "48px 32px",
      textAlign: "center",
      boxShadow: "0 8px 32px 0 rgba(0, 0, 0, 0.2)",
      ...style
    }}>
      <IconComponent 
        size={48} 
        color="var(--text-secondary)" 
        style={{ marginBottom: "16px", opacity: 0.6 }} 
      />
      <h3 style={{ margin: "0 0 8px 0", color: "var(--text-primary)" }}>
        {title}
      </h3>
      <p style={{ 
        color: "var(--text-secondary)", 
        margin: "0 0 24px 0", 
        fontSize: "0.9rem", 
        maxWidth: "480px", 
        marginLeft: "auto", 
        marginRight: "auto" 
      }}>
        {message}
      </p>
      {actionText && onAction && (
        <button className="btn" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
