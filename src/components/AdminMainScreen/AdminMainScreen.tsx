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
import { subscribeToRealtimeUsers, type UserListItem } from "../../services/users.service";
import { subscribeToRealtimeParkingLots, subscribeToRealtimeParkingSpaces } from "../../services/parkingSpaces.service";
import "./AdminMainScreen.css";

type AdminMainScreenProps = {
  userName: string;
  onLogout: () => void;
};

const adminModules = [
  {
    title: "ניהול משתמשים",
    description: "גישה מרוכזת ללקוחות, בעלי חניונים והרשאות מערכת.",
    status: "מוכן לשלב הבא",
  },
  {
    title: "ניהול חניונים",
    description: "שליטה רוחבית בחניונים, מחירים, זמינות ומבצעים.",
    status: "מוכן להרחבה",
  },
  {
    title: "בקרת מערכת",
    description: "מקום למעקב אחרי אירועים, עומסים, ותקלות רוחביות במערכת.",
    status: "בהקמה",
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
};

export default function AdminMainScreen({ userName, onLogout }: AdminMainScreenProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showParkingManagementPopup, setShowParkingManagementPopup] = useState(false);
  const [showUserManagementPopup, setShowUserManagementPopup] = useState(false);
  const [showSystemActivityPopup, setShowSystemActivityPopup] = useState(false);
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
          if (pageId !== "logout") {
            setActivePage(pageId);
          }
        }}
        onLogout={() => setShowLogoutConfirm(true)}
        onUsersClick={() => setShowUserManagementPopup(true)}
        onLotsClick={() => setShowParkingManagementPopup(true)}
        onSystemClick={() => setShowSystemActivityPopup(true)}
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
            <p>כאן נפתח את כלי האדמין של המערכת באופן נפרד ומדורג.</p>
          </div>

          <div className="admin-main-screen__module-grid">
            {adminModules.map((module) => (
              <article key={module.title} className="admin-main-screen__module-card">
                <span className="admin-main-screen__module-status">{module.status}</span>
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </article>
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
        onClose={() => setShowSystemActivityPopup(false)}
        activityUsers={activityUsers}
        loading={activityUsersLoading}
        error={activityUsersError}
      />

      <AdminUserManagementPopup
        isOpen={showUserManagementPopup}
        onClose={() => setShowUserManagementPopup(false)}
        users={activityUsers}
        usersLoading={activityUsersLoading}
        usersError={activityUsersError}
        parkingLots={parkingLots}
        parkingLotsLoading={parkingLotsLoading}
        parkingLotsError={parkingLotsError}
      />

      <AdminParkingManagementPopup
        isOpen={showParkingManagementPopup}
        onClose={() => setShowParkingManagementPopup(false)}
        onOpenUserManagement={() => {
          setShowParkingManagementPopup(false);
          setShowUserManagementPopup(true);
        }}
        parkingLots={parkingLots}
        parkingLotsLoading={parkingLotsLoading}
        parkingLotsError={parkingLotsError}
        parkingSpaces={parkingSpaces}
        parkingSpacesLoading={parkingSpacesLoading}
        parkingSpacesError={parkingSpacesError}
        users={activityUsers}
      />
    </div>
  );
}