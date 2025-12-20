// src/components/AcceptableUsePolicy.jsx
import React from "react";
import LegalPageTemplate from "./LegalPageTemplate";

function AcceptableUsePolicy() {
  const aupContent = (
    <>
      <p>
        By using PwnDepot, you agree to follow this Acceptable Use Policy (AUP):
      </p>

      <h2>Prohibited Actions</h2>
      <ul className="list-disc list-inside space-y-2">
        <li>Attack, disrupt, or overload the Platform’s infrastructure.</li>
        <li>Use the Platform to attack or exploit third-party systems.</li>
        <li>Upload, share, or distribute malware or harmful content.</li>
        <li>Engage in harassment, cheating, or abusive behavior toward other users.</li>
      </ul>

      <h2>Consequences</h2>
      <p>
        Violation of this AUP may result in immediate suspension or termination of your account.
      </p>
    </>
  );

  return <LegalPageTemplate title="Acceptable Use Policy (AUP)" content={aupContent} />;
}

export default AcceptableUsePolicy;
