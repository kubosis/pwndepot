## Challenges & Rankings
# PREFIX: /api/v1/challenges/
# - *GET  /api/v1/challenges* – list all available challenges
# - *POST /api/v1/challenges/{id}/submit* – submit a flag
#  - Validates the flag for correctness
# - *GET  /api/v1/rankings* – retrieve sorted scoreboard (rank, team name, finalScore, optional tie-breakers)

import os
from datetime import datetime, timedelta, timezone

import fastapi
import httpx
from fastapi import HTTPException, Request, Response, status
from fastapi.responses import FileResponse, JSONResponse
from loguru import logger
from starlette.background import BackgroundTask

from app.backend.api.v1.deps import ChallengesRepositoryDep, CurrentUserDep, TeamsRepositoryDep
from app.backend.config.settings import get_settings
from app.backend.db.models import ChallengeTable
from app.backend.schema.challenges import ChallengeInResponse, FlagSubmission
from app.backend.schema.teams import TeamWithScoresInResponse
from app.backend.utils.flag_store import TeamFlagStore
from app.backend.utils.instance_limiter import InstanceLimiter
from app.backend.utils.instance_token_store import InstanceTokenStore
from app.backend.utils.k8s_manager import K8sChallengeManager, K8sTeamChallengeManager
from app.backend.utils.limiter import limiter
from app.backend.utils.team_instance_store import TeamInstanceStore

settings = get_settings()

router = fastapi.APIRouter(tags=["challenges"])


def _construct_challenge_response(challenge: ChallengeTable) -> ChallengeInResponse:
    return ChallengeInResponse(
        id=challenge.id,
        name=challenge.name,
        category=(getattr(challenge, "category", None) or "Uncategorized"),
        author=(getattr(challenge, "author", None) or "unknown"),
        description=challenge.description,
        hint=challenge.hint,
        is_download=challenge.is_download,
        difficulty=getattr(challenge.difficulty, "value", str(challenge.difficulty)),
        points=challenge.points,
        created_at=challenge.created_at,
        protocol=(challenge.protocol.value if hasattr(challenge, "protocol") and challenge.protocol else "http"),
        expose_tcp=bool(getattr(challenge, "expose_tcp", False)),
    )


def parse_iso_utc(s: str) -> datetime:
    dt = datetime.fromisoformat(s)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


## we decided to go with team-scoped instances only
@router.post("/{challenge_id}/spawn", status_code=status.HTTP_201_CREATED)
@limiter.limit("2/minute")
@limiter.limit("10/hour")
async def spawn_challenge(
    request: Request, challenge_id: int, current_user: CurrentUserDep, challenge_repo: ChallengesRepositoryDep
):
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch or ch.is_download:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Challenge not found or not deployable")

    image_name = ch.image_name
    target_port = ch.internal_port

    k8s_manager = K8sChallengeManager()
    connection_info = await k8s_manager.spawn_instance(
        user_id=current_user.id, challenge_id=ch.id, image=image_name, port=target_port, ttl_seconds=3600
    )

    if not connection_info:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Failed to spawn instance")

    # schedule server-side termination as fallback
    try:
        k8s_manager.schedule_termination(current_user.id, ch.id, ttl_seconds=settings.CHALLENGE_K8S_POD_TTL_SECONDS)
    except Exception as e:
        logger.error(f"Failed to schedule termination for {connection_info}: {e}")

    return {"message": "Challenge spawned", "connection": connection_info}


