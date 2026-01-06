import './ParkingApproved.css';

interface ParkingApprovedProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ParkingApproved({ isOpen, onClose }: ParkingApprovedProps) {
  if (!isOpen) return null;

  // Auto close after 3 seconds
  setTimeout(() => {
    onClose();
  }, 3000);

  return (
    <div className="parking-approved-overlay" onClick={onClose}>
      <div className="parking-approved-popup" onClick={(e) => e.stopPropagation()}>
        <div className="checkmark-circle">
          <div className="checkmark">✓</div>
        </div>
        <h2>החנייה מאושרת!</h2>
        <p>החנייה שלך הוזמנה בהצלחה</p>
      </div>
    </div>
  );
}
