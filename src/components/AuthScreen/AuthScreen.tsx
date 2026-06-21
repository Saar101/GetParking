import { useState } from "react";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "../../firebase";
import { createUser } from "../../services/users.service";
import "./AuthScreen.css";

type AuthScreenProps = {
  title?: string;
  subtitle?: string;
};

export default function AuthScreen({
  title = "GetParking",
  subtitle = "התחברו כדי להמשיך לחיפוש, הזמנה וניהול חניות",
}: AuthScreenProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupPlate, setSignupPlate] = useState("");
  const [showSignupModal, setShowSignupModal] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAuthError = (authError: unknown) => {
    const message = authError instanceof Error ? authError.message : String(authError);
    setError(message || "שגיאת התחברות. בדוק את Firebase Auth.");
  };

  const validateCredentials = () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError("אנא הזן אימייל.");
      return null;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("האימייל לא תקין. בדוק את הכתובת ונסה שוב.");
      return null;
    }

    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return null;
    }

    return { normalizedEmail, password };
  };

  const validateSignupData = () => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = signupName.trim();
    const normalizedPlate = signupPlate.trim().toUpperCase();

    if (!normalizedName) {
      setError("אנא הזן שם משתמש.");
      return null;
    }

    if (!normalizedEmail) {
      setError("אנא הזן אימייל.");
      return null;
    }

    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      setError("האימייל לא תקין. בדוק את הכתובת ונסה שוב.");
      return null;
    }

    if (password.length < 6) {
      setError("הסיסמה חייבת להכיל לפחות 6 תווים.");
      return null;
    }

    if (!normalizedPlate) {
      setError("אנא הזן לוחית זיהוי של הרכב.");
      return null;
    }

    return {
      normalizedEmail,
      normalizedName,
      normalizedPlate,
      password,
    };
  };

  const handleEmailSignIn = async () => {
    const credentials = validateCredentials();

    if (!credentials) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await signInWithEmailAndPassword(auth, credentials.normalizedEmail, credentials.password);
    } catch (authError) {
      handleAuthError(authError);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSignUp = async () => {
    setShowSignupModal(true);
    setError("");

    if (!signupName.trim()) {
      setSignupName("");
    }
  };

  const handleSignupSubmit = async () => {
    const signupData = validateSignupData();

    if (!signupData) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signupData.normalizedEmail,
        signupData.password
      );

      await updateProfile(userCredential.user, {
        displayName: signupData.normalizedName,
      });

      await createUser(userCredential.user.uid, {
        userId: Number.parseInt(userCredential.user.uid, 10) || Date.now(),
        customerId: Number.parseInt(userCredential.user.uid, 10) || null,
        name: signupData.normalizedName,
        role: "customer",
        email: signupData.normalizedEmail,
        authUid: userCredential.user.uid,
        licensePlate: signupData.normalizedPlate,
        bookingHistory: [],
        parkingLotId: null,
        parkingSpaceId: null,
      });

      setShowSignupModal(false);
    } catch (authError) {
      handleAuthError(authError);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setError("");

    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (authError) {
      handleAuthError(authError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="auth-screen">
      <div className="auth-screen__background auth-screen__background--one" />
      <div className="auth-screen__background auth-screen__background--two" />

      <section className="auth-card">
        <div className="auth-card__header">
          <p className="auth-card__eyebrow">Welcome back</p>
          <h1>{title}</h1>
          <p className="auth-card__subtitle">{subtitle}</p>
        </div>

        <div className="auth-card__benefits">
          <div>חיפוש חניה חכם</div>
          <div>שמירת הזמנות</div>
          <div>הזמנת חניה מראש</div>
        </div>

        <div className="auth-card__form">
          <label className="auth-card__label">
            אימייל
            <input
              className="auth-card__input auth-card__input--credential"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="name@example.com"
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          <label className="auth-card__label">
            סיסמה
            <input
              className="auth-card__input auth-card__input--credential"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              autoCapitalize="none"
              spellCheck={false}
            />
          </label>

          <div className="auth-card__actions">
            <button className="auth-card__button auth-card__button--primary" onClick={handleEmailSignIn} disabled={loading}>
              כניסה
            </button>
            <button className="auth-card__button auth-card__button--secondary" onClick={handleEmailSignUp} disabled={loading}>
              הרשמה
            </button>
          </div>

          <div className="auth-card__divider">או</div>

          <button className="auth-card__button auth-card__button--google" onClick={handleGoogleSignIn} disabled={loading}>
            התחברות עם Google
          </button>

          <p className="auth-card__error" aria-live="polite">
            {error}
          </p>
        </div>

        {showSignupModal && (
          <div className="auth-modal" role="dialog" aria-modal="true" aria-labelledby="signup-modal-title">
            <div className="auth-modal__backdrop" onClick={() => !loading && setShowSignupModal(false)} />
            <div className="auth-modal__panel">
              <div className="auth-modal__header">
                <div className="auth-modal__title-group">
                  <p className="auth-modal__eyebrow">יצירת חשבון</p>
                  <h2 id="signup-modal-title">נשמח להכיר אותך</h2>
                </div>
                <button className="auth-modal__close" onClick={() => !loading && setShowSignupModal(false)} type="button">
                  ✕
                </button>
              </div>

              <div className="auth-modal__body">
                <label className="auth-card__label">
                  שם משתמש
                  <input
                    className="auth-card__input auth-card__input--credential"
                    type="text"
                    value={signupName}
                    onChange={(event) => setSignupName(event.target.value)}
                    placeholder="למשל: יואב כהן"
                    autoComplete="name"
                  />
                </label>

                <label className="auth-card__label">
                  אימייל
                  <input
                    className="auth-card__input auth-card__input--credential"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="name@example.com"
                    autoComplete="email"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>

                <label className="auth-card__label">
                  סיסמה
                  <input
                    className="auth-card__input auth-card__input--credential"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    autoCapitalize="none"
                    spellCheck={false}
                  />
                </label>

                <label className="auth-card__label">
                  לוחית זיהוי של הרכב
                  <input
                    className="auth-card__input auth-card__input--credential"
                    type="text"
                    value={signupPlate}
                    onChange={(event) => setSignupPlate(event.target.value.toUpperCase())}
                    placeholder="12-345-67"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                </label>
              </div>

              <div className="auth-modal__actions">
                <button className="auth-card__button auth-card__button--secondary" onClick={() => !loading && setShowSignupModal(false)} type="button">
                  ביטול
                </button>
                <button className="auth-card__button auth-card__button--primary" onClick={handleSignupSubmit} disabled={loading} type="button">
                  {loading ? "נרשם..." : "אישור הרשמה"}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
