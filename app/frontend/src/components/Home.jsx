// Home.jsx
import React from "react";
import { Link } from "react-router-dom"; 
import "../index.css";

export default function Home({ ctfActive }) {
  return (
    <section
      className="w-full h-screen flex items-center justify-center text-center text-white pt-14"
      style={{
        backgroundImage:
          "linear-gradient(rgba(0,0,0,0.55), rgba(0,0,0,0.55)), url('https://www.isep.fr/app/uploads/2024/10/Bandeau-Lecole.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="px-4">
        {ctfActive ? (
          <>
            {/* Displayed when CTF is active */}
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              Welcome to the PwnDepot!
            </h1>
            <p className="text-lg md:text-2xl mb-6">
              Solve challenges, learn and compete with other teams.
            </p>

            
            <Link to="/challenges" className="fancy-btn">
              Begin the challenges
            </Link>
          </>
        ) : (
          <>
            {/* Displayed when CTF is inactive */}
            <h1 className="text-4xl md:text-6xl font-bold mb-4">
              The CTF Has Ended
            </h1>
            <p className="text-lg md:text-2xl mb-6">
              Thank you for playing! We hope you enjoyed the competition.
            </p>
          </>
        )}
      </div>
    </section>
  );
}