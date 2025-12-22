// src/components/TermsOfService.jsx
import React from "react";
import LegalPageTemplate from "./LegalPageTemplate";

function TermsOfService() {
  const tosContent = (
    <>
      <p><strong>Effective Date:</strong> 22nd of January, 2026</p>

      <p>
        Welcome to the PwnDepot (the “Platform”), an educational Capture the Flag (CTF)
        platform operated by Paweł Jamroziak, Jakub Sukdol, Balázs Vincze, Tóth Bertalan, Shane Samuel PRADEEP and Navin Rajendran in affiliation
        with Institut supérieur d’électronique de Paris. By accessing or using the Platform, you agree to be
        bound by these Terms of Service (“Terms”). If you do not agree, do not use the Platform.
      </p>

      <h2>1. Purpose</h2>
      <p>
        The Platform is intended solely for educational and training purposes in cybersecurity and information security.
        It must not be used for real-world attacks, illegal hacking, or unauthorized access of third-party systems.
      </p>

      <h3>1a. Temporary Availability</h3>
      <p>
        The Platform is provided as a temporary student project and will be 
        available from 22nd of January, 2026, to 30th of January, 2026. After this period, the Platform will 
        no longer be accessible.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old to use the Platform. By registering, you confirm
        that you are legally an adult in your jurisdiction and have the legal capacity to enter into a binding
        agreement.
      </p>

      <h2>3. Accounts</h2>
      <p>
        You are responsible for maintaining the confidentiality of your login credentials. Passwords are stored securely
        (hashed and salted), but you remain responsible for account activity. We reserve the right to suspend or terminate
        accounts that violate these Terms. Accounts and user data will be handled according to our Privacy Policy, including
        deletion after the service period.
      </p>

      <h2>4. Acceptable Use</h2>
      <p>
        You may only use the Platform for lawful and educational purposes. You may
        not attempt to attack, exploit, or disrupt the Platform or its infrastructure. You may not use the Platform to practice
        or launch attacks against third-party systems.
      </p>

      <h2>5. Leaderboards and Public Data</h2>
      <p>
        Usernames, team names, and challenge scores may be displayed publicly on leaderboards.
        By participating, you consent to this public display.
      </p>

      <h2>6. Intellectual Property</h2>
      <p>
        All content, challenges, and materials provided on the Platform are the
        intellectual property of Paweł Jamroziak, Jakub Sukdol, Balázs Vincze, Tóth Bertalan, Shane Samuel PRADEEP and Navin Rajendran. You may 
        not copy, distribute, or reuse Platform materials without prior written permission.
      </p>

      <h2>7. Disclaimer of Warranties</h2>
      <p>
        The Platform is provided “AS IS” without warranties of any kind. We
        make no guarantees regarding uptime, availability, or accuracy of content. As the Platform is 
        temporary, we do not guarantee continued availability beyond the stated service period.
      </p>

      <h2>8. Limitation of Liability</h2>
      <p>
        We are not responsible for data loss, unauthorized access, or damages 
        arising from use of the Platform. Your use of the Platform is at your own risk.
      </p>

      <h2>9. Termination</h2>
      <p>
        We may suspend or terminate your access to the Platform at any time if you
        violate these Terms.
      </p>

      <h2>10. Governing Law and Jurisdiction</h2>
      <p>
        These Terms are governed by French law. Any dispute will fall 
        under the exclusive jurisdiction of the courts of France.
      </p>
    </>
  );

  return <LegalPageTemplate title="Terms of Service (ToS)" content={tosContent} />;
}

export default TermsOfService;