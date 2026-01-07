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
      <p>ISEP Students - Software Security Course Project</p>

      <h2>Institution</h2>
      <p>ISEP, 10 rue de Vanves, 92130 Issy-les-Moulineaux, France</p>

      <h2>Publication Directors</h2>
      <p>Paweł Jamroziak, Jakub Sukdol, Balázs Vincze, Tóth Bertalan, Shane Samuel PRADEEP and Navin Rajendran</p>

      <h2>Hosting Provider</h2>
      <p>Institut supérieur d’électronique de Paris, 10 Rue de Vanves, 92130 Issy-les-Moulineaux, +33 01 49 54 52 00</p>

      <h2>Contact</h2>
      <p>e-mail: isepctfplatform@gmail.com</p>

      <h2>Purpose</h2>
      <p>
        The Platform is a non-commercial educational project carried out within the framework of the
        Software Security subject at ISEP (Institut Supérieur d’Électronique de Paris).
      </p>
    </>
  );

  return <LegalPageTemplate title="Legal Notice / Mentions Légales" content={legalContent} />;
}

export default LegalNotice;