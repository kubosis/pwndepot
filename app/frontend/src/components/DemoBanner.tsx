import { DEMO_MODE } from "../config/demo";
import React from "react";

export default function DemoBanner() {
  if (!DEMO_MODE) return null;

  return (
    <>
      <div
        className="demo-banner"
        style={{
          position: "fixed",
          top: 5,
          left: -80,
          width: "100%",
          color: "whitesmoke",
          fontWeight: 600,
          textAlign: "center",
          padding: "clamp(4px, 1vw, 10px) 0",
          fontSize: "clamp(10px, 1.2vw, 16px)",
          zIndex: 9999,
          pointerEvents: "none", // makes navbar fully clickable underneath
          background: "transparent",
          transition: "all 0.3s ease-in-out",
        }}
      >
        ⚠️ Demo Mode Active - Data stored locally only. No real authentication or backend.
      </div>

      <style>
        {`
          @media (max-width: 1510px) {
            .demo-banner {
              display: none;
            }
          }
        `}
      </style>
    </>
  );
}
