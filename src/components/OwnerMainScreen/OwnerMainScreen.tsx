import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import appTitleLogo from "../../assets/ChatGPT Image Jan 26, 2026, 08_22_00 PM.png";
import homeBackgroundImage from "../../assets/home-background.png";
import { listParkingLots } from "../../services/parkingLots.service";
import { getUser, getCurrentBookingUserDocId, listUsers, type UserDoc, type UserListItem } from "../../services/users.service";
import {
  listParkingSpaces,
  releaseParkingSpaceReservation,
  setSpaceStatusByOwnerOrAdmin,
  type ParkingSpaceDoc,
  type SpaceStatus,
} from "../../services/parkingSpaces.service";
import OwnerSideBar from "../OwnerSideBar/OwnerSideBar";
import "./OwnerMainScreen.css";

type OwnerMainScreenProps = {
  userName: string;
  onLogout: () => void;
};

type OwnedLotView = {
  id: string;
  name: string;
  address: string;
  totalSpaces: number;
  availableSpaces: number;
  reservedSpaces: number;
  occupiedSpaces: number;
};

type SpaceView = ParkingSpaceDoc & { id: string };

type OccupiedCustomerView = {
  docId: string;
  name: string;
  email: string | null;
  phoneNumber: string | null;
  licensePlate: string | null;
  customerId: number | null;
};

type SpaceViewWithEffectiveStatus = SpaceView & {
  effectiveStatus: SpaceStatus;
};

function countByStatus(spaces: SpaceView[], status: SpaceStatus) {
  return spaces.filter((space) => space.status === status).length;
}

function getSpaceStatusLabel(status: SpaceStatus) {
  if (status === "occupied") return "תפוס";
  if (status === "reserved") return "מוזמן";
  return "פנוי";
}

