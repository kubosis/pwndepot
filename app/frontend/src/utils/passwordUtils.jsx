// src/utils/passwordUtils.jsx
// we keep hashing only for demo purposes with SHA-256, in real world you do not hash password in FE. In backend use of Argon2 + salt for secure password storing.
export function evaluatePassword(password) {
  let strength = 0;

  const lengthRule = password.length >= 12;
  const uppercaseRule = /[A-Z]/.test(password);
  const numberRule = /[0-9]/.test(password);
  const specialCharRule = /[!@#$%^&*(),.?":{}|<>]/.test(password);

  if (lengthRule) strength += 1;
  if (uppercaseRule) strength += 1;
  if (numberRule) strength += 1;
  if (specialCharRule) strength += 1;

  let message;
  if (strength < 2) message = "Weak";
  else if (strength === 2 || strength === 3) message = "Moderate";
  else message = "Strong";

  return {
    strength,
    message,
    isValid: lengthRule && uppercaseRule && numberRule && specialCharRule,
  };
}

// Hashing utility: hashes password using SHA-256 via SubtleCrypto
export async function hashPassword(password) {

  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}