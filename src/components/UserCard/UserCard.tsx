import "./UserCard.css";

export type UserRole = "customer" | "owner" | "admin";

export type UserCardUser = {
  docId: string;
  role: UserRole;
  label: string;
};

type Props = {
  user: UserCardUser;
};

function roleLabel(role: UserRole) {
  if (role === "customer") return "Customer";
  if (role === "owner") return "Owner";
  return "Admin";
}

export default function UserCard({ user }: Props) {
  return (
    <div className="gp-usercard">
      <div className="gp-usercard__top">
        <div className="gp-usercard__title">Current User</div>

        <span className={`gp-usercard__badge gp-usercard__badge--${user.role}`}>
          {roleLabel(user.role)}
        </span>
      </div>

      <div className="gp-usercard__body">
        <div className="gp-usercard__row">
          <span className="gp-usercard__label">Display</span>
          <span className="gp-usercard__value">{user.label}</span>
        </div>

        <div className="gp-usercard__row">
          <span className="gp-usercard__label">docId</span>
          <span className="gp-usercard__mono">{user.docId}</span>
        </div>

        <div className="gp-usercard__row">
          <span className="gp-usercard__label">role</span>
          <span className="gp-usercard__mono">{user.role}</span>
        </div>
      </div>
    </div>
  );
}
