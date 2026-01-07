// src/components/PrivacyPolicy.jsx
import React from "react";
import LegalPageTemplate from "./LegalPageTemplate";

function PrivacyPolicy() {
  const privacyContent = (
    <>
      <p><strong>Effective Date:</strong> 22nd of January, 2026</p>

      <p>
        We respect your privacy. This Privacy Policy explains how Paweł Jamroziak, Jakub Sukdol, 
        Balázs Vincze, Tóth Bertalan, Shane Samuel PRADEEP and Navin Rajendran in affiliation with Institut supérieur d’électronique de Paris collects, 
        uses, and protects your personal data when you use PwnDepot, in compliance with the
        EU General Data Protection Regulation (GDPR) and French data protection law.
      </p>

      <h2>1. Data We Collect</h2>
      <p>
        <strong>Account Data:</strong> Username, password (stored securely with hashing and salting), team name, and email address.<br/>
        <strong>Usage Data:</strong> Challenge completions, scores, and leaderboard positions.<br/>
        <strong>Technical Data:</strong> Log files, IP address, browser type (for security and troubleshooting).
      </p>

      <h2>2. How We Use Your Data</h2>
      <p>
        To provide and operate the Platform. To display usernames, team names, and scores on leaderboards. To maintain security, prevent fraud, and improve services.
      </p>

      <h2>3. Legal Basis for Processing</h2>
      <p>
        We process your personal data based on:<br/>
        - Your consent (when registering an account).<br/>
        - Our legitimate interests (to ensure security and proper functioning of the Platform).<br/>
        - Compliance with legal obligations (when required by French/EU law).
      </p>

      <h2>4. Data Security</h2>
      <p>
        Passwords are never stored in plain text. Data is stored using industry-standard security practices. No system is 100% secure - use of the Platform is at your own risk.
      </p>

      <h2>5. Data Sharing</h2>
      <p>
        We do not sell, rent, or trade your data. Data may be shared with trusted service providers (e.g., Institut supérieur d’électronique de Paris) under strict confidentiality. Data may be disclosed if required by law or legal process.
      </p>

      <h2>6. Data Retention</h2>
      <p>
        Account data is retained as long as you have an active account. You may request deletion of your account and personal data at any time. Please note: This is a temporary educational platform available only from 22nd to 30th of January, 2026. User accounts and data will be deleted automatically after this period.
      </p>

      <h2>7. Your Rights Under GDPR</h2>
      <p>
        As a user in the EU/France, you have the right to:<br/>
        - Access your personal data.<br/>
        - Request correction or deletion of your data.<br/>
        - Restrict or object to processing.<br/>
        - Request data portability.<br/>
        - Lodge a complaint with the Commission Nationale de l’Informatique et des Libertés (CNIL).<br/>
        You may exercise your rights by contacting us at: <strong>isepctfplatform@gmail.com</strong>
      </p>
    </>
  );

  return <LegalPageTemplate title="Privacy Policy" content={privacyContent} />;
}

export default PrivacyPolicy;
