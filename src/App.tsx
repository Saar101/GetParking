import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, signOut, type User } from "firebase/auth";
import "./App.css";

import { auth } from "./firebase";
import AuthScreen from "./components/AuthScreen/AuthScreen";
import AdminMainScreen from "./components/AdminMainScreen/AdminMainScreen";
import CustomerMainScreen from "./components/CustomerMainScreen/CustomerMainScreen";
import OwnerMainScreen from "./components/OwnerMainScreen";
import { getCurrentUserRole, type UserRole } from "./services/users.service";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [showIntro, setShowIntro] = useState(false);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [authBlockedMessage, setAuthBlockedMessage] = useState<string | null>(null);
  const logoutTimerRef = useRef<number | null>(null);

  useEffect(() => {
    let introTimer: number | undefined;
    let active = true;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);

      if (nextUser) {
        setAuthBlockedMessage(null);

        if (logoutTimerRef.current !== null) {
          window.clearTimeout(logoutTimerRef.current);
          logoutTimerRef.current = null;
        }

        setShowIntro(true);
        void getCurrentUserRole()
          .then((role) => {
            if (active) {
              setUserRole(role ?? "customer");
            }
          })
          .catch((error: unknown) => {
            if (active) {
              const message = error instanceof Error ? error.message : "";

              if (message === "USER_DISABLED") {
                setUserRole(null);
                setAuthBlockedMessage("החשבון הזה מושבת כרגע. יש לפנות לאדמין המערכת כדי להפעיל אותו מחדש.");
                void signOut(auth);
                return;
              }

              setUserRole("customer");
            }
          });

        introTimer = window.setTimeout(() => {
          if (active) {
            setShowIntro(false);
          }
        }, 900);
      } else {
        setUserRole(null);
      }
    });

    return () => {
      active = false;
      unsubscribe();

      if (introTimer !== undefined) {
        window.clearTimeout(introTimer);
      }
    };
  }, []);

  const handleLogout = async () => {
    setShowIntro(true);

    if (logoutTimerRef.current !== null) {
      window.clearTimeout(logoutTimerRef.current);
    }

    logoutTimerRef.current = window.setTimeout(() => {
      void signOut(auth);
      logoutTimerRef.current = null;
    }, 900);
  };

  if (!authReady) {
    return <AuthScreen subtitle="טוען את מסך הכניסה..." />;
  }

  if (!user) {
    return <AuthScreen blockedMessage={authBlockedMessage ?? undefined} />;
  }

  return (
    <>
      {showIntro ? (
        <div className="app-intro-overlay" aria-hidden="true">
          <div className="app-intro-circle" />
          <div className="app-intro-ripple" />
        </div>
      ) : null}
      {userRole === "owner" ? (
        <OwnerMainScreen
          userName={user.displayName ?? user.email ?? "משתמש"}
          onLogout={handleLogout}
        />
      ) : userRole === "admin" ? (
        <AdminMainScreen
          userName={user.displayName ?? user.email ?? "משתמש"}
          onLogout={handleLogout}
        />
      ) : (
        <CustomerMainScreen
          userName={user.displayName ?? user.email ?? "משתמש"}
          onLogout={handleLogout}
          showIntro={showIntro}
        />
      )}
    </>
  );
}