@router.post("/{challenge_id}/terminate", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def terminate_challenge(request: Request, challenge_id: int, current_user: CurrentUserDep):
    # k8sManager is a singleton - it does not get reinitialized here
    k8s_manager = K8sChallengeManager()
    k8s_manager.terminate_instance(current_user.id, challenge_id)
    return {"message": "Instance terminated"}


## Ill leave it but decided to for web with traefik proxying
@router.api_route(
    "/{challenge_id}/proxy/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"]
)
@limiter.limit("300/minute")
async def proxy_to_challenge(
    request: Request,
    challenge_id: int,
    path: str,
    current_user: CurrentUserDep,  # Authentication required
    challenge_repo: ChallengesRepositoryDep,
):
    """
    Proxies all traffic from user -> backend -> k8s_pod
    """
    # 1. Verify user has spawned this challenge
    # (Optional: Check DB or K8s if the pod exists to save overhead)

    # 2. Get Challenge Details (to know the internal port)
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(404, "Challenge not found")

    target_port = getattr(ch, "internal_port", 80)

    # 3. Construct Internal K8s URL
    # Format: http://<service_name>.<namespace>:<port>/<path>
    k8s_manager = K8sChallengeManager()
    service_name = k8s_manager.get_pod_name(current_user.id, challenge_id)
    namespace = k8s_manager.namespace  # e.g., 'ctf-challenges'

    # Example: http://chal-u1-c5.ctf-challenges.svc.cluster.local:80/admin.php
    url = f"http://{service_name}.{namespace}.svc.cluster.local:{target_port}/{path}"

    # 4. Forward the Request using HTTPX
    # We strip the /proxy prefix from the URL, but keep query params
    query_params = dict(request.query_params)

    async with httpx.AsyncClient() as client:
        try:
            # We forward the body, headers, and method
            # NOTE: We filter headers to avoid conflicts (like Host)
            req_headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]}

            # Simple streaming proxy
            rp_req = client.build_request(
                request.method, url, headers=req_headers, params=query_params, content=request.stream()
            )

            rp_resp = await client.send(rp_req, stream=True)

            # 5. Return the Response
            return Response(
                content=await rp_resp.aread(),  # For large files, use StreamingResponse instead
                status_code=rp_resp.status_code,
                headers=rp_resp.headers,
                background=BackgroundTask(rp_resp.aclose),
            )

        except httpx.ConnectError:
            raise HTTPException(502, "Challenge is starting or unreachable. Try again in a few seconds.") from None
        except Exception as e:
            logger.error(f"Proxy error: {e}")
            raise HTTPException(500, "Proxy error") from None


