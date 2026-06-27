import { useEffect, useMemo, useState } from "react";
import {
  createUser,
  disableUserRecord,
  enableUserRecord,
  setUserRole,
  updateUser,
  type UserListItem,
  type UserRole,
} from "../../services/users.service";
import { createParkingLot, deleteParkingLot, updateParkingLot, type ParkingLotDoc } from "../../services/parkingLots.service";
import "./AdminUserManagementPopup.css";

type AdminUserManagementPopupProps = {
  isOpen: boolean;
  onClose: () => void;
  users: UserListItem[];
  usersLoading: boolean;
  usersError: string;
  parkingLots: Array<ParkingLotDoc & { id: string }>;
  parkingLotsLoading: boolean;
  parkingLotsError: string;
};

type CreateUserFormState = {
  docId: string;
  userId: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: UserRole;
};

type CreateLotFormState = {
  lotId: string;
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  basePrice: string;
  ownerDocId: string;
};

type AddressSuggestion = {
  lat: string;
  lon: string;
  display_name: string;
};

const INITIAL_CREATE_USER_FORM: CreateUserFormState = {
  docId: "",
  userId: "",
  name: "",
  email: "",
  phoneNumber: "",
  role: "customer",
};

const INITIAL_CREATE_LOT_FORM: CreateLotFormState = {
  lotId: "",
  name: "",
  address: "",
  latitude: "32.0853",
  longitude: "34.7818",
  basePrice: "20",
  ownerDocId: "",
};

const POPUP_ANIMATION_MS = 280;

function normalizeLotIds(existingLotIds: Array<string | null | undefined>, nextLotId: string) {
  return Array.from(new Set([...existingLotIds.filter(Boolean), nextLotId])) as string[];
}

