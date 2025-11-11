import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { DEMO_MODE } from "../config/demo";

// ==================== Mock Data (demo mode) ====================
const teams = [
  { name: "CryptoMasters", users: ["alice", "bob"] },
  { name: "WebWizards", users: ["charlie", "dave"] },
];

const mockChallenges = {
  Web: [
    {
      id: 1,
      title: "Warm Up",
      points: 100,
      description: "Basic web challenge to get started.",
      hints: ["Check the source code.", "Look for hidden comments."],
      flag: "warmup123",
      completedBy: [
        { username: "alice", points: 100 },
        { username: "bob", points: 100 },
      ],
    },
    {
      id: 2,
      title: "Cascade",
      points: 100,
      description: "CSS challenge for styling skills.",
      hints: ["Inspect elements.", "Try different selectors."],
      flag: "cascade456",
      completedBy: [{ username: "charlie", points: 100 }],
    },
    {
      id: 3,
      title: "XSS Fun",
      points: 150,
      description: "Find the XSS vulnerability.",
      hints: ["Input fields are key."],
      flag: "xss789",
      completedBy: [{ username: "dave", points: 150 }],
    },
  ],
  Reversing: [
    {
      id: 4,
      title: "Easy Crack",
      points: 120,
      description: "Reverse this binary.",
      hints: ["Use strings command."],
      flag: "crack123",
      completedBy: [{ username: "alice", points: 120 }],
    },
    {
      id: 5,
      title: "Assembly Puzzle",
      points: 180,
      description: "Analyze the assembly code.",
      hints: ["IDA or Ghidra helps."],
      flag: "asm456",
      completedBy: [{ username: "bob", points: 180 }],
    },
  ],
  Crypto: [
    {
      id: 6,
      title: "Caesar Salad",
      points: 150,
      description: "Decrypt the Caesar cipher.",
      hints: ["Shift letters."],
      flag: "caesar123",
      completedBy: [{ username: "charlie", points: 150 }],
    },
    {
      id: 7,
      title: "RSA Fun",
      points: 300,
      description: "Factor the modulus.",
      hints: ["Small primes."],
      flag: "rsa456",
      completedBy: [{ username: "dave", points: 300 }],
    },
  ],
  Misc: [
    {
      id: 8,
      title: "Stego Challenge",
      points: 200,
      description: "Find the hidden message in the image.",
      hints: ["Check LSB."],
      flag: "stego123",
      completedBy: [],
    },
    {
      id: 9,
      title: "Logic Puzzle",
      points: 100,
      description: "Solve the logic riddle.",
      hints: ["Think step by step."],
      flag: "logic456",
      completedBy: [],
    },
  ],
};

// ==================== Challenge Card ====================
function ChallengeCard({ challenge, onClick, username }) {
  const completedSet = new Set(challenge.completedBy.map((u) => u.username));
  const isCompleted = completedSet.has(username);

  return (
    <div
      className={`challenge-card ${isCompleted ? "completed" : ""}`}
      onClick={() => onClick(challenge)}
      title={isCompleted ? "You completed this challenge" : ""}
    >
      <div className="challenge-title gradient-text">{challenge.title}</div>
      <div className="challenge-points">{challenge.points} pts</div>
    </div>
  );
}