function formatReservationDateTime(reservedFrom: string | null) {
  if (!reservedFrom) {
    return "-";
  }

  const date = new Date(reservedFrom);

  if (Number.isNaN(date.getTime())) {
    return reservedFrom;
  }

  return date.toLocaleString("he-IL", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function formatReservationDatePart(reservedAt: string | null) {
  if (!reservedAt) {
    return "-";
  }

  const date = new Date(reservedAt);

  if (Number.isNaN(date.getTime())) {
    return reservedAt;
  }

  return date.toLocaleDateString("he-IL", {
    dateStyle: "short",
  });
}

function formatReservationTimePart(reservedAt: string | null) {
  if (!reservedAt) {
    return "-";
  }

  const date = new Date(reservedAt);

  if (Number.isNaN(date.getTime())) {
    return reservedAt;
  }

  return date.toLocaleTimeString("he-IL", {
    timeStyle: "short",
  });
}

function formatDurationHours(durationHours: number | null | undefined) {
  if (!durationHours) {
    return "-";
  }

  return `${durationHours} שעות`;
}

function getReservationTimeStatus(space: SpaceView) {
  if (space.status !== "reserved" || !space.reservation?.reservedFrom || !space.reservation?.reservedUntil) {
    return space.status;
  }

  const now = Date.now();
  const reservedFromTime = new Date(space.reservation.reservedFrom).getTime();
  const reservedUntilTime = new Date(space.reservation.reservedUntil).getTime();

  if (Number.isNaN(reservedFromTime) || Number.isNaN(reservedUntilTime)) {
    return space.status;
  }

  if (reservedFromTime <= now && reservedUntilTime >= now) {
    return "occupied";
  }

  return space.status;
}

function enrichSpacesWithEffectiveStatus(spaces: SpaceView[]) {
  return spaces.map((space) => ({
    ...space,
    effectiveStatus: getReservationTimeStatus(space),
  }));
}

function summarizeLotFromSpaces(lot: OwnedLotView, spaces: SpaceView[]) {
  const lotSpaces = spaces.filter((space) => space.parkingLotId === lot.id);

  return {
    ...lot,
    totalSpaces: lotSpaces.length,
    availableSpaces: lotSpaces.filter((space) => getReservationTimeStatus(space) === "available").length,
    reservedSpaces: lotSpaces.filter((space) => getReservationTimeStatus(space) === "reserved").length,
    occupiedSpaces: lotSpaces.filter((space) => getReservationTimeStatus(space) === "occupied").length,
  };
}

export default function OwnerMainScreen({ userName, onLogout }: OwnerMainScreenProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [ownerUser, setOwnerUser] = useState<Partial<UserDoc> | null>(null);
  const [ownedLots, setOwnedLots] = useState<OwnedLotView[]>([]);
  const [ownedSpaces, setOwnedSpaces] = useState<SpaceView[]>([]);
  const [occupiedCustomerBySpaceId, setOccupiedCustomerBySpaceId] = useState<Record<string, OccupiedCustomerView | null>>({});
  const [selectedReservationSpaceId, setSelectedReservationSpaceId] = useState<string | null>(null);
  const [savingSpaceId, setSavingSpaceId] = useState<string | null>(null);
  const [activePage, setActivePage] = useState<'dashboard' | 'lots' | 'spaces' | 'alerts' | 'logout'>('dashboard');
  const [selectedLotId, setSelectedLotId] = useState<string | null>(null);
  const [recentlyUpdatedSpaceId, setRecentlyUpdatedSpaceId] = useState<string | null>(null);
  const [recentlyUpdatedSpaceStatus, setRecentlyUpdatedSpaceStatus] = useState<SpaceStatus | null>(null);
  const recentlyUpdatedSpaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildCustomerLookup = (users: UserListItem[]) => {
    const lookup = new Map<string, OccupiedCustomerView>();

    for (const user of users) {
      const customerView: OccupiedCustomerView = {
        docId: user.id,
        name: user.name,
        email: user.email ?? null,
        phoneNumber: user.phoneNumber ?? null,
        licensePlate: user.licensePlate ?? null,
        customerId: user.customerId ?? user.userId ?? null,
      };

      if (user.customerId !== undefined && user.customerId !== null) {
        lookup.set(String(user.customerId), customerView);
      }

      if (user.userId !== undefined && user.userId !== null) {
        lookup.set(String(user.userId), customerView);
      }

      lookup.set(user.id, customerView);
    }

    return lookup;
  };

  const loadOwnerData = async () => {
    setLoading(true);
    setError("");

    try {
      const [userDocId, lots, spaces, users] = await Promise.all([
        getCurrentBookingUserDocId(),
        listParkingLots(),
        listParkingSpaces(),
        listUsers(),
      ]);
      const currentUser = (await getUser(userDocId)) as Partial<UserDoc> | null;

      setOwnerUser(currentUser ?? null);

      const ownedLotIdList = new Set<string>([
        ...(Array.isArray(currentUser?.parkingLotIds) ? currentUser.parkingLotIds : []),
        ...(currentUser?.parkingLotId ? [currentUser.parkingLotId] : []),
      ]);

      const ownedLotIds = new Set(
        lots
          .filter((lot) => lot.ownerId === currentUser?.userId || ownedLotIdList.has(lot.id))
          .map((lot) => lot.id)
      );

      const filteredLots = lots.filter((lot) => ownedLotIds.has(lot.id));
      const filteredSpaces = enrichSpacesWithEffectiveStatus(
        spaces.filter((space) => ownedLotIds.has(space.parkingLotId))
      );
      const customerLookup = buildCustomerLookup(users);

      setOwnedLots(
        filteredLots.map((lot) => {
          const lotSpaces = filteredSpaces.filter((space) => space.parkingLotId === lot.id);

          return {
            id: lot.id,
            name: lot.name,
            address: lot.address,
            totalSpaces: lotSpaces.length,
            availableSpaces: lotSpaces.filter((space) => space.effectiveStatus === "available").length,
            reservedSpaces: lotSpaces.filter((space) => space.effectiveStatus === "reserved").length,
            occupiedSpaces: lotSpaces.filter((space) => space.effectiveStatus === "occupied").length,
          };
        })
      );

      setOwnedSpaces(filteredSpaces.sort((left, right) => left.id.localeCompare(right.id)));
      setOccupiedCustomerBySpaceId(
        filteredSpaces.reduce<Record<string, OccupiedCustomerView | null>>((accumulator, space) => {
          if (space.effectiveStatus === "available") {
            accumulator[space.id] = null;
            return accumulator;
          }

          const customerFromId =
            (space.customerId !== undefined && space.customerId !== null
              ? customerLookup.get(String(space.customerId))
              : null) ??
            (space.reservation?.reservedByUserDocId ? customerLookup.get(space.reservation.reservedByUserDocId) : null) ??
            (customerLookup.get(space.id) ?? null);

          accumulator[space.id] = customerFromId;
          return accumulator;
        }, {})
      );
      setSelectedReservationSpaceId(null);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : String(loadError);
      setError(message || "לא הצלחנו לטעון את נתוני בעל החניון.");
      setOwnedLots([]);
      setOwnedSpaces([]);
      setOccupiedCustomerBySpaceId({});
      setSelectedReservationSpaceId(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadOwnerData();
  }, []);

  useEffect(() => {
    return () => {
      if (recentlyUpdatedSpaceTimerRef.current) {
        clearTimeout(recentlyUpdatedSpaceTimerRef.current);
      }
    };
  }, []);

  const displayedSpaces = useMemo(() => {
    return selectedLotId ? ownedSpaces.filter((s) => s.parkingLotId === selectedLotId) : ownedSpaces;
  }, [ownedSpaces, selectedLotId]);

  const totals = useMemo(() => {
    return {
      lots: ownedLots.length,
      spaces: displayedSpaces.length,
      available: displayedSpaces.filter((space) => getReservationTimeStatus(space) === "available").length,
      reserved: displayedSpaces.filter((space) => getReservationTimeStatus(space) === "reserved").length,
      occupied: displayedSpaces.filter((space) => getReservationTimeStatus(space) === "occupied").length,
    };
  }, [ownedLots.length, displayedSpaces]);

  const lotNameById = useMemo(() => {
    return new Map(ownedLots.map((lot) => [lot.id, lot.name] as const));
  }, [ownedLots]);

  const updateSpaceLocally = (
    spaceId: string,
    patch: Partial<SpaceView>,
    options?: { clearOccupiedCustomer?: boolean; clearReservationSelection?: boolean }
  ) => {
    const clearOccupiedCustomer = options?.clearOccupiedCustomer ?? false;
    const clearReservationSelection = options?.clearReservationSelection ?? false;

    setOwnedSpaces((previousSpaces) => {
      const currentSpace = previousSpaces.find((space) => space.id === spaceId);

      if (!currentSpace) {
        return previousSpaces;
      }

      const updatedSpaces = previousSpaces.map((space) =>
        space.id === spaceId ? { ...space, ...patch } : space
      );

      setOwnedLots((previousLots) =>
        previousLots.map((lot) =>
          lot.id === currentSpace.parkingLotId ? summarizeLotFromSpaces(lot, updatedSpaces) : lot
        )
      );

      if (clearOccupiedCustomer || patch.status === "available" || patch.status === "reserved") {
        setOccupiedCustomerBySpaceId((previousMap) => ({
          ...previousMap,
          [spaceId]: null,
        }));
      }

      if (clearReservationSelection) {
        setSelectedReservationSpaceId((currentSelectedSpaceId) =>
          currentSelectedSpaceId === spaceId ? null : currentSelectedSpaceId
        );
      }

      if (recentlyUpdatedSpaceTimerRef.current) {
        clearTimeout(recentlyUpdatedSpaceTimerRef.current);
      }

      setRecentlyUpdatedSpaceId(spaceId);
      setRecentlyUpdatedSpaceStatus((patch.status ?? currentSpace.status) as SpaceStatus);
      recentlyUpdatedSpaceTimerRef.current = setTimeout(() => {
        setRecentlyUpdatedSpaceId((currentSpaceId) => (currentSpaceId === spaceId ? null : currentSpaceId));
        setRecentlyUpdatedSpaceStatus(null);
      }, 900);

      return updatedSpaces;
    });
  };

  const updateSpaceStatus = async (spaceId: string, status: SpaceStatus) => {
    setSavingSpaceId(spaceId);
    setError("");

    try {
      const userDocId = await getCurrentBookingUserDocId();
      await setSpaceStatusByOwnerOrAdmin(spaceId, userDocId, status);
      updateSpaceLocally(spaceId, {
        status,
        customerId: status === "occupied" ? ownedSpaces.find((space) => space.id === spaceId)?.customerId ?? null : null,
        dateTime: new Date().toISOString(),
      });
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : String(updateError);
      setError(message || "לא הצלחנו לעדכן את מצב החניה.");
    } finally {
      setSavingSpaceId(null);
    }
  };

  const cancelReservation = async (spaceId: string) => {
    setSavingSpaceId(spaceId);
    setError("");

    try {
      const selectedSpace = ownedSpaces.find((space) => space.id === spaceId);
      const reservationUserDocId = selectedSpace?.reservation?.reservedByUserDocId;

      if (!reservationUserDocId) {
        throw new Error("לא נמצא מזהה משתמש להזמנה הזו.");
      }

      await releaseParkingSpaceReservation(spaceId, reservationUserDocId);
      updateSpaceLocally(
        spaceId,
        {
          status: "available",
          customerId: null,
          reservation: null,
          dateTime: new Date().toISOString(),
        },
        { clearOccupiedCustomer: true, clearReservationSelection: true }
      );
      closeReservationDetails();
    } catch (cancelError) {
      const message = cancelError instanceof Error ? cancelError.message : String(cancelError);
      setError(message || "לא הצלחנו לבטל את ההזמנה.");
    } finally {
      setSavingSpaceId(null);
    }
  };

  const releaseOccupiedSpace = async (spaceId: string) => {
    setSavingSpaceId(spaceId);
    setError("");

    try {
      const occupiedCustomer = occupiedCustomerBySpaceId[spaceId];

      if (!occupiedCustomer?.docId) {
        throw new Error("לא נמצא מזהה משתמש לחניה התפוסה הזו.");
      }

      await releaseParkingSpaceReservation(spaceId, occupiedCustomer.docId);
      updateSpaceLocally(
        spaceId,
        {
          status: "available",
          customerId: null,
          reservation: null,
          dateTime: new Date().toISOString(),
        },
        { clearOccupiedCustomer: true }
      );
    } catch (releaseError) {
      const message = releaseError instanceof Error ? releaseError.message : String(releaseError);
      setError(message || "לא הצלחנו לשחרר את החנייה.");
    } finally {
      setSavingSpaceId(null);
    }
  };

  const openReservationDetails = (spaceId: string) => {
    setSelectedReservationSpaceId(spaceId);
  };

  const closeReservationDetails = () => {
    setSelectedReservationSpaceId(null);
  };

  const selectedReservationSpace = selectedReservationSpaceId
    ? displayedSpaces.find((space) => space.id === selectedReservationSpaceId) ?? null
    : null;

  return (
    <div className="app-shell" style={{ backgroundImage: `url(${homeBackgroundImage})` }}>
      <div className="app-shell__content owner-main-screen">
        <OwnerSideBar
          userName={userName}
          onLogout={onLogout}
          activePage={activePage}
          onPageChange={setActivePage}
          onDashboardClick={() => setActivePage('dashboard')}
          onLotsClick={() => setActivePage('lots')}
          onSpacesClick={() => setActivePage('spaces')}
          onAlertsClick={() => setActivePage('alerts')}
        />
        <header className="owner-main-screen__header">
          <img src={appTitleLogo} alt="GetParking" className="gp-title-logo owner-main-screen__logo" />
          <div className="owner-main-screen__header-copy">
            <p className="owner-main-screen__eyebrow">Owner dashboard</p>
            <h1>שלום {userName}</h1>
            <p>זהו מסך הניהול של בעל החניון. כאן תוכל לראות את החניונים שלך, מצב המקומות, ולעדכן סטטוסים במהירות.</p>
          </div>
          <button className="owner-main-screen__logout" onClick={onLogout} type="button">
            התנתקות
          </button>
        </header>

        {loading ? <div className="owner-main-screen__state">טוען נתונים...</div> : null}
        {error ? <div className="owner-main-screen__error">{error}</div> : null}

        {!loading ? (
          <>
            <section className="owner-main-screen__stats">
              <div className="owner-main-screen__stat-card">
                <span>חניונים</span>
                <strong>{totals.lots}</strong>
              </div>
              <div className="owner-main-screen__stat-card">
                <span>מקומות</span>
                <strong>{totals.spaces}</strong>
              </div>
              <div className="owner-main-screen__stat-card">
                <span>פנויים</span>
                <strong>{totals.available}</strong>
              </div>
              <div className="owner-main-screen__stat-card">
                <span>מוזמנים</span>
                <strong>{totals.reserved}</strong>
              </div>
              <div className="owner-main-screen__stat-card">
                <span>תפוסים</span>
                <strong>{totals.occupied}</strong>
              </div>
            </section>

            <section className="owner-main-screen__panel">
              <h2>החניונים שלי</h2>
              {ownedLots.length === 0 ? (
                <p className="owner-main-screen__empty">לא נמצאו חניונים משויכים לחשבון הזה.</p>
              ) : (
                <div className="owner-main-screen__lot-list">
                  {ownedLots.map((lot) => (
                    <article
                      key={lot.id}
                      className={`owner-main-screen__lot-card ${selectedLotId === lot.id ? "owner-main-screen__lot-card--active" : ""}`}
                      onClick={() => setSelectedLotId((prev) => (prev === lot.id ? null : lot.id))}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          setSelectedLotId((prev) => (prev === lot.id ? null : lot.id));
                        }
                      }}
                    >
                      <div>
                        <h3>{lot.name}</h3>
                        <p>{lot.address}</p>
                      </div>
                      <div className="owner-main-screen__lot-meta">
                        <span>סה״כ {lot.totalSpaces}</span>
                        <span>פנויים {lot.availableSpaces}</span>
                        <span>מוזמנים {lot.reservedSpaces}</span>
                        <span>תפוסים {lot.occupiedSpaces}</span>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className="owner-main-screen__panel">
              <div className="owner-main-screen__panel-header">
                <h2>מקומות לפי חניון</h2>
                {selectedLotId ? (
                  <button
                    type="button"
                    className="owner-main-screen__show-all-spaces-button"
                    onClick={() => setSelectedLotId(null)}
                  >
                    הצג חניות של כלל החניונים
                  </button>
                ) : null}
              </div>
              {displayedSpaces.length === 0 ? (
                <p className="owner-main-screen__empty">אין מקומות להצגה כרגע.</p>
              ) : (
                <div key={selectedLotId ?? "all-lots"} className="owner-main-screen__space-grid">
                  {displayedSpaces.map((space, index) => {
                      const effectiveStatus = getReservationTimeStatus(space);

                      return (
                        <article
                          key={space.id}
                          className={`owner-main-screen__space-card owner-main-screen__space-card--${effectiveStatus} ${recentlyUpdatedSpaceId === space.id ? `owner-main-screen__space-card--updated owner-main-screen__space-card--updated-${recentlyUpdatedSpaceStatus ?? effectiveStatus}` : ""}`}
                          style={{ ["--space-index" as string]: index } as CSSProperties}
                        >
                          <div className="owner-main-screen__space-header">
                            <strong>{space.id}</strong>
                            <span>{getSpaceStatusLabel(effectiveStatus)}</span>
                          </div>
                          <p>חניון: {space.parkingLotId}</p>
                          {effectiveStatus === "reserved" ? (
                            <button
                              type="button"
                              className="owner-main-screen__reservation-toggle"
                              onClick={() => openReservationDetails(space.id)}
                            >
                              פרטי הזמנה
                            </button>
                          ) : null}
                          {effectiveStatus === "occupied" ? (
                            <div className="owner-main-screen__occupied-customer">
                              <span className="owner-main-screen__occupied-customer-label">נתוני הלקוח בחניה</span>
                              {occupiedCustomerBySpaceId[space.id] ? (
                                <div className="owner-main-screen__occupied-customer-grid">
                                  <div><span>שם</span><strong>{occupiedCustomerBySpaceId[space.id]?.name ?? "-"}</strong></div>
                                  <div><span>מייל</span><strong>{occupiedCustomerBySpaceId[space.id]?.email ?? "-"}</strong></div>
                                  <div><span>טלפון</span><strong>{occupiedCustomerBySpaceId[space.id]?.phoneNumber ?? "-"}</strong></div>
                                  <div><span>לוחית</span><strong>{occupiedCustomerBySpaceId[space.id]?.licensePlate ?? "-"}</strong></div>
                                </div>
                              ) : (
                                <p className="owner-main-screen__occupied-customer-empty">לא נמצאו נתוני לקוח תואמים כרגע.</p>
                              )}
                              <button
                                type="button"
                                className="owner-main-screen__occupied-release-button"
                                onClick={() => void releaseOccupiedSpace(space.id)}
                                disabled={savingSpaceId === space.id}
                              >
                                {savingSpaceId === space.id ? "משחרר..." : "שחרור החנייה"}
                              </button>
                            </div>
                          ) : null}
                          <div className="owner-main-screen__space-actions">
                            <button
                              type="button"
                              onClick={() => void updateSpaceStatus(space.id, "available")}
                              disabled={savingSpaceId === space.id}
                            >
                              פנוי
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateSpaceStatus(space.id, "reserved")}
                              disabled={savingSpaceId === space.id}
                            >
                              מוזמן
                            </button>
                            <button
                              type="button"
                              onClick={() => void updateSpaceStatus(space.id, "occupied")}
                              disabled={savingSpaceId === space.id}
                            >
                              תפוס
                            </button>
                          </div>
                        </article>
                      );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}

        <footer className="owner-main-screen__footer">
          <span>תפקיד נוכחי: {ownerUser?.role ?? "owner"}</span>
        </footer>
      </div>

      {selectedReservationSpace ? (
        <div className="owner-main-screen__modal-overlay" role="presentation" onClick={closeReservationDetails}>
          <div className="owner-main-screen__modal" role="dialog" aria-modal="true" aria-labelledby="reservation-modal-title" onClick={(event) => event.stopPropagation()}>
            <div className="owner-main-screen__modal-header">
              <div>
                <p className="owner-main-screen__modal-eyebrow">פרטי הזמנות עתידיות</p>
                <h2 id="reservation-modal-title">פרטי החניה שנבחרה</h2>
              </div>
              <button type="button" className="owner-main-screen__modal-close" onClick={closeReservationDetails} aria-label="סגירה">
                ✕
              </button>
            </div>

            <div className="owner-main-screen__modal-table-wrap">
              <table className="owner-main-screen__modal-table">
                <thead>
                  <tr>
                    <th>פעולה</th>
                    <th>חניה</th>
                    <th>שם החניון</th>
                    <th>מי הזמין</th>
                    <th>מייל</th>
                    <th>טלפון</th>
                    <th>לוחית זיהוי</th>
                    <th>עד</th>
                    <th>מתי</th>
                    <th>לכמה זמן</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedReservationSpace ? (
                    <tr>
                      <td>
                        <button
                          type="button"
                          className="owner-main-screen__modal-cancel"
                          onClick={() => void cancelReservation(selectedReservationSpace.id)}
                          disabled={savingSpaceId === selectedReservationSpace.id}
                        >
                          בטל הזמנה
                        </button>
                      </td>
                      <td>{selectedReservationSpace.id}</td>
                      <td>{lotNameById.get(selectedReservationSpace.parkingLotId) ?? selectedReservationSpace.parkingLotId}</td>
                      <td>{occupiedCustomerBySpaceId[selectedReservationSpace.id]?.name ?? "-"}</td>
                      <td>{occupiedCustomerBySpaceId[selectedReservationSpace.id]?.email ?? "-"}</td>
                      <td>{occupiedCustomerBySpaceId[selectedReservationSpace.id]?.phoneNumber ?? "-"}</td>
                      <td>{occupiedCustomerBySpaceId[selectedReservationSpace.id]?.licensePlate ?? "-"}</td>
                      <td>
                        <div className="owner-main-screen__modal-date-time">
                          <span>{formatReservationDatePart(selectedReservationSpace.reservation?.reservedUntil ?? null)}</span>
                          <span>{formatReservationTimePart(selectedReservationSpace.reservation?.reservedUntil ?? null)}</span>
                        </div>
                      </td>
                      <td>
                        <div className="owner-main-screen__modal-date-time">
                          <span>{formatReservationDatePart(selectedReservationSpace.reservation?.reservedFrom ?? null)}</span>
                          <span>{formatReservationTimePart(selectedReservationSpace.reservation?.reservedFrom ?? null)}</span>
                        </div>
                      </td>
                      <td>{formatDurationHours(selectedReservationSpace.reservation?.durationHours ?? null)}</td>
                    </tr>
                  ) : (
                    <tr>
                      <td colSpan={10} className="owner-main-screen__modal-empty-row">
                        אין הזמנה להצגה כרגע.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
