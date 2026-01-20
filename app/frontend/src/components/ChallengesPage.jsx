// ChallengePage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../config/api";
import { DEMO_MODE } from "../config/demo";
import { createPortal } from "react-dom";

/**
 * Fully featured Challenges page:
 * - tiles grid (CTFd-like)
 * - modal with:
 *   - download
 *   - team-scoped instance: spawn2 / instance / extend / terminate2
 *   - web token link: /challenges/{id}/web-token -> /challenge/i/<token>/
 *   - TCP details: host/port/passphrase
 *   - submit2 (team-aware scoring) + UX messages
 * - solved state:
 *   - user solved: /users/me/solved
 *   - team solved: /teams/me/solved
 */

function fmtTime(seconds) {
  const s = Math.max(0, seconds | 0);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function groupByCategory(list) {
  const out = {};
  for (const ch of list) {
    const cat = ch.category || "Uncategorized";
    out[cat] = out[cat] || [];
    out[cat].push(ch);
  }
  return out;
}

function safeDetail(err, fallback) {
  const d = err?.response?.data?.detail;
  const m = err?.response?.data?.message;
  if (typeof d === "string") return d;
  if (typeof m === "string") return m;
  return fallback;
}

function originBase() {
  // Produces e.g. https://pwndep0t.com
  return window.location.origin;
}

function buildWebUrl(token) {
  // External URL exposed by Traefik rewrite:
  // https://pwndep0t.com/challenge/i/<token>/
  return `${originBase()}/challenge/i/${encodeURIComponent(token)}/`;
}

function ChallengeTile({ ch, solvedByMe, solvedByTeam, locked, onOpen }) {
  const cls = [
    "ctf-tile",
    locked ? "cursor-not-allowed" : "cursor-pointer",
    solvedByMe ? "is-solved" : "",
    solvedByTeam && !solvedByMe ? "is-team-solved" : "",
    locked ? "is-locked" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const title = locked
    ? "Login + team required"
    : solvedByMe
    ? "Already solved by you"
    : solvedByTeam
    ? "Solved by your team (you can still solve for yourself)"
    : "Open challenge";
  
   const handleTileClick = () => {
    onOpen(ch); 
  };

  return (
    <button
      className={cls}
      onClick={handleTileClick}
      disabled={locked}
      title={title}
      type="button"
    >
      <div className="ctf-tile-top">
        <div className="ctf-tile-name">{ch.name}</div>
        <div className="ctf-tile-points">{ch.points} pts</div>
      </div>

      <div className="ctf-tile-sub">
        <span className="ctf-tile-sub-item">
          author: <b>{ch.author || "unknown"}</b>
        </span>
        <span className="ctf-tile-sub-sep">•</span>
        <span className="ctf-tile-sub-item">
          category: <b>{ch.category || "Uncategorized"}</b>
        </span>
      </div>

      <div className="ctf-tile-meta">
        <span className={`chip diff-${(ch.difficulty || "easy").toLowerCase()}`}>
          {ch.difficulty || "easy"}
        </span>

        {ch.is_download ? <span className="chip">download</span> : <span className="chip">instance</span>}

        {solvedByMe && <span className="chip chip-ok">solved</span>}
        {!solvedByMe && solvedByTeam && <span className="chip chip-warn">team solved</span>}
      </div>
    </button>
  );
}

function ModalPortal({ children }) {
  return createPortal(children, document.body);
}

function ChallengeModal({
  ch,
  onClose,
  me,
  team,
  solvedByMe,
  solvedByTeam,
  onSolvedLocally,
  onRefreshSolved,
}) {
  // Flag submission state
  const [flag, setFlag] = useState("");
  const [msg, setMsg] = useState("");
  const [msgKind, setMsgKind] = useState(""); // "success" | "error" | "warn"
  const [busy, setBusy] = useState(false);
  const submitLockRef = useRef(false);
  const lastSubmitOkRef = useRef(false);
  const [canClose,] = useState(true);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  const handleClose = () => {
    onClose();  
  };


  // Instance state
  const [inst, setInst] = useState(null);
  // Pending UX (max 15s after spawn click)
  const [pending, setPending] = useState(false);
  const pendingTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    };
  }, []);
  const [tick, setTick] = useState(0);

  // Web token/link state
  const [webToken, setWebToken] = useState(null);
  const [webUrl, setWebUrl] = useState(null);

  const canUseInstance = !!me && !!team && !ch.is_download;

  // Timer ticker (for TTL countdown)
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /**
   * Poll instance status
   */
  useEffect(() => {
    let stopped = false;

    async function loadStatus() {
      if (!canClose) return;
      if (!canUseInstance) return;
      try {
        const res = await api.get(`/challenges/${ch.id}/instance`);
        if (stopped) return;
        const nextInst = res.data || null;
        setInst(nextInst);
        if (nextInst?.running) {
          setPending(false);
          if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        }
      } catch (e) {
        if (stopped) return;
        if (e?.response?.status === 401) {
          setMsg("Session expired. Please log in again.");
        } else {
          setMsg("Failed to load instance status. Please try again.");
        }
      }
    }

    loadStatus();
    const interval = setInterval(loadStatus, 10000);

    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [ch.id, canUseInstance, canClose]);


  const remainingSeconds = useMemo(() => {
    if (!inst?.expires_at) return null;
    const exp = new Date(inst.expires_at).getTime();
    const now = Date.now();
    return Math.floor((exp - now) / 1000);
  }, [inst, tick]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * Fetch web token when instance is running.
   * - For HTTP challenges we expose https://<domain>/challenge/i/<token>/
   * - For TCP challenges we still can issue token for web proxy if you want,
   *   but typically TCP uses tcp_host/tcp_port.
   */
  async function ensureWebToken() {
    if (!canUseInstance) return;
    if (pending) return;
    if (!inst?.running) return;
    if (webToken && webUrl) return;

    try {
      const res = await api.post(`/challenges/${ch.id}/web-token`, {});
      const token = res.data?.token;
      if (token) {
        setWebToken(token);
        setWebUrl(buildWebUrl(token));
      }
    } catch {
      setMsg("Error generating web token."); // Pokazuje błąd, ale modal nie zostaje zamknięty
    }
  }

  useEffect(() => {
    ensureWebToken();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inst?.running, inst?.expires_at, ch.id, pending]);

  /**
   * Spawn (team scoped)
   * - uses spawn2 only
   * - handles 409 by using returned instance payload
   * - NO fallback to legacy spawn (legacy is not team-scoped and breaks semantics)
   */
  async function spawn() {
    if (!me) {
      setMsgKind("error");
      setMsg("You must be logged in.");
      return;
    }
    if (!team) {
      setMsgKind("error");
      setMsg("You must be in a team to start an instance.");
      return;
    }
    if (solvedByMe) {
      setMsgKind("warn");
      setMsg("You already solved this challenge.");
      return;
    }

    setBusy(true);
    setMsg("");
    setMsgKind("");

    setPending(true);
    if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
    pendingTimerRef.current = setTimeout(() => {
      setPending(false);
    }, 15000);

    try {
      const res = await api.post(`/challenges/${ch.id}/spawn2`, {});
      const payload = res.data?.instance || res.data || null;
      setInst(payload);
      if (payload?.running) {
        setPending(false);
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      }
      setMsgKind("success");
      setMsg(res.data?.message || "Instance started.");
      setWebToken(null);
      setWebUrl(null);
      // best-effort
      setTimeout(() => ensureWebToken(), 250);
    } catch (e) {
      // Handle "already launched" 409 properly
      if (e?.response?.status === 409) {
        const data = e.response.data || {};
        const payload = data.instance || null;
        setInst(payload);
        if (payload?.running) {
          setPending(false);
          if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
        }
        setMsgKind("warn");
        setMsg(data.message || "Instance already launched for your team.");
        setWebToken(null);
        setWebUrl(null);
        setTimeout(() => ensureWebToken(), 250);
      } else {
        const msg2 = safeDetail(e, "Failed to start instance.");
        setMsgKind("error");
        setMsg(msg2);
      }
    } finally {
      setBusy(false);
    }
  }

  async function terminate() {
    setBusy(true);
    setMsg("");
    setMsgKind("");

    try {
      await api.post(`/challenges/${ch.id}/terminate2`, {});
      setInst(null);
      setWebToken(null);
      setWebUrl(null);
      setPending(false);
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current);
      setMsgKind("success");
      setMsg("Instance terminated.");
    } catch (e) {
      const msg2 = safeDetail(e, "Failed to terminate instance.");
      setMsgKind("error");
      setMsg(msg2);
    } finally {
      setBusy(false);
    }
  }

  async function extend() {
    // If user clicks too early, show friendly message (instead of silent return)
    if (remainingSeconds != null && remainingSeconds > 15 * 60) {
      setMsgKind("warn");
      setMsg("Extend is available only when TTL is 15 minutes or less.");
      return;
    }
    if (!canUseInstance) return;

    setBusy(true);
    setMsg("");
    setMsgKind("");

    try {
      const res = await api.post(`/challenges/${ch.id}/extend`, {});
      setInst(res.data?.instance || res.data || inst);
      setMsgKind("success");
      setMsg(res.data?.message || "Instance extended to 60 minutes.");
    } catch (e) {
      const msg2 = safeDetail(e, "Failed to extend instance.");
      setMsgKind("error");
      setMsg(msg2);
    } finally {
      setBusy(false);
    }
  }

  /**
   * Submit flag (team-aware scoring)
   * - uses submit2
   * - after success:
   *   - mark user solved locally
   *   - refresh solved sets (user+team) from backend so tiles stay consistent
   */
  async function submitFlag() {
    // Check if the user is logged in
    if (!me) {
      setMsgKind("error");
      setMsg("You must be logged in to submit a flag.");
      return; // If not logged in, exit the function
    }

    // Check if the user is part of a team
    if (!team) {
      setMsgKind("error");
      setMsg("You must be in a team to submit a flag.");
      return; // If no team, exit the function
    }

    // Check if the flag is not empty
    if (!flag.trim()) {
      setMsgKind("error");
      setMsg("Flag cannot be empty.");
      return; // If the flag is empty, exit the function
    }

    // Check if the user already solved the challenge
    if (solvedByMe) {
      setMsgKind("warn");
      setMsg("Already solved by you.");
      return; // If the challenge is already solved, exit
    }

    console.log("[submitFlag] start", { ch: ch.id, t: Date.now(), flag: flag.trim() });

    // Prevent multiple submissions of the flag at the same time
    if (submitLockRef.current) return;
    submitLockRef.current = true;

    // Set busy state while submitting the flag
    setBusy(true);
    setMsg("");
    setMsgKind("");

    lastSubmitOkRef.current = false;

    try {
      // Submit the flag to the backend
      const res = await api.post(`/challenges/${ch.id}/submit2`, { flag: flag.trim() });
      console.log("[submitFlag] OK", { ch: ch.id, t: Date.now(), data: res.data });

      // Set success message upon successful flag submission
      setMsgKind("success");
      setMsg(res.data?.message || "Correct!");
      lastSubmitOkRef.current = true;

      // After successful submission, mark the challenge as solved locally
      setTimeout(() => {
        if (typeof onSolvedLocally === "function") onSolvedLocally(ch.id);
        if (typeof onRefreshSolved === "function") onRefreshSolved();
        setMsg("");          
        setMsgKind("");
      }, 5000);

    } catch (e) {
      // Handle errors - incorrect flag
      const msg2 = safeDetail(e, "Incorrect flag.");
      console.log("[submitFlag] ERR", { ch: ch.id, t: Date.now(), err: e?.response?.status, data: e?.response?.data });

      const lower = String(msg2 || "").toLowerCase();

      // If the flag was already solved (duplicate flag submission)
      if (lastSubmitOkRef.current) return;

      // Handle case when the challenge was already solved
      if (lower.includes("already completed") || lower.includes("already solved")) {
        setMsgKind("warn");
        setMsg("Already solved by you.");
        return;
      }

      // For other errors, display an error message
      setMsgKind("error");
      setMsg(msg2);
    } finally {
      // Reset the state after the operation is completed
      setBusy(false);
      setFlag(""); // Clear the flag input
      submitLockRef.current = false; // Release the submit lock
    }
  }



  return (
    <ModalPortal>
      <div className="ctf-modal-overlay" onClick={handleClose}>
        <div className="ctf-modal" onClick={(e) => e.stopPropagation()}>
          <div className="ctf-modal-head">
            <div>
              <div className="ctf-kicker">
                <span className="auth-dot" />
                CHALLENGE://{(ch.category || "Uncategorized").toUpperCase()}
              </div>

              <h2 className="ctf-title">{ch.name}</h2>

              <div className="ctf-modal-meta">
                <span>author: <b>{ch.author || "unknown"}</b></span>
                <span className="ctf-modal-meta-sep">•</span>
                <span>category: <b>{ch.category || "Uncategorized"}</b></span>
              </div>

              <div className="ctf-sub">
                <span className="chip">{ch.points} pts</span>
                <span className="chip">{ch.difficulty}</span>
                {ch.is_download ? <span className="chip">download</span> : <span className="chip">instance</span>}
                {solvedByMe && <span className="chip chip-ok">solved</span>}
                {!solvedByMe && solvedByTeam && <span className="chip chip-warn">team solved</span>}
              </div>
            </div>

            <button className="ctf-x" onClick={handleClose} aria-label="Close" type="button">
              ✕
            </button>
          </div>

          <div className="ctf-attention">
            <b>ATTENTION:</b> Instance is <b>per team</b>. Do not share connection details outside your team.
          </div>

          <div className="ctf-body">
            <div className="ctf-block">
              <div className="ctf-block-title">Description</div>
              <div className="ctf-block-text">{ch.description || "—"}</div>
            </div>

            {ch.hint && (
              <div className="ctf-block">
                <div className="ctf-block-title">Hint</div>
                <div className="ctf-block-text">{ch.hint}</div>
              </div>
            )}

            {ch.is_download && (
              <div className="ctf-block">
                <div className="ctf-block-title">Download</div>
                <a className="ctf-link" href={`/api/v1/challenges/${ch.id}/download`} target="_blank" rel="noreferrer">
                  Download attachment
                </a>
              </div>
            )}

            {!ch.is_download && (
              <div className="ctf-block">
                <div className="ctf-block-title">Instance</div>

                {!me || !team ? (
                  <div className="auth-feedback error" style={{ marginTop: 8 }}>
                    Login and join a team to start this challenge instance.
                  </div>
                ) : (
                  <>
                    {inst?.running ? (
                      <div className="ctf-instance">
                        <div className="ctf-row">
                          <span className="label">Status</span>
                          <span className="val ok">{inst.status || "running"}</span>
                        </div>

                        {inst.protocol === "http" && webUrl && (
                          <div className="ctf-row">
                            <span className="label">Web URL</span>
                            <span className="val mono">
                              <a className="ctf-link" href={webUrl} target="_blank" rel="noreferrer">
                                {webUrl}
                              </a>
                            </span>
                          </div>
                        )}
                        {inst.protocol === "tcp" && (
                          <>
                            {inst.tcp_host && (
                              <div className="ctf-row">
                                <span className="label">TCP Host</span>
                                <span className="val mono">{inst.tcp_host}</span>
                              </div>
                            )}
                            {inst.tcp_port && (
                              <div className="ctf-row">
                                <span className="label">TCP Port</span>
                                <span className="val mono">{inst.tcp_port}</span>
                              </div>
                            )}
                            {inst.passphrase && (
                              <div className="ctf-row">
                                <span className="label">Passphrase</span>
                                <span className="val mono">{inst.passphrase}</span>
                              </div>
                            )}
                          </>
                        )}

                        {remainingSeconds != null ? (
                          <div className="ctf-row">
                            <span className="label">TTL</span>
                            <span className={`val mono ${remainingSeconds <= 15 * 60 ? "warn" : ""}`}>
                              {remainingSeconds <= 0 ? "expired" : fmtTime(remainingSeconds)}
                            </span>
                          </div>
                        ) : (
                          <div className="ctf-row">
                            <span className="label">TTL</span>
                            <span className="val mono" style={{ opacity: 0.75 }}>
                              unknown
                            </span>
                          </div>
                        )}

                        <div className="ctf-actions">
                          <button className="auth-submit" onClick={terminate} disabled={busy} type="button">
                            Terminate
                          </button>

                          <button
                            className="auth-submit"
                            onClick={extend}
                            disabled={busy || remainingSeconds == null || remainingSeconds <= 0}
                            title={
                              remainingSeconds == null
                                ? "Extend requires instance status endpoint"
                                : remainingSeconds > 15 * 60
                                ? "Available when TTL <= 15:00"
                                : "Extend to 60 minutes"
                            }
                            type="button"
                          >
                            Extend (60m)
                          </button>
                        </div>

                        <div className="ctf-note">
                          <b>TCP challenges:</b> service may ask for a handshake password. After 3 failed attempts the connection is dropped.
                        </div>
                      </div>
                    ) : pending ? (
                      <div className="ctf-instance">
                        <div className="ctf-row">
                          <span className="label">Status</span>
                          <span className="val warn">pending...</span>
                        </div>

                        <div className="ctf-note">
                          Instance is starting. Connection details will appear when status becomes <b>running</b>.
                        </div>
                      </div>
                    ) : (
                      <div className="ctf-actions">
                        <button className="auth-submit" onClick={spawn} disabled={busy || solvedByMe} type="button">
                          {busy ? "Starting..." : "Start instance"}
                        </button>

                        {solvedByMe && (
                          <div className="auth-feedback warn" style={{ marginTop: 10 }}>
                            You already solved this challenge — instance start is disabled for you.
                          </div>
                        )}

                        {!solvedByMe && solvedByTeam && (
                          <div className="auth-feedback warn" style={{ marginTop: 10 }}>
                            Your team already got points for this challenge. You can still solve it for yourself.
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}


            <div className="ctf-block">
              <div className="ctf-block-title">Submit flag</div>

              {solvedByMe ? (
                <div className="auth-feedback success">Already solved by you. Points were awarded once.</div>
              ) : (
                <>
                  {!me || !team ? (
                    <div className="auth-feedback error">Login and join a team to submit flags.</div>
                  ) : (
                    <div className="ctf-flag">
                      <input
                        className="auth-input"
                        placeholder="flag{...} or xxxxxxxx"
                        value={flag}
                        onChange={(e) => setFlag(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            submitFlag();
                          }
                        }}
                        disabled={busy}
                      />
                      <button className="auth-submit" onClick={submitFlag} disabled={busy} type="button">
                        Submit
                      </button>
                    </div>
                  )}

                  {!solvedByMe && solvedByTeam && (
                    <div className="auth-feedback warn" style={{ marginTop: 10 }}>
                      Team already credited — if you submit correctly, you will still mark this as solved for yourself.
                    </div>
                  )}
                </>
              )}

              {!solvedByMe && msg && <div className={`auth-feedback ${msgKind || "warn"}`}>{msg}</div>}
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}

export default function ChallengePage() {
  const [me, setMe] = useState(null);
  const [team, setTeam] = useState(null);

  const [list, setList] = useState([]);
  const [selected, setSelected] = useState(null);

  const [userSolvedIds, setUserSolvedIds] = useState(new Set());
  const [teamSolvedIds, setTeamSolvedIds] = useState(new Set());

  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const mountedRef = useRef(true);

    useEffect(() => {
      console.log("ChallengePage MOUNT");
      return () => console.log("ChallengePage UNMOUNT");
    }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function loadMe() {
    try {
      const res = await api.get("/users/me");
      const u = res.data || null;

      if (!mountedRef.current) return;

      setMe(u);

      if (u?.team_id) setTeam({ id: u.team_id, name: u.team_name || "team" });
      else setTeam(null);
    } catch {
      if (!mountedRef.current) return;
      setMe(null);
      setTeam(null);
    }
  }

  async function loadChallenges() {
    const res = await api.get("/challenges");
    return Array.isArray(res.data) ? res.data : [];
  }

  async function loadUserSolvedIds() {
    try {
      const res = await api.get("/users/me/solved");
      const ids = Array.isArray(res.data?.solved_ids) ? res.data.solved_ids : [];
      return new Set(ids);
    } catch {
      return new Set();
    }
  }

  async function loadTeamSolvedIds() {
    try {
      const res = await api.get("/teams/me/solved");
      const ids = Array.isArray(res.data?.solved_ids) ? res.data.solved_ids : [];
      return new Set(ids);
    } catch {
      return new Set();
    }
  }

  async function refreshSolvedOnly() {
    try {
      const [uSolved, tSolved] = await Promise.all([loadUserSolvedIds(), loadTeamSolvedIds()]);
      if (!mountedRef.current) return;
      setUserSolvedIds(uSolved);
      setTeamSolvedIds(tSolved);

      
      setList((prev) =>
        prev.map((c) => ({
          ...c,
          _solvedByMe: uSolved.has(c.id),
          _solvedByTeam: tSolved.has(c.id),
        }))
      );

      
      setSelected((prev) => {
        if (prev && uSolved.has(prev.id)) {
          return {
            ...prev,
            _solvedByMe: uSolved.has(prev.id),
            _solvedByTeam: tSolved.has(prev.id),
          };
        }
        return prev; 
      });
    } catch {
      // Ignore
    }
  }

  async function loadAll() {
    setLoading(true);
    setErrorMsg("");

    try {
      await loadMe();

      const [chals, uSolved, tSolved] = await Promise.all([
        loadChallenges(),
        loadUserSolvedIds(),
        loadTeamSolvedIds(),
      ]);

      if (!mountedRef.current) return;

      setUserSolvedIds(uSolved);
      setTeamSolvedIds(tSolved);

      const decorated = chals.map((c) => ({
        ...c,
        _solvedByMe: uSolved.has(c.id),
        _solvedByTeam: tSolved.has(c.id),
      }));

      setList(decorated);

      
      if (selected) {
        setSelected((prev) => {
          if (prev) {
            return {
              ...prev,
              _solvedByMe: uSolved.has(prev.id),
              _solvedByTeam: tSolved.has(prev.id),
            };
          }
          return prev; 
        });
      }
    } catch (e) {
      console.error("ChallengePage load error:", e);
      if (!mountedRef.current) return;
      setErrorMsg("Failed to load challenges. Please try again.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }


  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const s = new Set(list.map((c) => c.category || "Uncategorized"));
    return ["all", ...Array.from(s).sort()];
  }, [list]);

  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return list
      .filter((c) => (cat === "all" ? true : (c.category || "Uncategorized") === cat))
      .filter((c) => {
        if (!qq) return true;
        return (c.name || "").toLowerCase().includes(qq) || (c.description || "").toLowerCase().includes(qq);
      });
  }, [list, q, cat]);

  const byCat = useMemo(() => groupByCategory(filtered), [filtered]);

  function markSolvedLocally(challengeId) {
    // user solved locally
    setUserSolvedIds((prev) => {
      const next = new Set(prev);
      next.add(challengeId);
      return next;
    });

    setList((prev) =>
      prev.map((c) => (c.id === challengeId ? { ...c, _solvedByMe: true } : c))
    );

    setSelected((prev) => (prev?.id === challengeId ? { ...prev, _solvedByMe: true } : prev));
  }

  return (
    <section className="relative w-screen left-1/2 -translate-x-1/2 overflow-hidden min-h-screen -mt-24 pt-24 pb-10">
      <div className="absolute inset-0 z-0">
        <div
          className="absolute inset-0 opacity-55"
          style={{
            backgroundImage:
              "url('https://images-wixmp-ed30a86b8c4ca887773594c2.wixmp.com/f/746d5571-d784-4094-a24d-a3bdbc7e1013/dfoij5k-96c3f665-b433-47ad-a2e0-51c5b50bde53.png/v1/fill/w_1280,h_720,q_80,strp/matrix_code_in_blue_by_wuksoy_dfoij5k-fullview.jpg')",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,10,7,0.12)_0%,rgba(5,10,7,0.55)_55%,rgba(5,10,7,0.90)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-500/12 via-[#050a07]/50 to-[#050a07]/82" />
        <div className="absolute inset-0 bg-[#050a07]/30" />
        <div
          className="absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(110,255,190,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(110,255,190,0.14) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay pointer-events-none"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(255,255,255,0.10) 0px, rgba(255,255,255,0.10) 1px, transparent 3px, transparent 6px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_30%,rgba(0,0,0,0.30)_65%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
        <div className="ctf-shell">
          <div className="ctf-headbar">
            <div>
              <div className="ctf-kicker">
                <span className="auth-dot" />
                SECURE://PWN-DEPOT • CHALLENGES
              </div>

              <div className="ctf-page-title">Challenges</div>

              <div className="ctf-page-sub">
                {me ? (
                  <>
                    logged in as <span className="mono">{me.username}</span>
                    {team ? (
                      <>
                        {" "}
                        • team <span className="mono">{team.name}</span>
                      </>
                    ) : (
                      <>
                        {" "}
                        • <span style={{ opacity: 0.8 }}>no team</span>
                      </>
                    )}
                  </>
                ) : (
                  <>not logged in</>
                )}
              </div>

              {(!me || !team) && (
                <div className="auth-feedback warn" style={{ marginTop: 10 }}>
                  Login and join a team to start instances and submit flags.
                </div>
              )}
            </div>

            <div className="ctf-controls">
              <input className="auth-input" placeholder="search..." value={q} onChange={(e) => setQ(e.target.value)} />

              <select className="auth-input" value={cat} onChange={(e) => setCat(e.target.value)}>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button className="auth-submit" onClick={loadAll} disabled={loading} type="button">
                {loading ? "Loading..." : "Refresh"}
              </button>
            </div>
          </div>

          {errorMsg && <div className="auth-feedback error">{errorMsg}</div>}
          {!errorMsg && loading && <div className="auth-feedback warn">Fetching latest challenges...</div>}

          {Object.entries(byCat).map(([categoryName, items]) => (
            <div key={categoryName} className="ctf-section">
              <div className="ctf-section-title">{categoryName}</div>

              <div className="ctf-grid">
                {items.map((ch) => {
                  const solvedByMe = userSolvedIds.has(ch.id);
                  const solvedByTeam = teamSolvedIds.has(ch.id);
                  const locked = !me || !team;

                  return (
                    <ChallengeTile
                      key={ch.id}
                      ch={ch}
                      solvedByMe={solvedByMe}
                      solvedByTeam={solvedByTeam}
                      locked={locked}
                      onOpen={(c) => setSelected(c)}
                    />
                  );
                })}
              </div>
            </div>
          ))}

          {!loading && !errorMsg && filtered.length === 0 && (
            <div className="auth-feedback warn" style={{ marginTop: 12 }}>
              No challenges found for the current filters.
            </div>
          )}

          {!errorMsg && (
            <div style={{ marginTop: 14, opacity: 0.8 }}>
              <span className="mono">
                total: {list.length} • visible: {filtered.length} • solved (you): {userSolvedIds.size} • solved (team):{" "}
                {teamSolvedIds.size}
              </span>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <ChallengeModal
          key={selected.id}
          ch={selected}
          onClose={() => setSelected(null)}
          me={me}
          team={team}
          solvedByMe={userSolvedIds.has(selected.id)}
          solvedByTeam={teamSolvedIds.has(selected.id)}
          onSolvedLocally={markSolvedLocally}
          onRefreshSolved={refreshSolvedOnly}
        />
      )}
    </section>
  );
}