// ==================== Challenge Modal ====================
function ChallengeModal({ challenge, onClose, username }) {
  const [flag, setFlag] = useState("");
  const [flagFeedback, setFlagFeedback] = useState("");
  const [flagStatus, setFlagStatus] = useState(""); // "success" | "error"
  const [instanceLink, setInstanceLink] = useState("");
  const [timer, setTimer] = useState(60 * 60); // 1 hour
  const [instanceRunning, setInstanceRunning] = useState(false);
  const [instanceFeedback, setInstanceFeedback] = useState("");
  const timerRef = useRef();

  const userTeam = teams.find((t) => t.users.includes(username));

  // Timer effect
  useEffect(() => {
    if (instanceRunning) {
      timerRef.current = setInterval(
        () => setTimer((prev) => (prev > 0 ? prev - 1 : 0)),
        1000
      );
    }
    return () => clearInterval(timerRef.current);
  }, [instanceRunning]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  };

  // Instance management
  const handleStartInstance = () => {
    if (!username) {
      setInstanceFeedback("You must be logged in to start an instance.");
      return;
    }
    if (!userTeam) {
      setInstanceFeedback("You must be in a team to start an instance.");
      return;
    }
    const randomPort = Math.floor(3000 + Math.random() * 1000);
    setInstanceLink(`https://challenge-instance.com/${challenge.id}:${randomPort}`);
    setInstanceRunning(true);
    setTimer(60 * 60);
    setInstanceFeedback("Instance started! You have 60 minutes.");
  };

  const handleExtendExpiry = () => {
    if (timer / 60 <= 15) {
      setTimer(60 * 60);
      setInstanceFeedback("Expiry extended! You now have 60 minutes.");
    } else {
      setInstanceFeedback("You can extend expiry only when 15 minutes or less are left.");
    }
  };

  const handleStopInstance = () => {
    setInstanceLink("");
    setTimer(0);
    setInstanceRunning(false);
    setInstanceFeedback("Instance stopped.");
  };

  // Flag submission
  const handleSubmitFlag = () => {
    if (!username) {
      setFlagFeedback("You must be logged in to submit a flag.");
      setFlagStatus("error");
      return;
    }
    if (!userTeam) {
      setFlagFeedback("You must be in a team to submit a flag.");
      setFlagStatus("error");
      return;
    }

    if (flag === challenge.flag) {
      if (!challenge.completedBy.some((u) => u.username === username)) {
        challenge.completedBy.push({ username, points: challenge.points });
      }
      setFlagFeedback(`Correct! +${challenge.points} points`);
      setFlagStatus("success");
    } else {
      setFlagFeedback("Red flag! Incorrect, try again!");
      setFlagStatus("error");
    }
    setFlag("");
  };

  const instanceColorClass =
    instanceFeedback.includes("started") || instanceFeedback.includes("extended")
      ? "success"
      : instanceFeedback.includes("cannot") || instanceFeedback.includes("must")
      ? "error"
      : "info";

  return createPortal(
    <div className="challenge-modal-overlay" onClick={onClose}>
      <div className="challenge-modal animate-popup" onClick={(e) => e.stopPropagation()}>
        <h2 className="gradient-text">{challenge.title}</h2>
        <p className="challenge-points"><b>Points:</b> {challenge.points}</p>
        <p className="challenge-description"><b>Description:</b> {challenge.description}</p>

        {/* Hints */}
        {challenge.hints.length > 0 && (
          <div className="challenge-hints">
            <p><b>Hints:</b></p>
            {challenge.hints.map((hint, idx) => (
              <p key={idx} className="hint-text">{hint}</p>
            ))}
          </div>
        )}

        {/* Instance Section */}
        <div className="instance-section">
          {instanceRunning && <h4>Instance Running:</h4>}
          {instanceLink ? (
            <div className="instance-info">
              <p>Time Left: <b>{formatTime(timer)}</b></p>
              <a href={instanceLink} target="_blank" rel="noopener noreferrer" className="instance-link">Go to Instance</a>
              <div className="instance-buttons" style={{ marginTop: "6px" }}>
                <button className="gradient-btn small-btn" onClick={handleExtendExpiry}>Extend Expiry</button>
                <button className="gradient-btn small-btn" style={{ marginLeft: "6px" }} onClick={handleStopInstance}>Stop Instance</button>
              </div>
            </div>
          ) : (
            <button className="gradient-btn" onClick={handleStartInstance}>Start Instance</button>
          )}
          {instanceFeedback && <p className={`feedback-message ${instanceColorClass}`}>{instanceFeedback}</p>}
        </div>

        {/* Flag Submission */}
        <div className="flag-container" style={{ marginTop: "12px" }}>
          <input
            type="text"
            placeholder="Enter flag"
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            className="flag-input"
          />
          <button className="submit-flag gradient-btn" onClick={handleSubmitFlag}>Submit</button>
          {flagFeedback && <p className={`feedback-message ${flagStatus}`}>{flagFeedback}</p>}
        </div>

        {/* Completed Users */}
        <div className="completed-users-section" style={{ marginTop: "12px" }}>
          <h4>Completed by:</h4>
          {challenge.completedBy.length > 0 ? (
            <ul className="completed-users">
              {challenge.completedBy.map((u) => (
                <li key={u.username}>
                  <Link to={`/profile/${u.username}`} className="username-link">
                    {u.username}
                  </Link>{" "}
                  - {u.points} pts
                </li>
              ))}
            </ul>
          ) : (
            <p>No one has completed this yet.</p>
          )}
        </div>

        <button className="submit-flag gradient-btn" style={{ marginTop: "12px" }} onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body
  );
}

// ==================== Main Challenge Page ====================
export default function ChallengePage() {
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [username, setUsername] = useState("");
  const [challenges, setChallenges] = useState({});

  useEffect(() => {
    if (DEMO_MODE) {
      // ===== DEMO MODE =====
      try {
        const storedUser = JSON.parse(localStorage.getItem("loggedInUser"));
        if (storedUser?.username) setUsername(storedUser.username);
      } catch (err) {
        console.warn("Failed to read loggedInUser from localStorage:", err);
      }
      setChallenges(mockChallenges);
    } else {
      // ===== PRODUCTION MODE =====
      (async () => {
        try {
          // Get authenticated user, and also keep track if he has completed the challenge, he cannot submit completed challenge
          const userRes = await fetch("/api/auth/status", {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          if (userRes.ok) {
            const data = await userRes.json();
            if (data?.user?.username) setUsername(data.user.username);
          }

          // Fetch real challenges
          const challRes = await fetch("/api/challenges", {
            method: "GET",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
          });
          if (challRes.ok) {
            const challData = await challRes.json();
            setChallenges(challData);
          }
        } catch (err) {
          console.error("Error fetching data:", err);
        }
      })();
    }
  }, []);

  return (
    <div
      className="challenge-page"
      style={{
        backgroundImage:
          'url("https://www.isep.fr/app/uploads/2024/10/Bandeau-Pourquoi-Integrer-lIsep.jpg")',
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        position: "relative",
        minHeight: "100vh",
      }}
    >
      <div style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", zIndex: 0 }}></div>

      <div className="challenge-container">
        {Object.entries(challenges).map(([category, list]) => (
          <div key={category} className="challenge-section">
            <h2 className="challenge-category gradient-text">{category}</h2>
            <div className="challenge-grid">
              {list.map((ch) => (
                <ChallengeCard
                  key={ch.id}
                  challenge={ch}
                  onClick={setSelectedChallenge}
                  username={username}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {selectedChallenge && (
        <ChallengeModal
          challenge={selectedChallenge}
          onClose={() => setSelectedChallenge(null)}
          username={username}
        />
      )}
    </div>
  );
}
