export default function MFAInput({
  value,
  onChange,
  onVerify,
  loading = false,
  error = "",
  success = "",
  placeholder = "Enter MFA code",
  allowBackup = false,
  showHint = false,
}) {
  return (
    <div className="mfa-box">
      <input
        type="password"
        autoComplete="one-time-code"
        placeholder={placeholder}
        value={value}
        onChange={(e) =>
          onChange(
            allowBackup
              ? e.target.value.toUpperCase().replace(/\s/g, "")
              : e.target.value.replace(/\D/g, "")
          )
        }
        maxLength={allowBackup ? 16 : 6}
        disabled={loading || !!success}
        className="modal-input"
      />

      <button
        className="danger-btn"
        disabled={loading || value.length < 6}
        onClick={onVerify}
      >
        {loading ? "Verifying..." : "Verify MFA"}
      </button>

      {success && !error && (
        <p className="success-text">{success}</p>
      )}

      {error && !success && (
        <p className="error-text">{error}</p>
      )}

      {showHint && (
        <p className="text-gray-400 text-sm text-center mt-2">
          You can use a 6-digit code or a recovery backup code
        </p>
      )}
    </div>
  );
}