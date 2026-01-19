// src/components/MFAInput.jsx
import React from "react";

export default function MFAInput({
  value,
  onChange,
  disabled = false,
  placeholder = "Enter MFA code",
  allowBackup = false,
  type = "text",
  onKeyDown,
  className = "",
}) {
  return (
    <input
      type={type}
      inputMode={allowBackup ? "text" : "numeric"}
      autoComplete="one-time-code"
      placeholder={placeholder}
      value={value}
      onKeyDown={onKeyDown}
      onChange={(e) =>
        onChange(
          allowBackup
            ? e.target.value.toUpperCase().replace(/\s/g, "")
            : e.target.value.replace(/\D/g, "")
        )
      }
      maxLength={allowBackup ? 16 : 6}
      disabled={disabled}
      className={`admin-input mono text-center tracking-widest ${className}`}
    />
  );
}
