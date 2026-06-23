import { useEffect, useState } from "react";
import {
  getCurrentUserSettings,
  updateCurrentUserSettings,
  type UserSettings as UserSettingsModel,
} from "../../services/users.service";
import "../UserSettings/UserSettings.css";

type OwnerUserSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
};

const INITIAL_SETTINGS: UserSettingsModel = {
  displayName: "",
  email: "",
  phoneNumber: "",
  licensePlate: "",
  defaultDurationHours: 2,
  defaultSearchRadiusKm: 250,
  defaultArrivalTime: "09:00",
  defaultArrivalTimeUsesCurrentTime: true,
  notificationsEnabled: true,
};

const SETTINGS_ANIMATION_MS = 240;

export default function OwnerUserSettings({ isOpen, onClose }: OwnerUserSettingsProps) {
  const [settings, setSettings] = useState<UserSettingsModel>(INITIAL_SETTINGS);
  const [draft, setDraft] = useState<UserSettingsModel>(INITIAL_SETTINGS);
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const loadSettings = async () => {
    setLoading(true);
    setError("");
    setMessage("");

    try {
      const loaded = await getCurrentUserSettings();
      setSettings(loaded);
      setDraft(loaded);
      setIsEditing(false);
    } catch (loadError) {
      const msg = loadError instanceof Error ? loadError.message : String(loadError);
      setError(msg || "לא הצלחנו לטעון את הגדרות המנהל.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
      void loadSettings();
    } else if (isRendered) {
      setIsClosing(true);
      closeTimer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, SETTINGS_ANIMATION_MS);
    }

    return () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    };
  }, [isOpen, isRendered]);

  const handleSave = async () => {
    if (!draft.displayName.trim()) {
      setError("שם מנהל הוא שדה חובה.");
      return;
    }

    if (draft.phoneNumber.trim() && !/^\+?[0-9\-\s]{9,15}$/.test(draft.phoneNumber.trim())) {
      setError("יש להזין מספר פלאפון תקין.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateCurrentUserSettings({
        displayName: draft.displayName,
        phoneNumber: draft.phoneNumber,
        licensePlate: draft.licensePlate,
        defaultDurationHours: draft.defaultDurationHours,
      });

      setSettings(draft);
      setIsEditing(false);
      setMessage("הגדרות המנהל נשמרו בהצלחה.");
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : String(saveError);
      setError(msg || "לא הצלחנו לשמור את הגדרות המנהל כרגע.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = () => {
    setDraft(settings);
    setError("");
    setMessage("");
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraft(settings);
    setError("");
    setMessage("");
    setIsEditing(false);
  };

  if (!isRendered) {
    return null;
  }

  return (
    <div className={`user-settings-overlay ${isClosing ? "user-settings-overlay--closing" : ""}`} onClick={onClose}>
      <section className={`user-settings-panel ${isClosing ? "user-settings-panel--closing" : ""}`} onClick={(event) => event.stopPropagation()}>
        <header className="user-settings-header">
          <div>
            <p className="user-settings-eyebrow">Owner preferences</p>
            <h2>הגדרות מנהל חניון</h2>
            <p className="user-settings-subtitle">כאן אפשר לעדכן את פרטי החשבון והעדפות ברירת המחדל של מנהל החניון</p>
          </div>
          <button className="user-settings-close" onClick={onClose} type="button" aria-label="סגירה">
            ✕
          </button>
        </header>

        {loading ? <p className="user-settings-state">טוען הגדרות מנהל...</p> : null}
        {error ? <p className="user-settings-error">{error}</p> : null}
        {message ? <p className="user-settings-message">{message}</p> : null}

        {!loading ? (
          <div className={`user-settings-grid ${isEditing ? "user-settings-grid--editing" : ""}`}>
            <label className="user-settings-field">
              <span>שם מנהל</span>
              <input
                type="text"
                value={draft.displayName}
                onChange={(event) => setDraft((prev) => ({ ...prev, displayName: event.target.value }))}
                readOnly={!isEditing}
                disabled={!isEditing}
              />
            </label>

            <label className="user-settings-field">
              <span>אימייל</span>
              <input type="email" value={settings.email} readOnly />
            </label>

            <label className="user-settings-field">
              <span>לוחית רכב עיקרית</span>
              <input
                type="text"
                value={draft.licensePlate}
                onChange={(event) => setDraft((prev) => ({ ...prev, licensePlate: event.target.value.toUpperCase() }))}
                placeholder="12-345-67"
                readOnly={!isEditing}
                disabled={!isEditing}
              />
            </label>

            <label className="user-settings-field">
              <span>מספר פלאפון</span>
              <input
                type="tel"
                value={draft.phoneNumber}
                onChange={(event) => setDraft((prev) => ({ ...prev, phoneNumber: event.target.value }))}
                placeholder="050-123-4567"
                readOnly={!isEditing}
                disabled={!isEditing}
              />
            </label>

          </div>
        ) : null}

        <footer className="user-settings-actions">
          <button className="user-settings-button user-settings-button--ghost" onClick={onClose} type="button">
            סגירה
          </button>
          {!isEditing ? (
            <button className="user-settings-button user-settings-button--primary" onClick={handleStartEdit} type="button" disabled={loading}>
              עריכה
            </button>
          ) : (
            <>
              <button className="user-settings-button user-settings-button--ghost" onClick={handleCancelEdit} type="button" disabled={saving}>
                ביטול
              </button>
              <button className="user-settings-button user-settings-button--primary" onClick={() => void handleSave()} type="button" disabled={saving || loading}>
                {saving ? "שומר..." : "שמירת הגדרות"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}