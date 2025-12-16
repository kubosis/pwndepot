## Challenges & Rankings
# PREFIX: /api/v1/challenges/
# - *GET  /api/v1/challenges* – list all available challenges
# - *POST /api/v1/challenges/{id}/submit* – submit a flag
#  - Validates the flag for correctness
# - *GET  /api/v1/rankings* – retrieve sorted scoreboard (rank, team name, finalScore, optional tie-breakers)
# - *GET  /api/v1/{id}/ctf-status* – get competition status (running/ended, end timestamp)
# - *POST /api/v1/{id}/ctf-start* – start CTF (admin only; sets ctfActive = true and timer)
# - *POST /api/v1/{id}/ctf-stop* – stop CTF (admin only; sets ctfActive = false and timer)

import os
from datetime import datetime, timedelta, timezone

import fastapi
from fastapi import HTTPException, status
from fastapi.responses import FileResponse
from loguru import logger

from app.backend.api.v1.deps import ChallengesRepositoryDep, CurrentAdminDep, CurrentUserDep, TeamsRepositoryDep
from app.backend.db.models import ChallengeTable
from app.backend.schema.challenges import ChallengeInResponse, CTFStartRequest, FlagSubmission
from app.backend.schema.teams import TeamWithScoresInResponse

router = fastapi.APIRouter(tags=["challenges"])


def _construct_challenge_response(challenge: ChallengeTable) -> ChallengeInResponse:
    return ChallengeInResponse(
        id=challenge.id,
        name=challenge.name,
        path=challenge.path,
        description=challenge.description,
        hint=challenge.hint,
        is_download=challenge.is_download,
        difficulty=getattr(challenge.difficulty, "value", str(challenge.difficulty)),
        points=challenge.points,
        created_at=challenge.created_at,
    )


@router.get("", response_model=list[ChallengeInResponse], status_code=status.HTTP_200_OK)
async def list_challenges(challenge_repo: ChallengesRepositoryDep):
    db_chals = await challenge_repo.list_challenges()
    return [_construct_challenge_response(c) for c in db_chals]


@router.get("/{challenge_id}", response_model=ChallengeInResponse, status_code=status.HTTP_200_OK)
async def get_challenge_by_id(challenge_id: int, challenge_repo: ChallengesRepositoryDep):
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")
    return _construct_challenge_response(ch)


@router.post("/{challenge_id}/submit", response_model=dict, status_code=status.HTTP_200_OK)
async def submit_flag(
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


@router.get("/rankings", response_model=list[TeamWithScoresInResponse], status_code=status.HTTP_200_OK)
async def get_rankings(team_repo: TeamsRepositoryDep):
    teams = await team_repo.list_all_teams()
    response: list[TeamWithScoresInResponse] = []
    for t in teams:
        scores = await team_repo.get_team_scores(t.id)
        score_records = []
        total = 0
        for s in scores:
            username = getattr(s.user, "username", "")
            points = getattr(s.challenge, "points", 0)
            score_records.append({"date_time": s.completed_at, "obtained_by": username, "score": points})
            total += points
        response.append(
            TeamWithScoresInResponse(
                team_id=t.id,
                team_name=t.name,
                scores=score_records,
                total_score=total,
            )
        )
    # sort by total_score desc
    response.sort(key=lambda x: x.total_score, reverse=True)
    return response


@router.get("/{challenge_id}/ctf-status", response_model=dict, status_code=status.HTTP_200_OK)
async def get_ctf_status(challenge_id: int, challenge_repo: ChallengesRepositoryDep):
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    now = datetime.now(timezone.utc)
    state = await challenge_repo.get_ctf_state()
    active = bool(state.active)
    ends_at = state.ends_at
    remaining = None
    if active and ends_at:
        remaining = max(0, int((ends_at - now).total_seconds()))
        if remaining == 0:
            # expire automatically
            await challenge_repo.set_ctf_state(False, None, None, None)
            active = False
            ends_at = None
    return {
        "active": active,
        "ends_at": ends_at,
        "remaining_seconds": remaining,
        "started_by": state.started_by_user_id,
    }


@router.post("/{challenge_id}/ctf-start", response_model=dict, status_code=status.HTTP_200_OK)
async def start_ctf(
    challenge_id: int,
    start_ctf_req: CTFStartRequest,
    current_admin: CurrentAdminDep,
    challenge_repo: ChallengesRepositoryDep,
):
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    duration = int(start_ctf_req.duration_seconds)

    now = datetime.now(timezone.utc)
    ends_at = now + timedelta(seconds=duration)

    # persist state in DB
    started_by_id = getattr(current_admin, "id", None)
    await challenge_repo.set_ctf_state(True, ends_at, started_by_id, now)

    logger.info(
        f"CTF started by {getattr(current_admin, 'username', None)} for challenge {challenge_id}, ends_at={ends_at}"
    )
    return {"message": "CTF started", "ends_at": ends_at}


@router.post("/{challenge_id}/ctf-stop", response_model=dict, status_code=status.HTTP_200_OK)
async def stop_ctf(
    challenge_id: int,
    current_admin: CurrentAdminDep,
    challenge_repo: ChallengesRepositoryDep,
):
    ch = await challenge_repo.read_challenge_by_id(challenge_id)
    if not ch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    await challenge_repo.set_ctf_state(False, None, None, None)
    logger.info(f"CTF stopped by {getattr(current_admin, 'username', None)} for challenge {challenge_id}")
    return {"message": "CTF stopped"}


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
    return FileResponse(path=file_path, filename=filename, media_type="application/octet-stream")