@router.post("/{challenge_id}/web-token", status_code=status.HTTP_200_OK)
async def issue_web_token(
    challenge_id: int,
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(status_code=400, detail="You must be in a team.")

    store = TeamInstanceStore()
    inst = await store.get(team.id, challenge_id)
    if not inst or inst.get("status") != "running" or not inst.get("connection"):
        raise HTTPException(status_code=400, detail="Instance not running.")

    token_store = InstanceTokenStore()
    token = token_store.new_token()

    # TTL = remaining seconds (aligned with instance expiry)
    try:
        exp = parse_iso_utc(inst["expires_at"])
    except Exception as err:
        raise HTTPException(status_code=500, detail="Instance expiry invalid.") from err

    now = datetime.now(timezone.utc)
    ttl = max(30, int((exp - now).total_seconds()))
    if ttl <= 0:
        raise HTTPException(status_code=400, detail="Instance already expired.")

    await token_store.set_mapping(
        token,
        team_id=team.id,
        challenge_id=challenge_id,
        ttl_seconds=ttl,
        tcp=False,
    )

    return {"token": token, "expires_at": inst["expires_at"]}


@router.api_route(
    "/i/{token}/{path:path}",
    methods=["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"],
)
@limiter.limit("300/minute")
async def proxy_by_token(
    request: Request,
    token: str,
    path: str,
    challenge_repo: ChallengesRepositoryDep,
):
    token_store = InstanceTokenStore()
    mapping = await token_store.get_mapping(token, tcp=False)
    if not mapping:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    team_id = int(mapping["team_id"])
    challenge_id = int(mapping["challenge_id"])

    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    k8s = K8sTeamChallengeManager()
    service_name = k8s.get_pod_name(team_id, challenge_id)
    namespace = k8s.namespace
    target_port = getattr(ch, "internal_port", 80)

    url = f"http://{service_name}.{namespace}.svc.cluster.local:{target_port}/{path}"
    query_params = dict(request.query_params)

    async with httpx.AsyncClient(follow_redirects=False) as client:
        req_headers = {k: v for k, v in request.headers.items() if k.lower() not in ["host", "content-length"]}

        rp_req = client.build_request(
            request.method,
            url,
            headers=req_headers,
            params=query_params,
            content=request.stream(),
        )

        rp_resp = await client.send(rp_req, stream=True)

        return Response(
            content=await rp_resp.aread(),
            status_code=rp_resp.status_code,
            headers=rp_resp.headers,
            background=BackgroundTask(rp_resp.aclose),
        )


@router.get("", response_model=list[ChallengeInResponse], status_code=status.HTTP_200_OK)
async def list_challenges(challenge_repo: ChallengesRepositoryDep):
    db_chals = await challenge_repo.list_challenges()
    return [_construct_challenge_response(c) for c in db_chals]


def _enrich_team(team: TeamWithScoresInResponse):
    scores = team.scores

    if not scores:
        final_score = 0
        total_points = 0
        first_reached_time = None
    else:
        final_score = scores[-1]["score"]
        total_points = scores[-1]["score"]

        first_reached_time = next(
            (s["date_time"] for s in scores if s["score"] == final_score),
            scores[0]["date_time"],
        )

    return {
        "team": team,
        "final_score": final_score,
        "total_points": total_points,
        "first_reached_time": first_reached_time,
    }


@router.get(
    "/rankings",
    response_model=list[TeamWithScoresInResponse],
    status_code=status.HTTP_200_OK,
)
async def get_rankings(team_repo: TeamsRepositoryDep):
    teams = await team_repo.list_all_teams()
    response: list[TeamWithScoresInResponse] = []

    for t in teams:
        scores = await team_repo.get_team_scores(t.id)
        score_records = []
        total = 0

        for s in scores:
            username = getattr(s.user, "username", "")
            points = int(getattr(s.challenge, "points", 0) or 0)
            cat = getattr(s.challenge, "category", None) or "Uncategorized"

            score_records.append(
                {
                    "date_time": s.completed_at,
                    "obtained_by": username,
                    "score": points,
                    "challenge_category": cat,
                }
            )
            total += points

        # 1. sort chronologically for tie breaking
        score_records.sort(key=lambda x: x["date_time"])

        response.append(
            TeamWithScoresInResponse(
                team_id=t.id,
                team_name=t.name,
                scores=score_records,
                total_score=total,
            )
        )

    enriched = [_enrich_team(t) for t in response]

    enriched.sort(
        key=lambda x: (
            -x["final_score"],  # finalScore DESC
            -x["total_points"],  # totalPoints DESC
            x["first_reached_time"],  # firstReachedTime ASC
        )
    )

    # return the list of TeamWithScoresInResponse as expected
    return [x["team"] for x in enriched]


@router.get("/{challenge_id}", response_model=ChallengeInResponse, status_code=status.HTTP_200_OK)
async def get_challenge_by_id(challenge_id: int, challenge_repo: ChallengesRepositoryDep):
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")
    return _construct_challenge_response(ch)


@router.post("/{challenge_id}/submit", response_model=dict, status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
@limiter.limit("50/hour")
async def submit_flag(
    request: Request,
    challenge_id: int,
    submission: FlagSubmission,
    current_user: CurrentUserDep,
    challenge_repo: ChallengesRepositoryDep,
    team_repo: TeamsRepositoryDep,
):
    # user must be in a team to submit
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="You must be in a team to submit a flag.")

    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    already = await challenge_repo.has_user_completed(current_user.id, challenge_id)
    if already:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Challenge already completed")

    valid = await challenge_repo.validate_flag(ch, submission.flag)
    if not valid:
        logger.info(f"Wrong flag submitted by user={current_user.username} for challenge={challenge_id}")
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Incorrect flag")

    # record completion
    completion = await challenge_repo.record_completion(current_user.id, challenge_id)
    if not completion:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Failed to record completion")

    logger.info(f"User {current_user.username} solved challenge {ch.name}")
    return {"message": f"Correct! +{ch.points} points"}


# ==========================================
# DOWNLOADABLE CHALLENGE ENDPOINT
# ==========================================
@router.get("/{challenge_id}/download", response_class=FileResponse)
async def download_challenge_file(
    challenge_id: int,
    current_user: CurrentUserDep,  # Access Control: Must be logged in
    challenge_repo: ChallengesRepositoryDep,
):
    """
    Serves the file if the challenge is marked as 'is_download'.
    """
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Challenge not found")

    if not ch.is_download:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This challenge is not a downloadable file.")

    # Security check: Validate path exists and is safe
    file_path = ch.path

    if not os.path.exists(file_path):
        logger.error(f"Challenge file missing at {file_path}")
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "Challenge file missing on server.")

    filename = os.path.basename(file_path)

    # Setting the content-disposition header to force download
    headers = {
        "Content-Disposition": f"attachment; filename={filename}",
    }

    return FileResponse(path=file_path, filename=filename, media_type="application/octet-stream", headers=headers)


