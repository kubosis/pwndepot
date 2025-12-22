import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { api } from "../config/api"; // Ensure this is configured for axios
import { DEMO_MODE } from "../config/demo";

// ==================== Icons ====================
const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

const StopIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: "4px" }}>
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

// ==================== Challenge Card ====================
function ChallengeCard({ challenge, onClick, userSolvedIds = [] }) {
  // If userSolvedIds contains this challenge ID, mark as completed
  const isCompleted = userSolvedIds.includes(challenge.id);

  return (
    <div
      className={`challenge-card ${isCompleted ? "completed" : ""}`}
      onClick={() => onClick(challenge)}
      title={isCompleted ? "You completed this challenge" : ""}
    >
      <div className="card-header">
        <div className="challenge-title gradient-text">{challenge.name}</div>
        <div className="challenge-icon">
            {challenge.is_download ? <DownloadIcon /> : <PlayIcon />}
        </div>
      </div>
      <div className="challenge-points">{challenge.points} pts</div>
    </div>
  );
}

// ==================== Challenge Modal ====================
function ChallengeModal({ challenge, onClose, username }) {
  const [flag, setFlag] = useState("");
  const [feedback, setFeedback] = useState({ msg: "", type: "" });

  // Container State
  const [instance, setInstance] = useState(null); // { host, port, remaining_seconds }
  const [isLoading, setIsLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef(null);

  // 1. Check if instance is already running when modal opens
  useEffect(() => {
    if (!challenge.is_download && !DEMO_MODE) {
      checkInstanceStatus();
    }
  }, [challenge.id]);

  // 2. Timer Countdown Logic
  useEffect(() => {
    if (instance && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
             clearInterval(timerRef.current);
             checkInstanceStatus(); // Sync with backend on expiry
             return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [instance, timeLeft]);

  const checkInstanceStatus = useCallback(async () => {
    try {
      const res = await api.get(`/challenges/${challenge.id}/instance`);
      if (res.data.is_running && res.data.connection) {
        setInstance(res.data.connection);
        setTimeLeft(res.data.connection.remaining_seconds);
      } else {
        setInstance(null);
      }
    } catch (_err) {
      console.error("Failed to check instance", _err);
    }
  }, [challenge.id]);

  const handleSpawn = async () => {
    setIsLoading(true);
    setFeedback({ msg: "", type: "" });
    try {
      const res = await api.post(`/challenges/${challenge.id}/spawn`);
      setInstance(res.data);
      setTimeLeft(res.data.remaining_seconds);

      // TODO: Auto-redirect immediately if desired
      // const url = `http://${res.data.host}:${res.data.port}`;
      // window.open(url, '_blank');

    } catch (_err) {
      setFeedback({ msg: err.response?.data?.detail || "Failed to spawn instance", type: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTerminate = async () => {
    setIsLoading(true);
    try {
      await api.post(`/challenges/${challenge.id}/terminate`);
      setInstance(null);
      setTimeLeft(0);
    } catch (_err) {
      console.error("Failed to stop", _err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      // Direct browser navigation to download endpoint
      // Using window.open triggers the download in a new tab (which immediately closes)
      const downloadUrl = `${api.defaults.baseURL || "/api/v1"}/challenges/${challenge.id}/download`;
      window.open(downloadUrl, "_blank");
    } catch (_err) {
      setFeedback({ msg: "Download failed.", type: "error" });
    }
  };

  const handleSubmitFlag = async () => {
    if (!username) {
        setFeedback({ msg: "Login required.", type: "error" });
        return;
    }
    try {
      const res = await api.post(`/challenges/${challenge.id}/submit`, { flag });
      setFeedback({ msg: res.data.message || "Correct!", type: "success" });
    } catch (_err) {
      setFeedback({ msg: err.response?.data?.detail || "Incorrect Flag", type: "error" });
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Construct connection URL
  const connectionUrl = instance ? `http://${instance.host}:${instance.port}` : "#";

  return createPortal(
    <div className="challenge-modal-overlay" onClick={onClose}>
      <div className="challenge-modal animate-popup" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
            <h2 className="gradient-text">{challenge.name}</h2>
            <span className="badge difficulty-badge">{challenge.difficulty}</span>
        </div>

        <p className="challenge-description">{challenge.description}</p>

        {challenge.hint && (
            <div className="challenge-hint">
                <strong>Hint:</strong> {challenge.hint}
            </div>
        )}

        {/* --- DYNAMIC ACTION SECTION --- */}
        <div className="action-section">
            {challenge.is_download ? (
                // === DOWNLOADABLE CHALLENGE ===
                <button className="gradient-btn action-btn" onClick={handleDownload}>
                    <DownloadIcon /> Download Files
                </button>
            ) : (
                // === CONTAINER CHALLENGE ===
                <div className="container-controls">
                    {!instance ? (
                        <button
                            className="gradient-btn action-btn"
                            onClick={handleSpawn}
                            disabled={isLoading}
                        >
                            {isLoading ? "Spawning..." : <><PlayIcon /> Start Instance</>}
                        </button>
                    ) : (
                        <div className="instance-active-panel">
                            <div className="timer-display">
                                Time Left: <span>{formatTime(timeLeft)}</span>
                            </div>

                            <div className="instance-actions">
                                <a
                                    href={connectionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="gradient-btn link-btn"
                                >
                                    Open Challenge <ExternalLinkIcon />
                                </a>

                                <button
                                    className="stop-btn"
                                    onClick={handleTerminate}
                                    disabled={isLoading}
                                    title="Stop Instance"
                                >
                                    <StopIcon />
                                </button>
                            </div>
                            <div className="connection-details">
                                Host: {instance.host} <br/> Port: {instance.port}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>

        {/* --- FLAG SUBMISSION --- */}
        <div className="flag-section">
          <input
            type="text"
            placeholder="CTF{...}"
            value={flag}
            onChange={(e) => setFlag(e.target.value)}
            className="flag-input"
          />
          <button className="gradient-btn" onClick={handleSubmitFlag}>Submit Flag</button>
        </div>

        {feedback.msg && (
            <p className={`feedback-message ${feedback.type}`}>{feedback.msg}</p>
        )}

        <button className="close-btn-text" onClick={onClose}>Close</button>
      </div>
    </div>,
    document.body
  );
}

// ==================== Main Page ====================
export default function ChallengesPage() {
  const [challenges, setChallenges] = useState({}); // Grouped by Difficulty
  const [selectedChallenge, setSelectedChallenge] = useState(null);
  const [username, setUsername] = useState("");
  const [userSolvedIds, setUserSolvedIds] = useState([]); // Array of IDs user has solved

  useEffect(() => {
    loadData();
  }, [loadData]);

  const loadData = async () => {
    if (DEMO_MODE) {
       // ... (Keep existing mock logic if needed)
       return;
    }

    try {
        // 1. Get User Profile (to know username and completed challenges)
        const userRes = await api.get("/users/me");
        setUsername(userRes.data.username);
        // Assuming userRes.data.solved_challenges is an array of objects or IDs
        // If backend returns list of challenge objects, map to IDs:
        const solved = userRes.data.solved_challenges?.map(c => c.id || c) || [];
        setUserSolvedIds(solved);

        // 2. Get All Challenges
        const chalRes = await api.get("/challenges");

        // 3. Group by Difficulty (since 'category' field is missing in schema)
        const grouped = chalRes.data.reduce((acc, curr) => {
            const group = curr.difficulty || "Misc";
            if (!acc[group]) acc[group] = [];
            acc[group].push(curr);
            return acc;
        }, {});

        setChallenges(grouped);

    } catch (_err) {
        console.error("Failed to load challenges", _err);
    }
  };

  return (
    <div className="challenges-page-container">
      <div className="challenges-header">
        <h1>Challenges</h1>
        <p>Select a challenge to begin.</p>
      </div>

      <div className="challenges-grid-wrapper">
        {Object.keys(challenges).length === 0 ? (
            <p className="no-data">Loading challenges...</p>
        ) : (
            Object.entries(challenges).map(([difficulty, list]) => (
            <div key={difficulty} className="challenge-section">
                <h2 className="section-title">{difficulty}</h2>
                <div className="challenge-grid">
                {list.map((ch) => (
                    <ChallengeCard
                        key={ch.id}
                        challenge={ch}
                        onClick={setSelectedChallenge}
                        userSolvedIds={userSolvedIds}
                    />
                ))}
                </div>
            </div>
            ))
        )}
      </div>

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