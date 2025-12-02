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

import fastapi
from fastapi import HTTPException, status
from loguru import logger

from app.backend.api.v1.deps import CurrentUserDep, TeamsRepositoryDep
from app.backend.schema.teams import FullTeamInResponse, TeamInCreate

router = fastapi.APIRouter(tags=["teams"])


@router.post("/create", response_model=FullTeamInResponse, status_code=status.HTTP_201_CREATED)
def create_team(
    team_in_create: TeamInCreate,
    team_repo: TeamsRepositoryDep,
):
    db_team = team_repo.create_team(team_in_create)
    if db_team is not None:
        logger.info(f"New team created: name={db_team.name}")
    else:
        logger.error(f"User registration failed for name={team_in_create.team_name}")
        raise HTTPException(status.HTTP_409_CONFLICT, "Team with this name already exists.")
    # TODO construct returned structure
    return ...


@router.delete("/{team_id}", response_model=dict, status_code=status.HTTP_200_OK)
def delete_team_by_id(
    team_id: int,
    team_repo: TeamsRepositoryDep,
):
    ...
    raise NotImplementedError


@router.put("/leave", response_model=dict, status_code=status.HTTP_200_OK)
def leave_current_team(
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    # TODO
    raise NotImplementedError


@router.post("/join/{join_code}", response_model=dict, status_code=status.HTTP_200_OK)
def join_team_with_join_code(
    join_code: str,
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    # TODO
    raise NotImplementedError


@router.get("/myteam", response_model=FullTeamInResponse, status_code=status.HTTP_200_OK)
def get_my_team(
    curr_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    # TODO
    raise NotImplementedError


@router.get("", response_model=list[FullTeamInResponse], status_code=status.HTTP_200_OK)
def get_all_teams(
    team_repo: TeamsRepositoryDep,
):
    # TODO
    raise NotImplementedError
