import { useEffect, useState } from "react";
import {
  getCurrentUserSettings,
  updateCurrentUserSettings,
  type UserSettings as UserSettingsModel,
} from "../../services/users.service";
import "./UserSettings.css";

type UserSettingsProps = {
  isOpen: boolean;
  onClose: () => void;
};

const INITIAL_SETTINGS: UserSettingsModel = {
  displayName: "",
  email: "",
  licensePlate: "",
  defaultDurationHours: 2,
  defaultSearchRadiusKm: 1,
  defaultArrivalTime: "09:00",
  notificationsEnabled: true,
};

export default function UserSettings({ isOpen, onClose }: UserSettingsProps) {
  const [settings, setSettings] = useState<UserSettingsModel>(INITIAL_SETTINGS);
  const [draft, setDraft] = useState<UserSettingsModel>(INITIAL_SETTINGS);
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
      setError(msg || "לא הצלחנו לטעון את ההגדרות.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    void loadSettings();
  }, [isOpen]);

  const handleSave = async () => {
    if (!draft.displayName.trim()) {
      setError("שם משתמש הוא שדה חובה.");
      return;
    }

    if (draft.defaultDurationHours < 1 || draft.defaultDurationHours > 24) {
      setError("משך ברירת מחדל חייב להיות בין שעה ל-24 שעות.");
      return;
    }

    if (draft.defaultSearchRadiusKm < 1 || draft.defaultSearchRadiusKm > 20) {
      setError("רדיוס חיפוש ברירת מחדל חייב להיות בין 1 ל-20 קמ.");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await updateCurrentUserSettings({
        displayName: draft.displayName,
        licensePlate: draft.licensePlate,
        defaultDurationHours: draft.defaultDurationHours,
        defaultSearchRadiusKm: draft.defaultSearchRadiusKm,
        defaultArrivalTime: draft.defaultArrivalTime,
        notificationsEnabled: draft.notificationsEnabled,
      });

      window.dispatchEvent(
        new CustomEvent("user-settings-updated", {
          detail: {
            notificationsEnabled: draft.notificationsEnabled,
          },
        })
      );

      setSettings(draft);
      setIsEditing(false);
      setMessage("ההגדרות נשמרו בהצלחה.");
    } catch (saveError) {
      const msg = saveError instanceof Error ? saveError.message : String(saveError);
      setError(msg || "לא הצלחנו לשמור את ההגדרות כרגע.");
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

  if (!isOpen) {
    return null;
  }

  return (
    <div className="user-settings-overlay" onClick={onClose}>
      <section className="user-settings-panel" onClick={(event) => event.stopPropagation()}>
        <header className="user-settings-header">
          <div>
            <p className="user-settings-eyebrow">Default preferences</p>
            <h2>הגדרות משתמש</h2>
            <p className="user-settings-subtitle">כאן אפשר להגדיר ערכי ברירת מחדל ולהתאים את החשבון שלך</p>
          </div>
          <button className="user-settings-close" onClick={onClose} type="button" aria-label="סגירה">
            ✕
          </button>
        </header>

        {loading ? <p className="user-settings-state">טוען הגדרות...</p> : null}
        {error ? <p className="user-settings-error">{error}</p> : null}
        {message ? <p className="user-settings-message">{message}</p> : null}

        {!loading ? (
          <div className={`user-settings-grid ${isEditing ? "user-settings-grid--editing" : ""}`}>
            <label className="user-settings-field">
              <span>שם משתמש</span>
              <input
                type="text"
                value={draft.displayName}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, displayName: event.target.value }))
                }
                readOnly={!isEditing}
                disabled={!isEditing}
              />
            </label>

            <label className="user-settings-field">
              <span>אימייל</span>
              <input type="email" value={settings.email} readOnly />
            </label>

            <label className="user-settings-field">
              <span>לוחית זיהוי</span>
              <input
                type="text"
                value={draft.licensePlate}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, licensePlate: event.target.value.toUpperCase() }))
                }
                placeholder="12-345-67"
                readOnly={!isEditing}
                disabled={!isEditing}
              />
            </label>

            <label className="user-settings-field">
              <span>משך הזמנה ברירת מחדל (שעות)</span>
              <input
                type="number"
                min={1}
                max={24}
                value={draft.defaultDurationHours}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    defaultDurationHours: Number(event.target.value) || 1,
                  }))
                }
                readOnly={!isEditing}
                disabled={!isEditing}
              />
            </label>

            <label className="user-settings-field">
              <span>רדיוס חיפוש ברירת מחדל (קמ)</span>
              <input
                type="number"
                min={1}
                max={20}
                value={draft.defaultSearchRadiusKm}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    defaultSearchRadiusKm: Number(event.target.value) || 1,
                  }))
                }
                readOnly={!isEditing}
                disabled={!isEditing}
              />
            </label>

            <label className="user-settings-field">
              <span>שעת הגעה מועדפת</span>
              <input
                type="time"
                value={draft.defaultArrivalTime}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, defaultArrivalTime: event.target.value }))
                }
                readOnly={!isEditing}
                disabled={!isEditing}
              />
            </label>

            <label className="user-settings-toggle">
              <input
                type="checkbox"
                checked={draft.notificationsEnabled}
                onChange={(event) =>
                  setDraft((prev) => ({ ...prev, notificationsEnabled: event.target.checked }))
                }
                disabled={!isEditing}
              />
              <span>לקבל התראות על הזמנות עתידיות</span>
            </label>
          </div>
        ) : null}

        <footer className="user-settings-actions">
          <button className="user-settings-button user-settings-button--ghost" onClick={onClose} type="button">
            סגירה
          </button>
          {!isEditing ? (
            <button
              className="user-settings-button user-settings-button--primary"
              onClick={handleStartEdit}
              type="button"
              disabled={loading}
            >
              עריכה
            </button>
          ) : (
            <>
              <button
                className="user-settings-button user-settings-button--ghost"
                onClick={handleCancelEdit}
                type="button"
                disabled={saving}
              >
                ביטול
              </button>
              <button
                className="user-settings-button user-settings-button--primary"
                onClick={() => void handleSave()}
                type="button"
                disabled={saving || loading}
              >
                {saving ? "שומר..." : "שמירת הגדרות"}
              </button>
            </>
          )}
        </footer>
      </section>
    </div>
  );
}
