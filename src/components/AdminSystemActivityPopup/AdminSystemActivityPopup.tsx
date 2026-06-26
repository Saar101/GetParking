import { useEffect, useState } from "react";
import {
  type ActivityRoleFilter,
  type ActivityTimeFilter,
  type RecentActivityBucket,
  type RecentActivityUser,
  type UserListItem,
  buildRecentUserActivitySummary,
} from "../../services/users.service";
import "./AdminSystemActivityPopup.css";

type AdminSystemActivityPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  activityUsers: UserListItem[];
  loading: boolean;
  error: string;
};

const roleOptions: Array<{ value: ActivityRoleFilter; label: string }> = [
  { value: "both", label: "לקוחות ובעלי חניונים" },
  { value: "customer", label: "לקוחות בלבד" },
  { value: "owner", label: "מנהלי חניונים בלבד" },
];

const timeOptions: Array<{ value: ActivityTimeFilter; label: string }> = [
  { value: "24h", label: "24 שעות" },
  { value: "7d", label: "7 ימים" },
  { value: "30d", label: "30 ימים" },
  { value: "90d", label: "3 חודשים" },
  { value: "1y", label: "שנה" },
];

function formatLastSeen(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function getRoleLabel(role: RecentActivityUser["role"]) {
  return role === "owner" ? "מנהל חניון" : "לקוח";
}

function ActivityBucketCard({ bucket }: { bucket: RecentActivityBucket }) {
  return (
    <article className="admin-system-popup__bucket-card">
      <span>{bucket.label}</span>
      <strong>{bucket.count}</strong>
      <p>משתמשים שהיו פעילים בחלון הזמן הזה.</p>
    </article>
  );
}

function ActivityChart({ buckets }: { buckets: RecentActivityBucket[] }) {
  const maxCount = buckets.reduce((highest, bucket) => Math.max(highest, bucket.count), 0);

  return (
    <section className="admin-system-popup__chart-section">
      <div className="admin-system-popup__section-header">
        <h3>גרף פעילות אחרונה</h3>
        <p>השוואה מהירה בין חלונות הזמן האחרונים לפי הסינון שנבחר.</p>
      </div>

      <div className="admin-system-popup__chart" aria-label="גרף פעילות משתמשים אחרונה">
        {buckets.map((bucket) => {
          const heightPercentage = maxCount > 0 ? Math.max((bucket.count / maxCount) * 100, 8) : 8;

          return (
            <div key={bucket.key} className="admin-system-popup__chart-column">
              <span className="admin-system-popup__chart-value">{bucket.count}</span>
              <div className="admin-system-popup__chart-bar-track">
                <div className="admin-system-popup__chart-bar" style={{ height: `${heightPercentage}%` }} />
              </div>
              <span className="admin-system-popup__chart-label">{bucket.label}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default function AdminSystemActivityPopup({
  isOpen,
  onClose,
  activityUsers,
  loading,
  error,
}: AdminSystemActivityPopupProps) {
  const [roleFilter, setRoleFilter] = useState<ActivityRoleFilter>("both");
  const [timeFilter, setTimeFilter] = useState<ActivityTimeFilter>("7d");
  const [buckets, setBuckets] = useState<RecentActivityBucket[]>([]);
  const [totalMatchingUsers, setTotalMatchingUsers] = useState(0);
  const [usersWithActivity, setUsersWithActivity] = useState(0);
  const [recentUsers, setRecentUsers] = useState<RecentActivityUser[]>([]);

  useEffect(() => {
    if (!isOpen || !activityUsers.length) {
      setBuckets([]);
      setTotalMatchingUsers(0);
      setUsersWithActivity(0);
      setRecentUsers([]);
      return;
    }

    const summary = buildRecentUserActivitySummary(activityUsers, roleFilter, timeFilter);
    setBuckets(summary.buckets);
    setTotalMatchingUsers(summary.totalMatchingUsers);
    setUsersWithActivity(summary.usersWithActivity);
    setRecentUsers(summary.recentUsers);
  }, [activityUsers, isOpen, roleFilter, timeFilter]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="admin-system-popup__backdrop" role="presentation" onClick={onClose}>
      <section
        className="admin-system-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-system-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-system-popup__header">
          <div>
            <p className="admin-system-popup__eyebrow">System activity</p>
            <h2 id="admin-system-popup-title">בקרת מערכת</h2>
            <p className="admin-system-popup__description">
              נתוני פעילות אמיתיים לפי משתמשים שנצפו במערכת לאחרונה, עם סינון לפי סוג משתמש.
            </p>
          </div>

          <button type="button" className="admin-system-popup__close" onClick={onClose} aria-label="סגור">
            ×
          </button>
        </header>

        <div className="admin-system-popup__controls">
          <div className="admin-system-popup__time-filter">
            <label htmlFor="admin-system-time-filter" className="admin-system-popup__time-filter-label">
              סינון לפי זמן
            </label>
            <select
              id="admin-system-time-filter"
              className="admin-system-popup__time-filter-select"
              value={timeFilter}
              onChange={(event) => setTimeFilter(event.target.value as ActivityTimeFilter)}
            >
              {timeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="admin-system-popup__filters" role="tablist" aria-label="סינון משתמשים">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`admin-system-popup__filter ${roleFilter === option.value ? "admin-system-popup__filter--active" : ""}`}
                onClick={() => setRoleFilter(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? <p className="admin-system-popup__state">טוען נתוני פעילות...</p> : null}
        {error ? <p className="admin-system-popup__state admin-system-popup__state--error">{error}</p> : null}

        {!loading && !error ? (
          <>
            <section className="admin-system-popup__summary">
              <article className="admin-system-popup__summary-card admin-system-popup__summary-card--primary">
                <span>סה״כ משתמשים בהתאמה לסינון</span>
                <strong>{totalMatchingUsers}</strong>
              </article>
              <article className="admin-system-popup__summary-card">
                <span>פעילים בטווח שנבחר</span>
                <strong>{usersWithActivity}</strong>
              </article>
            </section>

            <ActivityChart buckets={buckets} />

            <section className="admin-system-popup__bucket-grid">
              {buckets.map((bucket) => (
                <ActivityBucketCard key={bucket.key} bucket={bucket} />
              ))}
            </section>

            <section className="admin-system-popup__recent-users">
              <div className="admin-system-popup__section-header">
                <h3>משתמשים אחרונים</h3>
                <p>המשתמשים הפעילים האחרונים לפי lastSeenAt.</p>
              </div>

              {recentUsers.length ? (
                <div className="admin-system-popup__table-wrap">
                  <table className="admin-system-popup__table">
                    <thead>
                      <tr>
                        <th>שם</th>
                        <th>סוג</th>
                        <th>אימייל</th>
                        <th>נראה לאחרונה</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentUsers.map((user) => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{getRoleLabel(user.role)}</td>
                          <td>{user.email ?? "-"}</td>
                          <td>{formatLastSeen(user.lastSeenAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="admin-system-popup__empty">אין עדיין משתמשים עם lastSeenAt שמתאים לסינון הזה.</p>
              )}
            </section>
          </>
        ) : null}
      </section>
    </div>
  );
}