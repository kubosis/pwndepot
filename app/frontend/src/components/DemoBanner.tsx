// src/components/DemoBanner.jsx
import React from "react";
import { DEMO_MODE } from "../config/demo";

export default function DemoBanner() {
  if (!DEMO_MODE) return null;

  return (
    <div className="demo-banner" aria-live="polite" aria-label="Demo mode banner">
      <div className="demo-banner-inner">
        <span className="demo-pill">
          <span className="demo-dot" />
          demo mode
        </span>

        <span className="demo-text">
          Data stored locally only. No real authentication or backend.
        </span>
      </div>
    </div>
  );
}