export default function AdminUserManagementPopup({
  isOpen,
  onClose,
  users,
  usersLoading,
  usersError,
  parkingLots,
  parkingLotsLoading,
  parkingLotsError,
}: AdminUserManagementPopupProps) {
  const [createUserForm, setCreateUserForm] = useState<CreateUserFormState>(INITIAL_CREATE_USER_FORM);
  const [disableUserDocId, setDisableUserDocId] = useState("");
  const [showDisableConfirm, setShowDisableConfirm] = useState(false);
  const [enableUserDocId, setEnableUserDocId] = useState("");
  const [promoteUserDocId, setPromoteUserDocId] = useState("");
  const [createLotForm, setCreateLotForm] = useState<CreateLotFormState>(INITIAL_CREATE_LOT_FORM);
  const [deleteLotId, setDeleteLotId] = useState("");
  const [showDeleteLotConfirm, setShowDeleteLotConfirm] = useState(false);
  const [assignOwnerDocId, setAssignOwnerDocId] = useState("");
  const [assignLotId, setAssignLotId] = useState("");
  const [submittingAction, setSubmittingAction] = useState("");
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [addressSuggestions, setAddressSuggestions] = useState<AddressSuggestion[]>([]);
  const [isSearchingAddressSuggestions, setIsSearchingAddressSuggestions] = useState(false);
  const [isAddressSuggestionSelected, setIsAddressSuggestionSelected] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isRendered, setIsRendered] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);

  const customerUsers = useMemo(
    () => users.filter((user) => user.role === "customer" && !user.isDisabled),
    [users]
  );

  const ownerUsers = useMemo(
    () => users.filter((user) => user.role === "owner" && !user.isDisabled),
    [users]
  );

  const activeManageableUsers = useMemo(
    () => users.filter((user) => user.role !== "admin" && !user.isDisabled),
    [users]
  );

  const disabledUsers = useMemo(
    () => users.filter((user) => user.role !== "admin" && user.isDisabled),
    [users]
  );

  const selectedDisableUser = useMemo(
    () => activeManageableUsers.find((user) => user.id === disableUserDocId) ?? null,
    [disableUserDocId, activeManageableUsers]
  );

  const selectedDeleteLot = useMemo(
    () => parkingLots.find((lot) => lot.id === deleteLotId) ?? null,
    [deleteLotId, parkingLots]
  );

  useEffect(() => {
    if (!isOpen || isAddressSuggestionSelected) {
      return;
    }

    const address = createLotForm.address.trim();

    if (address.length < 3) {
      setAddressSuggestions([]);
      setIsSearchingAddressSuggestions(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSearchingAddressSuggestions(true);

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?` +
            `q=${encodeURIComponent(address)}&` +
            `countrycodes=il&` +
            `format=json&` +
            `limit=6&` +
            `addressdetails=1`,
          {
            headers: {
              "Accept-Language": "he,en",
            },
          }
        );

        if (!response.ok) {
          throw new Error("שירות הצעות הכתובות לא זמין כרגע.");
        }

        const data = (await response.json()) as AddressSuggestion[];
        setAddressSuggestions(data);
      } catch {
        setAddressSuggestions([]);
      } finally {
        setIsSearchingAddressSuggestions(false);
      }
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [createLotForm.address, isAddressSuggestionSelected, isOpen]);

  useEffect(() => {
    let closeTimer: ReturnType<typeof setTimeout> | undefined;

    if (isOpen) {
      setIsRendered(true);
      setIsClosing(false);
    } else if (isRendered) {
      setIsClosing(true);
      closeTimer = setTimeout(() => {
        setIsRendered(false);
        setIsClosing(false);
      }, POPUP_ANIMATION_MS);
    }

    return () => {
      if (closeTimer) {
        clearTimeout(closeTimer);
      }
    };
  }, [isOpen, isRendered]);

  if (!isRendered) {
    return null;
  }

  const resetFeedback = () => {
    setStatusMessage("");
    setErrorMessage("");
  };

  const applyAddressSuggestion = (suggestion: AddressSuggestion) => {
    setCreateLotForm((current) => ({
      ...current,
      address: suggestion.display_name,
      latitude: String(Number.parseFloat(suggestion.lat)),
      longitude: String(Number.parseFloat(suggestion.lon)),
    }));
    setIsAddressSuggestionSelected(true);
    setAddressSuggestions([]);
    setStatusMessage("הכתובת נבחרה והמיקום עודכן אוטומטית.");
    setErrorMessage("");
  };

  const handleResolveLotAddress = async () => {
    resetFeedback();

    const address = createLotForm.address.trim();

    if (address.length < 3) {
      setErrorMessage("יש להזין כתובת מלאה יותר כדי לאתר את המיקום.");
      return;
    }

    setIsGeocodingAddress(true);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?` +
          `q=${encodeURIComponent(address)}&` +
          `countrycodes=il&` +
          `format=json&` +
          `limit=1&` +
          `addressdetails=1`,
        {
          headers: {
            "Accept-Language": "he,en",
          },
        }
      );

      if (!response.ok) {
        throw new Error("שירות איתור הכתובות לא זמין כרגע.");
      }

      const data = (await response.json()) as AddressSuggestion[];
      const firstResult = data[0];

      if (!firstResult) {
        throw new Error("לא נמצאה התאמה לכתובת שהוזנה.");
      }

      applyAddressSuggestion(firstResult);
      setStatusMessage("הכתובת אותרה והמיקום עודכן אוטומטית.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "איתור הכתובת נכשל.");
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  const handleCreateUser = async () => {
    resetFeedback();

    const docId = createUserForm.docId.trim();
    const parsedUserId = Number.parseInt(createUserForm.userId.trim(), 10);
    const name = createUserForm.name.trim();
    const email = createUserForm.email.trim().toLowerCase();

    if (!docId || !Number.isFinite(parsedUserId) || !name || !email) {
      setErrorMessage("יש למלא מזהה מסמך, מזהה משתמש מספרי, שם ואימייל.");
      return;
    }

    setSubmittingAction("create-user");

    try {
      await createUser(docId, {
        userId: parsedUserId,
        customerId: createUserForm.role === "customer" ? parsedUserId : null,
        name,
        role: createUserForm.role,
        email,
        phoneNumber: createUserForm.phoneNumber.trim(),
        authUid: null,
        bookingHistory: [],
        bookingHistoryDetails: {},
        favoriteParkingLotIds: [],
        parkingLotId: null,
        parkingSpaceId: null,
        parkingLotIds: [],
        lastSeenAt: null,
      });

      setCreateUserForm(INITIAL_CREATE_USER_FORM);
      setStatusMessage("המשתמש נוצר בהצלחה במסד הנתונים של המערכת.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "יצירת המשתמש נכשלה.");
    } finally {
      setSubmittingAction("");
    }
  };

  const handleDisableUser = async () => {
    resetFeedback();

    if (!disableUserDocId) {
      setErrorMessage("יש לבחור משתמש להשבתה.");
      return;
    }

    setSubmittingAction("disable-user");

    try {
      await disableUserRecord(disableUserDocId);
      setDisableUserDocId("");
      setShowDisableConfirm(false);
      setStatusMessage("המשתמש הושבת במסמכי המשתמשים ב־Firestore.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "השבתת המשתמש נכשלה.");
    } finally {
      setSubmittingAction("");
    }
  };

  const handleEnableUser = async () => {
    resetFeedback();

    if (!enableUserDocId) {
      setErrorMessage("יש לבחור משתמש להסרת השבתה.");
      return;
    }

    setSubmittingAction("enable-user");

    try {
      await enableUserRecord(enableUserDocId);
      setEnableUserDocId("");
      setStatusMessage("ההשבתה הוסרה והמשתמש הופעל מחדש.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "הפעלת המשתמש מחדש נכשלה.");
    } finally {
      setSubmittingAction("");
    }
  };

  const handlePromoteUser = async () => {
    resetFeedback();

    if (!promoteUserDocId) {
      setErrorMessage("יש לבחור לקוח לקידום.");
      return;
    }

    setSubmittingAction("promote-user");

    try {
      await setUserRole(promoteUserDocId, "owner");
      await updateUser(promoteUserDocId, {
        customerId: null,
        parkingLotId: null,
        parkingLotIds: [],
      });
      setPromoteUserDocId("");
      setStatusMessage("הלקוח הועלה בהצלחה לתפקיד מנהל חניון.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "קידום המשתמש נכשל.");
    } finally {
      setSubmittingAction("");
    }
  };

  const handleCreateLot = async () => {
    resetFeedback();

    const manualLotId = createLotForm.lotId.trim();
    const lotId = manualLotId || `lot-${Date.now()}`;
    const name = createLotForm.name.trim();
    const address = createLotForm.address.trim();
    const lat = Number(createLotForm.latitude);
    const lng = Number(createLotForm.longitude);
    const basePrice = Number(createLotForm.basePrice);
    const selectedOwner = users.find((user) => user.id === createLotForm.ownerDocId);
    const ownerNumericId = Number(selectedOwner?.userId ?? 0);

    if (!name || !address || !Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(basePrice)) {
      setErrorMessage("יש למלא שם, כתובת, קואורדינטות ומחיר בסיס תקינים.");
      return;
    }

    setSubmittingAction("create-lot");

    try {
      await createParkingLot(lotId, {
        parkingLotId: lotId,
        name,
        address,
        location: { lat, lng },
        demandScore: 0,
        recommendationCount: 0,
        recommendationHistoryByHour: {},
        cardChecksCount: 0,
        cardChecksHistoryByHour: {},
        basePrice,
        ownerId: Number.isFinite(ownerNumericId) ? ownerNumericId : 0,
        createdAt: new Date().toISOString(),
      });

      if (createLotForm.ownerDocId && selectedOwner) {
        const nextLotIds = normalizeLotIds(
          [selectedOwner.parkingLotId, ...(Array.isArray(selectedOwner.parkingLotIds) ? selectedOwner.parkingLotIds : [])],
          lotId
        );

        await setUserRole(selectedOwner.id, "owner");
        await updateUser(selectedOwner.id, {
          parkingLotId: nextLotIds[0] ?? lotId,
          parkingLotIds: nextLotIds,
        });
      }

      setCreateLotForm(INITIAL_CREATE_LOT_FORM);
      setAddressSuggestions([]);
      setIsAddressSuggestionSelected(false);
      setStatusMessage(
        manualLotId ? "החניון נוצר בהצלחה." : `החניון נוצר בהצלחה עם מזהה אוטומטי: ${lotId}`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "יצירת החניון נכשלה.");
    } finally {
      setSubmittingAction("");
    }
  };

  const handleAssignOwnerToLot = async () => {
    resetFeedback();

    const owner = users.find((user) => user.id === assignOwnerDocId);
    const lot = parkingLots.find((parkingLot) => parkingLot.id === assignLotId);

    if (!owner || !lot) {
      setErrorMessage("יש לבחור מנהל חניון וחניון לשיוך.");
      return;
    }

    setSubmittingAction("assign-owner");

    try {
      const nextLotIds = normalizeLotIds(
        [owner.parkingLotId, ...(Array.isArray(owner.parkingLotIds) ? owner.parkingLotIds : [])],
        lot.id
      );

      await setUserRole(owner.id, "owner");
      await updateUser(owner.id, {
        parkingLotId: nextLotIds[0] ?? lot.id,
        parkingLotIds: nextLotIds,
      });
      await updateParkingLot(lot.id, { ownerId: owner.userId });

      setAssignOwnerDocId("");
      setAssignLotId("");
      setStatusMessage("מנהל החניון שויך בהצלחה לחניון.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "שיוך מנהל החניון נכשל.");
    } finally {
      setSubmittingAction("");
    }
  };

  const handleUnassignOwnerFromLot = async () => {
    resetFeedback();

    const owner = users.find((user) => user.id === assignOwnerDocId);
    const lot = parkingLots.find((parkingLot) => parkingLot.id === assignLotId);

    if (!owner || !lot) {
      setErrorMessage("יש לבחור מנהל חניון וחניון לביטול שיוך.");
      return;
    }

    const existingLotIds = normalizeLotIds(
      [owner.parkingLotId, ...(Array.isArray(owner.parkingLotIds) ? owner.parkingLotIds : [])],
      owner.parkingLotId ?? ""
    ).filter((lotId) => lotId !== lot.id);

    const isAssignedToOwner =
      lot.ownerId === owner.userId ||
      owner.parkingLotId === lot.id ||
      (Array.isArray(owner.parkingLotIds) && owner.parkingLotIds.includes(lot.id));

    if (!isAssignedToOwner) {
      setErrorMessage("החניון שנבחר לא משויך כרגע למנהל החניון שנבחר.");
      return;
    }

    setSubmittingAction("unassign-owner");

    try {
      await updateUser(owner.id, {
        parkingLotId: existingLotIds[0] ?? null,
        parkingLotIds: existingLotIds,
      });
      await updateParkingLot(lot.id, { ownerId: 0 });

      setAssignOwnerDocId("");
      setAssignLotId("");
      setStatusMessage("שיוך מנהל החניון הוסר בהצלחה.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "ביטול שיוך מנהל החניון נכשל.");
    } finally {
      setSubmittingAction("");
    }
  };

  const handleDeleteLot = async () => {
    resetFeedback();

    const lot = parkingLots.find((parkingLot) => parkingLot.id === deleteLotId);

    if (!lot) {
      setErrorMessage("יש לבחור חניון למחיקה.");
      return;
    }

    setSubmittingAction("delete-lot");

    try {
      const affectedOwners = users.filter((user) => {
        if (user.role !== "owner") {
          return false;
        }

        return user.parkingLotId === lot.id || (Array.isArray(user.parkingLotIds) && user.parkingLotIds.includes(lot.id));
      });

      await Promise.all(
        affectedOwners.map(async (owner) => {
          const nextLotIds = [owner.parkingLotId, ...(Array.isArray(owner.parkingLotIds) ? owner.parkingLotIds : [])]
            .filter((ownerLotId): ownerLotId is string => Boolean(ownerLotId) && ownerLotId !== lot.id)
            .filter((ownerLotId, index, ownerLotIds) => ownerLotIds.indexOf(ownerLotId) === index);

          await updateUser(owner.id, {
            parkingLotId: nextLotIds[0] ?? null,
            parkingLotIds: nextLotIds,
          });
        })
      );

      await deleteParkingLot(lot.id);

      setDeleteLotId("");
      setShowDeleteLotConfirm(false);
      setStatusMessage("החניון נמחק בהצלחה יחד עם מקומות החניה והשייכים שלו.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "מחיקת החניון נכשלה.");
    } finally {
      setSubmittingAction("");
    }
  };

  return (
    <div
      className={`admin-user-popup__backdrop ${isClosing ? "admin-user-popup__backdrop--closing" : ""}`}
      role="presentation"
      onClick={onClose}
    >
      <section
        className={`admin-user-popup ${isClosing ? "admin-user-popup--closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-user-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="admin-user-popup__header">
          <div>
            <p className="admin-user-popup__eyebrow">User administration</p>
            <h2 id="admin-user-popup-title">ניהול משתמשים וחניונים</h2>
            <p className="admin-user-popup__description">
              כאן אפשר לנהל רשומות מערכת: ליצור ולמחוק משתמשים, לקדם לקוח למנהל חניון, ליצור חניון ולשייך
              מנהל לחניון.
            </p>
          </div>

          <button type="button" className="admin-user-popup__close" onClick={onClose} aria-label="סגור">
            ×
          </button>
        </header>
        {usersLoading || parkingLotsLoading ? <p className="admin-user-popup__state">טוען נתוני ניהול...</p> : null}
        {usersError ? <p className="admin-user-popup__state admin-user-popup__state--error">{usersError}</p> : null}
        {parkingLotsError ? <p className="admin-user-popup__state admin-user-popup__state--error">{parkingLotsError}</p> : null}
        {statusMessage ? <p className="admin-user-popup__state admin-user-popup__state--success">{statusMessage}</p> : null}
        {errorMessage ? <p className="admin-user-popup__state admin-user-popup__state--error">{errorMessage}</p> : null}

        <div className="admin-user-popup__grid">
          <section className="admin-user-popup__card">
            <div className="admin-user-popup__section-header">
              <h3>יצירת משתמש</h3>
              <p>יצירת מסמך משתמש חדש במערכת.</p>
            </div>

            <div className="admin-user-popup__form-grid">
              <input
                className="admin-user-popup__input"
                placeholder="מזהה מסמך"
                value={createUserForm.docId}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, docId: event.target.value }))}
              />
              <input
                className="admin-user-popup__input"
                placeholder="מזהה משתמש מספרי"
                value={createUserForm.userId}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, userId: event.target.value }))}
              />
              <input
                className="admin-user-popup__input"
                placeholder="שם מלא"
                value={createUserForm.name}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                className="admin-user-popup__input"
                placeholder="אימייל"
                value={createUserForm.email}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, email: event.target.value }))}
              />
              <input
                className="admin-user-popup__input"
                placeholder="טלפון"
                value={createUserForm.phoneNumber}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, phoneNumber: event.target.value }))}
              />
              <select
                className="admin-user-popup__input"
                value={createUserForm.role}
                onChange={(event) => setCreateUserForm((current) => ({ ...current, role: event.target.value as UserRole }))}
              >
                <option value="customer">לקוח</option>
                <option value="owner">מנהל חניון</option>
                <option value="admin">אדמין</option>
              </select>
            </div>

            <button
              type="button"
              className="admin-user-popup__action"
              onClick={() => void handleCreateUser()}
              disabled={submittingAction === "create-user"}
            >
              {submittingAction === "create-user" ? "יוצר משתמש..." : "צור משתמש"}
            </button>
          </section>

          <section className="admin-user-popup__card">
            <div className="admin-user-popup__section-header">
              <h3>השבתת משתמש</h3>
              <p>סימון המשתמש כמושבת בלי למחוק את מסמך ה־Firestore שלו.</p>
            </div>

            <select
              className="admin-user-popup__input"
              value={disableUserDocId}
              onChange={(event) => setDisableUserDocId(event.target.value)}
            >
              <option value="">בחר משתמש להשבתה</option>
              {activeManageableUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>

            <button
              type="button"
              className="admin-user-popup__action admin-user-popup__action--danger"
              onClick={() => {
                resetFeedback();

                if (!disableUserDocId) {
                  setErrorMessage("יש לבחור משתמש להשבתה.");
                  return;
                }

                setShowDisableConfirm(true);
              }}
              disabled={submittingAction === "disable-user"}
            >
              {submittingAction === "disable-user" ? "משבית משתמש..." : "השבת משתמש"}
            </button>
          </section>

          <section className="admin-user-popup__card">
            <div className="admin-user-popup__section-header">
              <h3>הסרת השבתה</h3>
              <p>הפעלה מחדש של משתמש מושבת מתוך אזור נפרד.</p>
            </div>

            <select
              className="admin-user-popup__input"
              value={enableUserDocId}
              onChange={(event) => setEnableUserDocId(event.target.value)}
            >
              <option value="">בחר משתמש להפעלה מחדש</option>
              {disabledUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.role})
                </option>
              ))}
            </select>

            <button
              type="button"
              className="admin-user-popup__action"
              onClick={() => void handleEnableUser()}
              disabled={submittingAction === "enable-user"}
            >
              {submittingAction === "enable-user" ? "מפעיל משתמש..." : "הסר השבתה"}
            </button>
          </section>

          <section className="admin-user-popup__card">
            <div className="admin-user-popup__section-header">
              <h3>הפיכת לקוח למנהל חניון</h3>
              <p>קידום משתמש קיים מתפקיד לקוח לתפקיד מנהל חניון.</p>
            </div>

            <select
              className="admin-user-popup__input"
              value={promoteUserDocId}
              onChange={(event) => setPromoteUserDocId(event.target.value)}
            >
              <option value="">בחר לקוח לקידום</option>
              {customerUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name} ({user.email ?? "ללא אימייל"})
                </option>
              ))}
            </select>

            <button
              type="button"
              className="admin-user-popup__action"
              onClick={() => void handlePromoteUser()}
              disabled={submittingAction === "promote-user"}
            >
              {submittingAction === "promote-user" ? "מעדכן תפקיד..." : "הפוך למנהל חניון"}
            </button>
          </section>

          <section className="admin-user-popup__card admin-user-popup__card--wide">
            <div className="admin-user-popup__section-header">
              <h3>יצירת חניון</h3>
              <p>פתיחת חניון חדש עם נתוני בסיס ואפשרות לשיוך ראשוני לבעלים.</p>
            </div>

            <div className="admin-user-popup__form-grid admin-user-popup__form-grid--wide">
              <input
                className="admin-user-popup__input"
                placeholder="מזהה חניון (אופציונלי)"
                value={createLotForm.lotId}
                onChange={(event) => setCreateLotForm((current) => ({ ...current, lotId: event.target.value }))}
              />
              <input
                className="admin-user-popup__input"
                placeholder="שם חניון"
                value={createLotForm.name}
                onChange={(event) => setCreateLotForm((current) => ({ ...current, name: event.target.value }))}
              />
              <div className="admin-user-popup__address-field">
                <input
                  className="admin-user-popup__input"
                  placeholder="כתובת"
                  value={createLotForm.address}
                  onChange={(event) => {
                    const nextAddress = event.target.value;

                    setCreateLotForm((current) => ({ ...current, address: nextAddress }));
                    setIsAddressSuggestionSelected(false);
                  }}
                />
                {isSearchingAddressSuggestions ? (
                  <p className="admin-user-popup__address-hint">מחפש כתובות תואמות...</p>
                ) : null}
                {!isSearchingAddressSuggestions && addressSuggestions.length > 0 ? (
                  <div className="admin-user-popup__address-suggestions" role="listbox" aria-label="הצעות כתובת">
                    {addressSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.lat}-${suggestion.lon}-${suggestion.display_name}`}
                        type="button"
                        className="admin-user-popup__address-suggestion"
                        onClick={() => applyAddressSuggestion(suggestion)}
                      >
                        {suggestion.display_name}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="admin-user-popup__secondary-action"
                onClick={() => void handleResolveLotAddress()}
                disabled={isGeocodingAddress}
              >
                {isGeocodingAddress ? "מאתר כתובת..." : "אתר כתובת"}
              </button>
              <input
                className="admin-user-popup__input"
                placeholder="קו רוחב"
                value={createLotForm.latitude}
                onChange={(event) => setCreateLotForm((current) => ({ ...current, latitude: event.target.value }))}
              />
              <input
                className="admin-user-popup__input"
                placeholder="קו אורך"
                value={createLotForm.longitude}
                onChange={(event) => setCreateLotForm((current) => ({ ...current, longitude: event.target.value }))}
              />
              <input
                className="admin-user-popup__input"
                placeholder="מחיר בסיס"
                value={createLotForm.basePrice}
                onChange={(event) => setCreateLotForm((current) => ({ ...current, basePrice: event.target.value }))}
              />
              <select
                className="admin-user-popup__input"
                value={createLotForm.ownerDocId}
                onChange={(event) => setCreateLotForm((current) => ({ ...current, ownerDocId: event.target.value }))}
              >
                <option value="">ללא שיוך ראשוני</option>
                {ownerUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="admin-user-popup__action"
              onClick={() => void handleCreateLot()}
              disabled={submittingAction === "create-lot"}
            >
              {submittingAction === "create-lot" ? "יוצר חניון..." : "צור חניון"}
            </button>
          </section>

          <section className="admin-user-popup__card admin-user-popup__card--wide">
            <div className="admin-user-popup__section-header">
              <h3>מחיקת חניון</h3>
              <p>מחיקה מלאה של החניון, מקומות החניה שלו, והסרת שיוך מבעלים קיימים.</p>
            </div>

            <div className="admin-user-popup__form-grid">
              <select
                className="admin-user-popup__input"
                value={deleteLotId}
                onChange={(event) => setDeleteLotId(event.target.value)}
              >
                <option value="">בחר חניון למחיקה</option>
                {parkingLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="admin-user-popup__action admin-user-popup__action--danger"
              onClick={() => {
                resetFeedback();

                if (!deleteLotId) {
                  setErrorMessage("יש לבחור חניון למחיקה.");
                  return;
                }

                setShowDeleteLotConfirm(true);
              }}
              disabled={submittingAction === "delete-lot"}
            >
              {submittingAction === "delete-lot" ? "מוחק חניון..." : "מחק חניון"}
            </button>
          </section>

          <section className="admin-user-popup__card admin-user-popup__card--wide">
            <div className="admin-user-popup__section-header">
              <h3>שיוך מנהל חניון לחניון</h3>
              <p>קישור בעל חניון לחניון קיים ועדכון הבעלות בשני הצדדים.</p>
            </div>

            <div className="admin-user-popup__form-grid">
              <select
                className="admin-user-popup__input"
                value={assignOwnerDocId}
                onChange={(event) => setAssignOwnerDocId(event.target.value)}
              >
                <option value="">בחר מנהל חניון</option>
                {ownerUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name}
                  </option>
                ))}
              </select>

              <select
                className="admin-user-popup__input"
                value={assignLotId}
                onChange={(event) => setAssignLotId(event.target.value)}
              >
                <option value="">בחר חניון</option>
                {parkingLots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {lot.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="admin-user-popup__action"
              onClick={() => void handleAssignOwnerToLot()}
              disabled={submittingAction === "assign-owner"}
            >
              {submittingAction === "assign-owner" ? "משייך מנהל..." : "שייך מנהל לחניון"}
            </button>

            <button
              type="button"
              className="admin-user-popup__secondary-action admin-user-popup__secondary-action--danger"
              onClick={() => void handleUnassignOwnerFromLot()}
              disabled={submittingAction === "unassign-owner"}
            >
              {submittingAction === "unassign-owner" ? "מבטל שיוך..." : "בטל שיוך לחניון"}
            </button>
          </section>
        </div>

        {showDisableConfirm && selectedDisableUser ? (
          <div className="admin-user-popup__confirm-overlay" role="presentation" onClick={() => setShowDisableConfirm(false)}>
            <section
              className="admin-user-popup__confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-user-popup-disable-title"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="admin-user-popup__confirm-eyebrow">אישור השבתה</p>
              <h3 id="admin-user-popup-disable-title">להשבית את {selectedDisableUser.name}?</h3>
              <p className="admin-user-popup__confirm-message">
                הפעולה תשאיר את מסמך המשתמש ב־Firestore אבל תסמן אותו כמושבת, כך שלא יהיה אפשר להשתמש בו עד להסרת ההשבתה.
              </p>

              <div className="admin-user-popup__confirm-actions">
                <button
                  type="button"
                  className="admin-user-popup__confirm-button admin-user-popup__confirm-button--ghost"
                  onClick={() => setShowDisableConfirm(false)}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="admin-user-popup__confirm-button admin-user-popup__confirm-button--danger"
                  onClick={() => void handleDisableUser()}
                  disabled={submittingAction === "disable-user"}
                >
                  {submittingAction === "disable-user" ? "משבית..." : "כן, להשבית"}
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {showDeleteLotConfirm && selectedDeleteLot ? (
          <div className="admin-user-popup__confirm-overlay" role="presentation" onClick={() => setShowDeleteLotConfirm(false)}>
            <section
              className="admin-user-popup__confirm-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="admin-user-popup-delete-lot-title"
              onClick={(event) => event.stopPropagation()}
            >
              <p className="admin-user-popup__confirm-eyebrow">אישור מחיקת חניון</p>
              <h3 id="admin-user-popup-delete-lot-title">למחוק את {selectedDeleteLot.name}?</h3>
              <p className="admin-user-popup__confirm-message">
                הפעולה תמחק את החניון מ־Firestore, תסיר את כל מקומות החניה שלו, ותבטל את השיוך שלו מכל מנהל חניון שמקושר אליו.
              </p>

              <div className="admin-user-popup__confirm-actions">
                <button
                  type="button"
                  className="admin-user-popup__confirm-button admin-user-popup__confirm-button--ghost"
                  onClick={() => setShowDeleteLotConfirm(false)}
                >
                  ביטול
                </button>
                <button
                  type="button"
                  className="admin-user-popup__confirm-button admin-user-popup__confirm-button--danger"
                  onClick={() => void handleDeleteLot()}
                  disabled={submittingAction === "delete-lot"}
                >
                  {submittingAction === "delete-lot" ? "מוחק..." : "כן, למחוק"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </section>
    </div>
  );
}