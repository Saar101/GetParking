import type { ButtonHTMLAttributes, ReactNode } from "react";
import "./Button.css";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  fullWidth?: boolean;
};

export default function Button({ children, fullWidth = false, ...rest }: Props) {
  const className = [
    "gp-btn",
    fullWidth ? "gp-btn--full" : "",
    rest.disabled ? "gp-btn--disabled" : "",
    rest.className ?? "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button {...rest} className={className}>
      {children}
    </button>
  );
}
