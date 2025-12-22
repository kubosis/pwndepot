export default function MFAInput({
  value,
  onChange,
  onVerify,
  loading = false,
  error = "",
  success = "",
}) {
  return (
    <div className="mfa-box">
      <input
        type="password"
        inputMode="numeric"
        autoComplete="one-time-code"
        placeholder="Enter MFA code"
        value={value}
        maxLength={6}
        onChange={(e) =>
          onChange(e.target.value.replace(/\D/g, ""))
        }
        disabled={loading || !!success}
      />

      <button
        className="danger-btn"
        disabled={loading || value.length !== 6}
        onClick={onVerify}
      >
        {loading ? "Verifying..." : "Verify MFA"}
      </button>

      {/* Show ONLY one state at a time */}
      {success && !error && (
        <p className="success-text">{success}</p>
      )}

      {error && !success && (
        <p className="error-text">{error}</p>
      )}
    </div>
  );
}
