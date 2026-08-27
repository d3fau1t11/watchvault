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
    <div className="empty" style={style}>
      <IconComponent size={44} className="empty-icon" />
      <h3 className="empty-title">{title}</h3>
      <p className="empty-text">{message}</p>
      {actionText && onAction && (
        <button className="btn" onClick={onAction}>
          {actionText}
        </button>
      )}
    </div>
  );
};

export default EmptyState;
