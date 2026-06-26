import { useEffect, useRef, useState } from 'react';
import '../SidBar/SidBar.css';

export type AdminSidebarPageId = 'dashboard' | 'users' | 'lots' | 'system' | 'logout';

type AdminSideBarProps = {
  onLogout?: () => void;
  onDashboardClick?: () => void;
  onUsersClick?: () => void;
  onLotsClick?: () => void;
  onSystemClick?: () => void;
  activePage?: AdminSidebarPageId;
  onPageChange?: (pageId: AdminSidebarPageId) => void;
  userName?: string;
};

export default function AdminSideBar({
  onLogout,
  onDashboardClick,
  onUsersClick,
  onLotsClick,
  onSystemClick,
  activePage = 'dashboard',
  onPageChange,
  userName,
}: AdminSideBarProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [animatedPage, setAnimatedPage] = useState<AdminSidebarPageId | null>(null);
  const [clickedPage, setClickedPage] = useState<AdminSidebarPageId | null>(null);
  const didMountRef = useRef(false);
  const welcomeInitial = (userName?.trim().charAt(0) || 'A').toUpperCase();

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

  const navItems = [
    { id: 'dashboard', icon: '🧭', label: 'לוח אדמין' },
    { id: 'users', icon: '👥', label: 'ניהול משתמשים' },
    { id: 'lots', icon: '🏢', label: 'ניהול חניונים' },
    { id: 'system', icon: '🛡️', label: 'בקרת מערכת' },
    { id: 'logout', icon: '🚪', label: 'התנתק' },
  ];

  const handleNavClick = (pageId: AdminSidebarPageId) => {
    setClickedPage(pageId);

    if (pageId === 'logout') {
      onLogout?.();
      return;
    }

    if (pageId === 'users') {
      onUsersClick?.();
      return;
    }

    if (pageId === 'system') {
      onSystemClick?.();
      return;
    }

    onPageChange?.(pageId);

    if (pageId === 'dashboard') {
      onDashboardClick?.();
      return;
    }

    if (pageId === 'lots') {
      onLotsClick?.();
      return;
    }
  };

  return (
    <div className={`sidebar ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <button className="sidebar-toggle" onClick={() => setIsExpanded((current) => !current)} title={isExpanded ? 'סגור' : 'פתח'}>
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
            <span className="sidebar-welcome-label">אדמין</span>
            <span className="sidebar-welcome-name">{userName}</span>
          </div>
        </div>
      ) : null}

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-button ${activePage === item.id ? 'active' : ''} ${animatedPage === item.id || clickedPage === item.id ? 'nav-button--pulse' : ''}`}
            onClick={() => handleNavClick(item.id as AdminSidebarPageId)}
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