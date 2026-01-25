// src/components/LegalNotice.jsx
import React from "react";
import LegalPageTemplate from "./LegalPageTemplate";

function LegalNotice() {
  const legalContent = (
    <>
      <p><strong>Effective Date:</strong> 22nd of January, 2026</p>

      <p>
        In accordance with French law, the following legal notice applies to PwnDepot:
      </p>

      <h2>Publisher</h2>
      <p>Students of Software Security Course Project</p>

      <h2>Publication Directors</h2>
      <p>Paweł Jamroziak, Jakub Sukdol, Balázs Vincze, Tóth Bertalan, Shane Samuel PRADEEP and Navin Rajendran</p>

      <h2>Hosting Provider</h2>
      <p>Hetzner Online GmbH, +49 (0)9831 505-0</p>

      <h2>Contact</h2>
      <p>e-mail: contact@pwndep0t.com</p>

      <h2>Purpose</h2>
      <p>
        The Platform is a educational project carried out within the framework of the
        Software Security subject at ISEP (Institut Supérieur d'Électronique de Paris).
      </p>
    </>
  );

  return <LegalPageTemplate title="Legal Notice / Mentions Légales" content={legalContent} />;
}

export default LegalNotice;