@router.get("/{challenge_id}/instance", status_code=status.HTTP_200_OK)
async def get_instance_status(
    challenge_id: int,
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    """
    Returns team-scoped instance status for the current user's team.
    Frontend uses this for: TTL timer + 'already launched' message.
    """
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(status_code=400, detail="You must be in a team.")

    store = TeamInstanceStore()
    inst = await store.get(team.id, challenge_id)
    if not inst:
        raise HTTPException(status_code=404, detail="No active instance.")

    # Basic derived fields for UI
    now = datetime.now(timezone.utc)
    try:
        exp = parse_iso_utc(inst["expires_at"])
        remaining = int((exp - now).total_seconds())
    except Exception:
        remaining = None

    return {
        "running": inst.get("status") == "running",
        "status": inst.get("status"),
        "protocol": inst.get("protocol"),
        "connection": inst.get("connection"),
        "tcp_host": inst.get("tcp_host"),
        "tcp_port": inst.get("tcp_port"),
        "passphrase": inst.get("passphrase"),
        "started_at": inst.get("started_at"),
        "expires_at": inst.get("expires_at"),
        "remaining_seconds": remaining,
    }


@router.post("/{challenge_id}/spawn2", status_code=status.HTTP_201_CREATED)
@limiter.limit("2/minute")
@limiter.limit("10/hour")
async def spawn_challenge_team_scoped(
    request: Request,
    challenge_id: int,
    current_user: CurrentUserDep,
    challenge_repo: ChallengesRepositoryDep,
    team_repo: TeamsRepositoryDep,
):
    """
    Team-scoped spawn:
    - Requires team
    - If an instance is already running for this team+challenge -> 409 with instance info
    - Stores instance metadata in Redis for accurate UI TTL/timer
    """
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(status_code=400, detail="You must be in a team to start an instance.")

    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch or ch.is_download:
        raise HTTPException(status_code=404, detail="Challenge not found or not deployable.")

    ttl_seconds = int(getattr(settings, "CHALLENGE_K8S_POD_TTL_SECONDS", 3600))

    store = TeamInstanceStore()

    # =====================================================
    # ATOMIC CLAIM (ONLY THE FIRST CALLER WINS)
    # =====================================================
    claimed, payload = await store.claim_or_get(
        team.id,
        challenge_id,
        ttl_seconds=ttl_seconds,
    )

    if not claimed:
        return JSONResponse(
            status_code=409,
            content={
                "message": "Instance already launched for your team.",
                "instance": {
                    "running": True,
                    "connection": payload.get("connection"),
                    "started_at": payload.get("started_at"),
                    "expires_at": payload.get("expires_at"),
                    "status": payload.get("status"),
                    "protocol": payload.get("protocol"),
                    "tcp_host": payload.get("tcp_host"),
                    "tcp_port": payload.get("tcp_port"),
                    "passphrase": payload.get("passphrase"),
                },
            },
        )

    # =====================================================
    # LIMITER OF ACTIVE INSTANCES
    # =====================================================
    limiter = InstanceLimiter()

    try:
        ok = await limiter.try_acquire(
            team_id=team.id,
            challenge_id=challenge_id,
            ttl_seconds=ttl_seconds,
            limit=int(getattr(settings, "MAX_ACTIVE_INSTANCES", 50)),
        )
        if not ok:
            # we back up claim
            await store.delete(team.id, challenge_id)
            raise HTTPException(
                status_code=429,
                detail="Too many active instances right now. Try again later.",
            )

        # =================================================
        # SPAWN K8S (TEAM-SCOPED)
        # =================================================
        k8s = K8sTeamChallengeManager()
        proto = ch.protocol.value if getattr(ch, "protocol", None) else "http"
        result = await k8s.spawn_instance(
            team_id=team.id,
            challenge_id=challenge_id,
            image=ch.image_name,
            port=ch.internal_port,
            ttl_seconds=ttl_seconds,
            protocol=proto,
        )

        if not result:
            raise RuntimeError("K8s spawn failed")

        # =================================================
        # FILL IN THE PLACEHOLDER
        # =================================================
        payload = await store.set(
            team.id,
            challenge_id,
            ttl_seconds=ttl_seconds,
            connection=result.get("connection_internal"),
            protocol=result.get("protocol"),
            tcp_host=result.get("tcp_host"),
            tcp_port=result.get("tcp_port"),
            passphrase=result.get("passphrase"),
        )
        if not payload:
            raise RuntimeError("Redis placeholder missing after claim (unexpected)")

        return {
            "message": "Instance started.",
            "instance": {
                "running": True,
                "status": payload.get("status", "running"),
                "protocol": payload.get("protocol"),
                "connection": payload.get("connection"),
                "tcp_host": payload.get("tcp_host"),
                "tcp_port": payload.get("tcp_port"),
                "passphrase": payload.get("passphrase"),
                "started_at": payload.get("started_at"),
                "expires_at": payload.get("expires_at"),
            },
        }

    except Exception:
        # Spawn failed - cleanup
        await store.delete(team.id, challenge_id)
        await limiter.release(team_id=team.id, challenge_id=challenge_id)
        raise


@router.post("/{challenge_id}/extend", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def extend_instance_team_scoped(
    request: Request,
    challenge_id: int,
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
    challenge_repo: ChallengesRepositoryDep,
):
    """
    Hotfix: extend = restart instance.
    - Allowed only when remaining <= 15 minutes.
    - Terminates pod/service and spawns fresh one with new ttl_seconds.
    - Updates Redis metadata and limiter slot.
    """
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(status_code=400, detail="You must be in a team.")

    store = TeamInstanceStore()
    inst = await store.get(team.id, challenge_id)
    if not inst:
        raise HTTPException(status_code=404, detail="No active instance to extend.")

    # Must be running
    if inst.get("status") != "running":
        raise HTTPException(status_code=400, detail="Instance is not running.")

    # Remaining time check
    now = datetime.now(timezone.utc)
    try:
        exp = parse_iso_utc(inst["expires_at"])
        remaining = int((exp - now).total_seconds())
    except Exception as err:
        raise HTTPException(status_code=500, detail="Instance expiry invalid.") from err

    if remaining <= 0:
        raise HTTPException(status_code=400, detail="Instance already expired.")
    if remaining > 15 * 60:
        raise HTTPException(status_code=400, detail="Extend is available only when TTL <= 15 minutes.")

    # New TTL (60 minutes from now)
    new_ttl = 60 * 60

    # Need challenge details to respawn
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch or ch.is_download:
        raise HTTPException(status_code=404, detail="Challenge not found or not deployable.")

    proto = ch.protocol.value if getattr(ch, "protocol", None) else "http"

    k8s = K8sTeamChallengeManager()

    # ---- RESTART FLOW ----
    # 1) terminate current (best-effort)
    try:
        await k8s.terminate_instance(team.id, challenge_id)
    except Exception:
        # don't hard fail; we will try to spawn anyway
        logger.warning("terminate_instance() failed during extend; continuing best-effort.")

    # 2) spawn fresh with new ttl
    result = await k8s.spawn_instance(
        team_id=team.id,
        challenge_id=challenge_id,
        image=ch.image_name,
        port=ch.internal_port,
        ttl_seconds=new_ttl,
        protocol=proto,
    )
    if not result:
        # IMPORTANT: instance is now down; reflect that in redis to avoid stale UI
        await store.delete(team.id, challenge_id)
        raise HTTPException(status_code=500, detail="Failed to restart instance during extend.")

    # 3) Update redis metadata (connection/protocol/tcp stuff + new expires)
    updated = await store.set(
        team.id,
        challenge_id,
        ttl_seconds=new_ttl,
        connection=result.get("connection_internal"),
        protocol=result.get("protocol"),
        tcp_host=result.get("tcp_host"),
        tcp_port=result.get("tcp_port"),
        passphrase=result.get("passphrase"),
    )
    if not updated:
        # If placeholder missing, fallback: recreate state (safe)
        now2 = datetime.now(timezone.utc)
        exp2 = now2 + timedelta(seconds=new_ttl)
        payload = {
            "team_id": team.id,
            "challenge_id": challenge_id,
            "connection": result.get("connection_internal"),
            "started_at": now2.isoformat(),
            "expires_at": exp2.isoformat(),
            "status": "running",
            "protocol": result.get("protocol"),
            "tcp_host": result.get("tcp_host"),
            "tcp_port": result.get("tcp_port"),
            "passphrase": result.get("passphrase"),
        }
        await store.force_set(team.id, challenge_id, payload, ttl_seconds=new_ttl)
        updated = payload

    # 4) Extend limiter slot too (so capacity accounting matches)
    limiter = InstanceLimiter()
    ok2 = await limiter.extend(team_id=team.id, challenge_id=challenge_id, ttl_seconds=new_ttl)
    if not ok2:
        logger.warning("InstanceLimiter.extend() failed or slot missing during extend().")

    return {
        "message": "Instance restarted and extended to 60 minutes.",
        "instance": {
            "running": True,
            "status": updated.get("status", "running"),
            "protocol": updated.get("protocol"),
            "connection": updated.get("connection"),
            "tcp_host": updated.get("tcp_host"),
            "tcp_port": updated.get("tcp_port"),
            "passphrase": updated.get("passphrase"),
            "started_at": updated.get("started_at"),
            "expires_at": updated.get("expires_at"),
        },
    }


@router.post("/{challenge_id}/terminate2", status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
async def terminate_instance_team_scoped(
    request: Request,
    challenge_id: int,
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    """
    Terminates the team-scoped instance and clears Redis metadata/flag.
    """
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(status_code=400, detail="You must be in a team.")

    k8s = K8sTeamChallengeManager()
    await k8s.terminate_instance(team.id, challenge_id)

    store = TeamInstanceStore()
    await store.delete(team.id, challenge_id)

    flags = TeamFlagStore()
    await flags.delete_flag(team.id, challenge_id)

    # FREE UP LIMITER SLOT
    limiter = InstanceLimiter()
    try:
        await limiter.release(team_id=team.id, challenge_id=challenge_id)
    except Exception:
        logger.warning("InstanceLimiter.release() failed")

    return {"message": "Instance terminated."}


@router.post("/{challenge_id}/submit2", response_model=dict, status_code=status.HTTP_200_OK)
@limiter.limit("10/minute")
@limiter.limit("50/hour")
async def submit_flag_team_once(
    request: Request,
    challenge_id: int,
    submission: FlagSubmission,
    current_user: CurrentUserDep,
    challenge_repo: ChallengesRepositoryDep,
    team_repo: TeamsRepositoryDep,
):
    """
    Team-aware flag submission:
    - User can solve once (UNIQUE user_id+challenge_id)
    - Team can be credited once (UNIQUE team_id+challenge_id)
    - Later users from the same team can still mark solve, but team score is not increased again.
    """
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(status_code=400, detail="You must be in a team to submit a flag.")

    flag_value = (submission.flag or "").strip()
    if not flag_value:
        raise HTTPException(status_code=400, detail="Flag cannot be empty.")

    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    # --- HOTFIX: copy scalars before any commit/rollback (prevents MissingGreenlet)
    ch_points = int(getattr(ch, "points", 0) or 0)
    ch_id = int(getattr(ch, "id", challenge_id))

    # Enforce: user can solve only once
    if await challenge_repo.has_user_completed(current_user.id, challenge_id):
        raise HTTPException(status_code=400, detail="Challenge already completed by you.")

    # Validate team-scoped flag
    valid = await challenge_repo.validate_flag_team(ch, flag_value, team_id=team.id)
    if not valid:
        logger.info(f"Wrong flag submitted by user={current_user.username} team={team.id} challenge={challenge_id}")
        raise HTTPException(status_code=400, detail="Incorrect flag")

    # Record USER completion (must be protected by UNIQUE in DB)
    completion = await challenge_repo.record_completion(current_user.id, challenge_id)
    if not completion:
        raise HTTPException(status_code=400, detail="Challenge already completed by you.")

    # Record TEAM completion once
    team_awarded = await team_repo.record_team_completion(
        team_id=team.id,
        challenge_id=challenge_id,
        completed_by_user_id=current_user.id,
    )

    if team_awarded:
        msg = f"Correct! +{ch_points} points (team awarded)"
    else:
        msg = "Correct! (team already credited for this challenge)"

    return {
        "message": msg,
        "team_awarded": team_awarded,
        "points": ch_points,
        "team_id": team.id,
        "challenge_id": ch_id,
    }
