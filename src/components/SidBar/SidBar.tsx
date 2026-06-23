import { useEffect, useRef, useState } from 'react';
import './SidBar.css';

type SidebarPageId = 'find' | 'bookings' | 'favorites' | 'settings' | 'logout';

type SidBarProps = {
  onLogout?: () => void;
  onBookingsClick?: () => void;
  onFavoritesClick?: () => void;
  onSettingsClick?: () => void;
  activePage?: SidebarPageId;
  onPageChange?: (pageId: SidebarPageId) => void;
  userName?: string;
};

export default function SidBar({
  onLogout,
  onBookingsClick,
  onFavoritesClick,
  onSettingsClick,
  activePage = 'find',
  onPageChange,
  userName,
}: SidBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatedPage, setAnimatedPage] = useState<SidebarPageId | null>(null);
  const [clickedPage, setClickedPage] = useState<SidebarPageId | null>(null);
  const didMountRef = useRef(false);
  const welcomeInitial = (userName?.trim().charAt(0) || '👋').toUpperCase();

  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true;
      return;
    }

    setAnimatedPage(activePage);
    const timeoutId = window.setTimeout(() => {
      setAnimatedPage(null);
    }, 360);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activePage]);

  useEffect(() => {
    if (!clickedPage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setClickedPage(null);
    }, 360);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [clickedPage]);

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

  const handleNavClick = (pageId: SidebarPageId) => {
    const nextPage = pageId;
    setClickedPage(nextPage);

    if (pageId === 'logout') {
      onLogout?.();
      return;
    }

    onPageChange?.(nextPage);

    if (pageId === 'bookings') {
      onBookingsClick?.();
      return;
    }

    if (pageId === 'favorites') {
      onFavoritesClick?.();
      return;
    }

    if (pageId === 'settings') {
      onSettingsClick?.();
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

      {userName ? (
        <div className="sidebar-welcome">
          <span className="sidebar-welcome-badge" aria-hidden="true">
            {welcomeInitial}
          </span>
          <div className="sidebar-welcome-text">
            <span className="sidebar-welcome-label">ברוך הבא</span>
            <span className="sidebar-welcome-name">{userName}</span>
          </div>
        </div>
      ) : null}

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-button ${activePage === item.id ? 'active' : ''} ${animatedPage === item.id || clickedPage === item.id ? 'nav-button--pulse' : ''}`}
            onClick={() => handleNavClick(item.id)}
            title={item.label}
          >
            <span className="nav-icon">{item.icon}</span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </nav>

      {isExpanded ? <div className="sidebar-content" /> : null}
    </div>
  );
}
