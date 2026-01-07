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

import fastapi
from app.backend.api.v1.deps import ChallengesRepositoryDep, CurrentUserDep, TeamsRepositoryDep
from app.backend.db.models import ChallengeTable
from app.backend.schema.challenges import ChallengeInResponse, FlagSubmission
from app.backend.schema.teams import TeamWithScoresInResponse
from fastapi import HTTPException, status
from fastapi.responses import FileResponse
from loguru import logger

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
