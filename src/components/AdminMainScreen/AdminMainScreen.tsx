import { useEffect, useState } from "react";
import appTitleLogo from "../../assets/ChatGPT Image Jan 26, 2026, 08_22_00 PM.png";
import homeBackgroundImage from "../../assets/home-background.png";
import { listParkingLots, type ParkingLotDoc } from "../../services/parkingLots.service";
import { listParkingSpaces, type ParkingSpaceDoc } from "../../services/parkingSpaces.service";
import AdminSideBar, { type AdminSidebarPageId } from "../AdminSideBar/AdminSideBar";
import AdminParkingManagementPopup from "../AdminParkingManagementPopup/AdminParkingManagementPopup";
import AdminUserManagementPopup from "../AdminUserManagementPopup/AdminUserManagementPopup";
import AdminSystemActivityPopup from "../AdminSystemActivityPopup/AdminSystemActivityPopup";
import LogoutConfirmPopup from "../LogoutConfirmPopup/LogoutConfirmPopup";
import UserSettings from "../UserSettings/UserSettings";
import { subscribeToRealtimeUsers, type UserListItem } from "../../services/users.service";
import { subscribeToRealtimeParkingLots, subscribeToRealtimeParkingSpaces } from "../../services/parkingSpaces.service";
import "./AdminMainScreen.css";

type AdminMainScreenProps = {
  userName: string;
  onLogout: () => void;
};

const adminModules = [
  {
    action: "users",
    icon: "👥",
    title: "שליטה על משתמשים",
    description: "יצירת משתמשים, השבתה והפעלה מחדש, קידום למנהלי חניון וניהול פרטי חשבון.",
    accent: "users",
  },
  {
    action: "lots",
    icon: "🏢",
    title: "ניהול חניונים ומבנה בעלות",
    description: "יצירת חניונים לפי כתובת, שיוך וביטול שיוך לבעלים, מחיקת חניון ומעקב על מצב התפוסה.",
    accent: "lots",
  },
  {
    action: "system",
    icon: "📈",
    title: "בקרת מערכת חיה",
    description: "מעקב אחרי פעילות משתמשים לפי זמנים, פילוח לפי סוגי משתמשים, ותמונת מצב רחבה של המערכת.",
    accent: "system",
  },
  {
    action: "settings",
    icon: "⚙️",
    title: "הגדרות ותפעול מהיר",
    description: "גישה מהירה להגדרות חשבון האדמין ולכלי ניהול שנועדו לשמור על שליטה יומיומית פשוטה וברורה.",
    accent: "settings",
  },
];

const adminPageContent: Record<Exclude<AdminSidebarPageId, "logout">, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: "System administration",
    title: "מסך ניהול ראשי",
    description:
      "זהו מסך האדמין של המערכת. מסך מנהל החניון נשאר נפרד ויציב, ומכאן נתחיל לבנות את כלי הניהול הרוחביים של המערכת.",
  },
  users: {
    eyebrow: "User management",
    title: "ניהול משתמשים והרשאות",
    description: "מכאן נרכז בהמשך את כלי הניהול ללקוחות, בעלי חניונים, והרשאות גישה למערכת.",
  },
  lots: {
    eyebrow: "Parking operations",
    title: "ניהול חניונים רוחבי",
    description: "כאן נבנה תצוגה רוחבית לחניונים, זמינות, תמחור, מבצעים, ותפעול מנהלתי כולל.",
  },
  system: {
    eyebrow: "System control",
    title: "בקרת מערכת ותמונת מצב",
    description: "האיזור הזה ישמש בהמשך לניטור מערכת, חריגות, עומסים, ואינדיקציות תפעוליות רחבות.",
  },
  settings: {
    eyebrow: "User settings",
    title: "הגדרות משתמש",
    description: "כאן אפשר לנהל את הגדרות המשתמש האישיות של חשבון האדמין, באותו שלד עבודה הקיים אצל מנהל החניון.",
  },
};

