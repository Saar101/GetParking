import { useState } from 'react';
import './SidBar.css';

type SidBarProps = {
  onLogout?: () => void;
  onBookingsClick?: () => void;
  onSettingsClick?: () => void;
  userName?: string;
};

export default function SidBar({ onLogout, onBookingsClick, onSettingsClick, userName }: SidBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentPage, setCurrentPage] = useState('find');

  const toggleSidebar = () => {
    setIsExpanded(!isExpanded);
  };

  const navItems = [
    { id: 'find', icon: '🔍', label: 'חיפוש חניה' },
    { id: 'bookings', icon: '📋', label: 'ההזמנות שלי' },
    { id: 'favorites', icon: '⭐', label: 'מועדפים' },
    { id: 'settings', icon: '⚙️', label: 'הגדרות' },
    { id: 'logout', icon: '🚪', label: 'התנתק' },
  ];

  const handleNavClick = (pageId: string) => {
    setCurrentPage(pageId);

    if (pageId === 'bookings') {
      onBookingsClick?.();
      return;
    }

    if (pageId === 'settings') {
      onSettingsClick?.();
      return;
    }

    if (pageId === 'logout') {
      onLogout?.();
      return;
    }
    console.log(`Navigate to: ${pageId}`);
  };

  return (
    <div className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button className="sidebar-toggle" onClick={toggleSidebar} title={isExpanded ? 'סגור' : 'פתח'}>
        <span className="sidebar-icon">
          <span className="bar" />
          <span className="bar" />
          <span className="bar" />
        </span>
      </button>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-button ${currentPage === item.id ? 'active' : ''}`}
            onClick={() => handleNavClick(item.id)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {isExpanded && (
        <div className="sidebar-content">
          {userName ? <p className="sidebar-user">{userName}</p> : null}
        </div>
      )}
    </div>
  );
}
