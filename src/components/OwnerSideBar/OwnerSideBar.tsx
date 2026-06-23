import { useEffect, useRef, useState } from 'react';
import '../SidBar/SidBar.css';

type OwnerSidebarPageId = 'dashboard' | 'lots' | 'spaces' | 'alerts' | 'logout';

type OwnerSideBarProps = {
  onLogout?: () => void;
  onDashboardClick?: () => void;
  onLotsClick?: () => void;
  onSpacesClick?: () => void;
  onAlertsClick?: () => void;
  activePage?: OwnerSidebarPageId;
  onPageChange?: (pageId: OwnerSidebarPageId) => void;
  userName?: string;
};

export default function OwnerSideBar({
  onLogout,
  onDashboardClick,
  onLotsClick,
  onSpacesClick,
  onAlertsClick,
  activePage = 'dashboard',
  onPageChange,
  userName,
}: OwnerSideBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatedPage, setAnimatedPage] = useState<OwnerSidebarPageId | null>(null);
  const [clickedPage, setClickedPage] = useState<OwnerSidebarPageId | null>(null);
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
    { id: 'dashboard', icon: '📊', label: 'לוח בקרה' },
    { id: 'lots', icon: '🏢', label: 'החניונים שלי' },
    { id: 'spaces', icon: '💸', label: 'מחירים ומבצעים' },
    { id: 'alerts', icon: '⚙️', label: 'הגדרות' },
    { id: 'logout', icon: '🚪', label: 'התנתק' },
  ];

  const handleNavClick = (pageId: OwnerSidebarPageId) => {
    const nextPage = pageId;
    setClickedPage(nextPage);
    onPageChange?.(nextPage);

    if (pageId === 'dashboard') {
      onDashboardClick?.();
      return;
    }

    if (pageId === 'lots') {
      onLotsClick?.();
      return;
    }

    if (pageId === 'spaces') {
      onSpacesClick?.();
      return;
    }

    if (pageId === 'alerts') {
      onAlertsClick?.();
      return;
    }

    if (pageId === 'logout') {
      onLogout?.();
      return;
    }
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
            onClick={() => handleNavClick(item.id as OwnerSidebarPageId)}
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
