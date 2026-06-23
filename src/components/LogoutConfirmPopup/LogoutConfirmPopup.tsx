import "./LogoutConfirmPopup.css";

type LogoutConfirmPopupProps = {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function LogoutConfirmPopup({ isOpen, onConfirm, onCancel }: LogoutConfirmPopupProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="logout-confirm-popup__overlay" role="presentation" onClick={onCancel}>
      <section
        className="logout-confirm-popup"
        role="dialog"
        aria-modal="true"
        aria-labelledby="logout-confirm-popup-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="logout-confirm-popup__icon" aria-hidden="true">👋</div>
        <p className="logout-confirm-popup__eyebrow">רגע לפני שיוצאים</p>
        <h2 id="logout-confirm-popup-title">להתנתק מהחשבון?</h2>
        <p className="logout-confirm-popup__message">האם אתה בטוח שברצונך להתנתק עכשיו?</p>

        <div className="logout-confirm-popup__actions">
          <button type="button" className="logout-confirm-popup__button logout-confirm-popup__button--ghost" onClick={onCancel}>
            לא
          </button>
          <button type="button" className="logout-confirm-popup__button logout-confirm-popup__button--primary" onClick={onConfirm}>
            כן, להתנתק
          </button>
        </div>
      </section>
    </div>
  );
}