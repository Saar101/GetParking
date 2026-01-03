export type MockRole = "customer" | "owner" | "admin";

export type MockUser = {
  docId: string;   // doc id in Firestore: "101" / "201" / "1"
  role: MockRole;
  label: string;
};

// משתמשים לדוגמה (תואם ל-seed שלך)
export const MOCK_USERS: MockUser[] = [
  { docId: "101", role: "customer", label: 'Customer (docId "101")' },
  { docId: "201", role: "owner", label: 'Owner (docId "201")' },
  { docId: "1", role: "admin", label: 'Admin (docId "1")' },
];

// הרשאות UI זמניות (לא אבטחה אמיתית)
export function canEditSpaces(role: MockRole) {
  return role === "owner" || role === "admin";
}
