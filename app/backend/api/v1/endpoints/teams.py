## # TODO
# PREFIX: /api/v1/teams
## Teams
## - * POST /api/v1/teams/create * – create a new team  --- only registered users without team can create team
## - * DELETE /api/v1/teams/{team_id}          --- delete existing team
## - * PUT / api/v1/teams/leave                --- current user leaves team. If team is empty ----> team is deleted completely
## - * POST /api/v1/teams/join/{join_code} *   --– join an existing team
## - * GET /api/v1/teams/myteam *              --– get current active user's team
## - * GET /api/v1/teams * – list all teams with historical scores ( for chart & scoreboard)
## - Each team object includes:
## json
## {
##     "name": "CryptoMasters",
##     "scores": [
##         {"time": "10:00", "points": 0},
##         {"time": "11:00", "points": 20},
##         {"time": "12:00", "points": 50}
##     ],
##     "finalScore": 50
## }
##
##
##

import fastapi
from fastapi import HTTPException, status
from loguru import logger

from app.backend.api.v1.deps import CurrentUserDep, TeamsRepositoryDep
from app.backend.schema.teams import FullTeamInResponse, TeamInCreate

router = fastapi.APIRouter(tags=["teams"])


async def _construct_full_team_response(team, team_repo) -> FullTeamInResponse:
    # team: TeamTable
    # get scores records
    scores = await team_repo.get_team_scores(team.id)

    score_records = []
    total = 0
    for s in scores:
        # s: UserCompletedChallengeTable
        username = getattr(s.user, "username", "")
        points = getattr(s.challenge, "points", 0)
        score_records.append({"date_time": s.completed_at, "obtained_by": username, "score": points})
        total += points

    users = []
    for assoc in getattr(team, "user_associations", []):
        u = getattr(assoc, "user", None)
        if u:
            users.append({"username": u.username})

    return FullTeamInResponse(
        team_id=team.id,
        team_name=team.name,
        scores=score_records,
        total_score=total,
        join_code=team.join_code,
        created_at=team.created_at,
        users=users,
    )


@router.post("/create", response_model=FullTeamInResponse, status_code=status.HTTP_201_CREATED)
async def create_team(
    team_in_create: TeamInCreate,
    team_repo: TeamsRepositoryDep,
    current_user: CurrentUserDep,
):
    # only users without team can create a team
    existing = await team_repo.get_team_for_user(current_user.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already in a team")

    db_team = await team_repo.create_team(team_in_create, creator=current_user)
    if db_team is None:
        logger.error(f"Team creation failed for name={team_in_create.team_name}")
        raise HTTPException(status.HTTP_409_CONFLICT, "Team with this name already exists.")

    logger.info(f"New team created: name={db_team.name}")
    return await _construct_full_team_response(db_team, team_repo)


@router.delete("/{team_id}", response_model=dict, status_code=status.HTTP_200_OK)
async def delete_team_by_id(
    team_id: int,
    team_repo: TeamsRepositoryDep,
    current_user: CurrentUserDep,
):
    # only admins or a member of the team can delete the team
    # fetch team
    team = await team_repo.read_team_by_id(team_id)
    if not team:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Team with specified id does not exist")

    # allow if admin or user is in team
    is_member = any(
        getattr(assoc.user, "id", None) == current_user.id for assoc in getattr(team, "user_associations", [])
    )
    if current_user.role.value != "admin" and not is_member:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Unauthorized to delete this team")

    ok = await team_repo.delete_team_by_id(team_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Failed to delete team")
    logger.info(f"Team id={team_id} deleted by user={current_user.username}")
    return {"message": f"Team {team_id} deleted successfully"}


@router.put("/leave", response_model=dict, status_code=status.HTTP_200_OK)
async def leave_current_team(
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    ok = await team_repo.leave_team(current_user)
    if not ok:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User is not in any team")
    return {"message": "Successfully left the team"}


@router.post("/join/{join_code}", response_model=dict, status_code=status.HTTP_200_OK)
async def join_team_with_join_code(
    join_code: str,
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    # check if user already in a team
    existing = await team_repo.get_team_for_user(current_user.id)
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="User already in a team")

    team = await team_repo.join_team_by_code(join_code, current_user)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invalid join code or team does not exist")
    return {"message": f"User {current_user.username} joined team {team.name}"}


@router.get("/myteam", response_model=FullTeamInResponse, status_code=status.HTTP_200_OK)
async def get_my_team(
    curr_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    team = await team_repo.get_team_for_user(curr_user.id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User has no active team")
    return await _construct_full_team_response(team, team_repo)


@router.get("", response_model=list[FullTeamInResponse], status_code=status.HTTP_200_OK)
async def get_all_teams(
    team_repo: TeamsRepositoryDep,
):
    teams = await team_repo.list_all_teams()
    response = []
    for t in teams:
        response.append(await _construct_full_team_response(t, team_repo))
    return response


@router.get("/{id}", response_model=FullTeamInResponse, status_code=status.HTTP_200_OK)
async def get_team_by_id(
    id: int,
    team_repo: TeamsRepositoryDep,
):
    team = await team_repo.read_team_by_id(id)
    if not team:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Team with specified id does not exist")
    return await _construct_full_team_response(team, team_repo)