export default function AdminMainScreen({ userName, onLogout }: AdminMainScreenProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showParkingManagementPopup, setShowParkingManagementPopup] = useState(false);
  const [showUserManagementPopup, setShowUserManagementPopup] = useState(false);
  const [showSystemActivityPopup, setShowSystemActivityPopup] = useState(false);
  const [showUserSettingsPopup, setShowUserSettingsPopup] = useState(false);
  const [activePage, setActivePage] = useState<Exclude<AdminSidebarPageId, "logout">>("dashboard");
  const [activityUsers, setActivityUsers] = useState<UserListItem[]>([]);
  const [activityUsersLoading, setActivityUsersLoading] = useState(true);
  const [activityUsersError, setActivityUsersError] = useState("");
  const [parkingLots, setParkingLots] = useState<Array<ParkingLotDoc & { id: string }>>([]);
  const [parkingLotsLoading, setParkingLotsLoading] = useState(true);
  const [parkingLotsError, setParkingLotsError] = useState("");
  const [parkingSpaces, setParkingSpaces] = useState<Array<ParkingSpaceDoc & { id: string }>>([]);
  const [parkingSpacesLoading, setParkingSpacesLoading] = useState(true);
  const [parkingSpacesError, setParkingSpacesError] = useState("");
  const activeContent = adminPageContent[activePage];
  const isDashboardPage = activePage === "dashboard";

  const handleReturnToDashboard = () => {
    setActivePage("dashboard");
  };

  const handleOpenUserManagement = () => {
    setActivePage("users");
    setShowUserManagementPopup(true);
  };

  const handleOpenParkingManagement = () => {
    setActivePage("lots");
    setShowParkingManagementPopup(true);
  };

  const handleOpenSystemActivity = () => {
    setActivePage("system");
    setShowSystemActivityPopup(true);
  };

  const handleOpenUserSettings = () => {
    setActivePage("settings");
    setShowUserSettingsPopup(true);
  };

  const handleModuleClick = (action: (typeof adminModules)[number]["action"]) => {
    if (action === "users") {
      handleOpenUserManagement();
      return;
    }

    if (action === "lots") {
      handleOpenParkingManagement();
      return;
    }

    if (action === "system") {
      handleOpenSystemActivity();
      return;
    }

    handleOpenUserSettings();
  };

  useEffect(() => {
    setActivityUsersLoading(true);
    setActivityUsersError("");

    const unsubscribe = subscribeToRealtimeUsers(
      (users) => {
        setActivityUsers(users);
        setActivityUsersLoading(false);
      },
      (error) => {
        setActivityUsersError(error.message || "נכשלה טעינת רשימת המשתמשים.");
        setActivityUsersLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setParkingLotsLoading(true);
    setParkingLotsError("");

    void listParkingLots()
      .then((lots) => {
        setParkingLots(lots as Array<ParkingLotDoc & { id: string }>);
        setParkingLotsLoading(false);
      })
      .catch((error) => {
        setParkingLotsError(error instanceof Error ? error.message : "נכשלה טעינת רשימת החניונים.");
      });

    const unsubscribe = subscribeToRealtimeParkingLots(
      (lots) => {
        setParkingLots(lots as Array<ParkingLotDoc & { id: string }>);
        setParkingLotsLoading(false);
      },
      (error) => {
        setParkingLotsError(error.message || "נכשלה טעינת רשימת החניונים.");
        setParkingLotsLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    setParkingSpacesLoading(true);
    setParkingSpacesError("");

    void listParkingSpaces()
      .then((spaces) => {
        setParkingSpaces(spaces as Array<ParkingSpaceDoc & { id: string }>);
        setParkingSpacesLoading(false);
      })
      .catch((error) => {
        setParkingSpacesError(error instanceof Error ? error.message : "נכשלה טעינת רשימת המקומות.");
      });

    const unsubscribe = subscribeToRealtimeParkingSpaces(
      (spaces) => {
        setParkingSpaces(spaces as Array<ParkingSpaceDoc & { id: string }>);
        setParkingSpacesLoading(false);
      },
      (error) => {
        setParkingSpacesError(error.message || "נכשלה טעינת רשימת המקומות.");
        setParkingSpacesLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, []);

  return (
    <div className="app-shell" style={{ backgroundImage: `url(${homeBackgroundImage})` }}>
      <AdminSideBar
        activePage={activePage}
        onPageChange={(pageId) => {
          if (pageId === "dashboard") {
            setActivePage(pageId);
          }
        }}
        onLogout={() => setShowLogoutConfirm(true)}
        onUsersClick={handleOpenUserManagement}
        onLotsClick={handleOpenParkingManagement}
        onSystemClick={handleOpenSystemActivity}
        onSettingsClick={handleOpenUserSettings}
        userName={userName}
      />

      <div className="app-shell__content admin-main-screen">
        <header className="admin-main-screen__hero">
          <div className="admin-main-screen__hero-copy">
            <p className="admin-main-screen__eyebrow">{activeContent.eyebrow}</p>
            <h1>{isDashboardPage ? `שלום ${userName}` : `שלום ${userName}, ${activeContent.title}`}</h1>
            <p>{activeContent.description}</p>
          </div>

          <div className="admin-main-screen__hero-side">
            <img src={appTitleLogo} alt="GetParking" className="admin-main-screen__logo" />
          </div>
        </header>

        <section className="admin-main-screen__overview">
          <article className="admin-main-screen__overview-card admin-main-screen__overview-card--primary">
            <span>תפקיד פעיל</span>
            <strong>Admin</strong>
            <p>גישה רוחבית להגדרות מערכת, משתמשים, חניונים ובקרות מתקדמות.</p>
          </article>

          {isDashboardPage ? null : (
            <article className="admin-main-screen__overview-card">
              <span>דף פעיל</span>
              <strong>{activeContent.title}</strong>
              <p>השלב הזה נשען על sidebar ייעודי לאדמין, עם מבנה זהה לשאר הניווטים במערכת.</p>
            </article>
          )}
        </section>

        <section className="admin-main-screen__modules">
          <div className="admin-main-screen__section-header">
            <h2>מודולים לניהול</h2>
            <p>מכאן האדמין מקבל גישה מהירה לכל פעולות הליבה של המערכת, עם מבט ברור על מה אפשר לבצע בכל אזור.</p>
          </div>

          <div className="admin-main-screen__module-grid">
            {adminModules.map((module, index) => (
              <button
                key={module.title}
                type="button"
                className={`admin-main-screen__module-card admin-main-screen__module-card--${module.accent}`}
                style={{ animationDelay: `${index * 90}ms` }}
                onClick={() => handleModuleClick(module.action)}
              >
                <div className="admin-main-screen__module-icon" aria-hidden="true">
                  {module.icon}
                </div>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </button>
            ))}
          </div>
        </section>
      </div>

      <LogoutConfirmPopup
        isOpen={showLogoutConfirm}
        onConfirm={onLogout}
        onCancel={() => setShowLogoutConfirm(false)}
      />

      <AdminSystemActivityPopup
        isOpen={showSystemActivityPopup}
        onClose={() => {
          setShowSystemActivityPopup(false);
          handleReturnToDashboard();
        }}
        activityUsers={activityUsers}
        loading={activityUsersLoading}
        error={activityUsersError}
      />

      <AdminUserManagementPopup
        isOpen={showUserManagementPopup}
        onClose={() => {
          setShowUserManagementPopup(false);
          handleReturnToDashboard();
        }}
        users={activityUsers}
        usersLoading={activityUsersLoading}
        usersError={activityUsersError}
        parkingLots={parkingLots}
        parkingLotsLoading={parkingLotsLoading}
        parkingLotsError={parkingLotsError}
      />

      <AdminParkingManagementPopup
        isOpen={showParkingManagementPopup}
        onClose={() => {
          setShowParkingManagementPopup(false);
          handleReturnToDashboard();
        }}
        onOpenUserManagement={() => {
          setShowParkingManagementPopup(false);
          handleOpenUserManagement();
        }}
        parkingLots={parkingLots}
        parkingLotsLoading={parkingLotsLoading}
        parkingLotsError={parkingLotsError}
        parkingSpaces={parkingSpaces}
        parkingSpacesLoading={parkingSpacesLoading}
        parkingSpacesError={parkingSpacesError}
        users={activityUsers}
      />

      <UserSettings
        isOpen={showUserSettingsPopup}
        onClose={() => {
          setShowUserSettingsPopup(false);
          handleReturnToDashboard();
        }}
      />
    </div>
  );
}