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
from fastapi import Body, HTTPException, status
from loguru import logger

from app.backend.api.v1.deps import CurrentUserDep, TeamsRepositoryDep, UserRepositoryDep
from app.backend.config.settings import get_settings
from app.backend.schema.teams import FullTeamInResponse, TeamInCreate, TeamJoinViaInvite
from app.backend.security.tokens import create_team_invite_token, decode_team_invite_token

router = fastapi.APIRouter(tags=["teams"])
settings = get_settings()


async def _construct_full_team_response(team, team_repo, include_invite=True):
    # team: TeamTable
    # get scores records
    scores = await team_repo.get_team_scores(team.id)

    score_records = []
    total = 0
    for s in scores:
        # s: UserCompletedChallengeTable
        points = getattr(s.challenge, "points", 0)
        score_records.append(
            {"date_time": s.completed_at, "obtained_by": getattr(s.user, "username", ""), "score": points}
        )
        total += points

    users = []
    for assoc in getattr(team, "user_associations", []):
        u = getattr(assoc, "user", None)
        if u:
            users.append({"username": u.username})

    invite_url = None
    if include_invite:
        token = create_team_invite_token(team.id, team.join_code)
        invite_url = f"{settings.FRONTEND_DOMAIN}/join-team?token={token}"

    return FullTeamInResponse(
        team_id=team.id,
        team_name=team.name,
        captain_user_id=team.captain_user_id,
        scores=score_records,
        total_score=total,
        created_at=team.created_at,
        users=users,
        invite_url=invite_url,
    )


# -------------------------------------------------------
# Captain guard
# -------------------------------------------------------
async def assert_captain(team_repo, team_id, user):
    team, is_captain = await team_repo.ensure_captain(team_id, user)
    if not team:
        raise HTTPException(404, "Team not found")

    # Admins override captain restriction
    if user.role.value == "admin":
        return team

    if not is_captain:
        raise HTTPException(403, "Only captain may perform this action")

    return team


# -------------------------------------------------------
# CREATE TEAM
# -------------------------------------------------------
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


# -------------------------------------------------------
# REGENERATE INVITE (CAPTAIN OR ADMIN)
# -------------------------------------------------------
@router.post("/actions/{team_name}/regen-invite")
async def regen_invite(team_name: str, current_user: CurrentUserDep, team_repo: TeamsRepositoryDep):
    team = await team_repo.read_team_by_name(team_name)
    if not team:
        raise HTTPException(404, "Team not found")
    await assert_captain(team_repo, team.id, current_user)

    await team_repo.regenerate_invite_token(team)
    token = create_team_invite_token(team.id, team.join_code)

    invite_url = f"{settings.FRONTEND_DOMAIN}/join-team?token={token}"
    return {"invite_url": invite_url}


# -------------------------------------------------------
# CHANGE TEAM PASSWORD (CAPTAIN OR ADMIN)
# -------------------------------------------------------
@router.put("/actions/{team_name}/password", response_model=dict, status_code=status.HTTP_200_OK)
async def change_password(
    team_name: str,
    new_password: str = Body(...),
    account_password: str = Body(...),
    current_user: CurrentUserDep = None,
    team_repo: TeamsRepositoryDep = None,
    account_repo: UserRepositoryDep = None,
):
    # verify account password
    if not account_repo.pwd_manager.verify_password(account_password, current_user.hashed_password):
        raise HTTPException(401, "Incorrect account password")

    # load team
    team = await team_repo.read_team_by_name(team_name)
    if not team:
        raise HTTPException(404, "Team not found")

    # ensure user is captain or admin
    await assert_captain(team_repo, team.id, current_user)

    # update team password
    await team_repo.update_password(team, new_password)

    return {"message": "Password updated"}


# -------------------------------------------------------
# DELETE TEAM (CAPTAIN OR ADMIN)
# -------------------------------------------------------
@router.delete("/actions/{team_name}", response_model=dict, status_code=status.HTTP_200_OK)
async def delete_team_by_id(
    team_name: str,
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
    team_password: str = Body(..., embed=True),
):
    team = await team_repo.read_team_by_name(team_name)
    if not team:
        raise HTTPException(404, "Team not found")

    # captain or admin
    await assert_captain(team_repo, team.id, current_user)

    # verify team password
    ok = await team_repo.verify_team_password(team, team_password)
    if not ok:
        raise HTTPException(401, "Incorrect team password")

    success = await team_repo.delete_team_by_id(team.id)
    if not success:
        raise HTTPException(400, "Unable to delete team")

    return {"message": "Team deleted"}


# -------------------------------------------------------
# JOIN TEAM
# -------------------------------------------------------
@router.post("/join", response_model=dict)
async def join_team_invite(
    payload: TeamJoinViaInvite,
    current_user: CurrentUserDep,
    team_repo: TeamsRepositoryDep,
):
    # 1. Decode and validate token
    try:
        data = decode_team_invite_token(payload.token)
    except Exception as err:
        raise HTTPException(400, "Invalid or expired invite link") from err

    team_id = data["team_id"]

    # 2. Fetch the team
    team = await team_repo.read_team_by_id(team_id)
    if not team:
        raise HTTPException(404, "Team not found")

    # enforce max 5 users
    if len(team.user_associations) >= 6:
        raise HTTPException(400, "Team is full (maximum 6 members).")

    # 3. Ensure user is not already in a team
    existing = await team_repo.get_team_for_user(current_user.id)
    if existing:
        raise HTTPException(400, "User already in a team")

    # 4. Verify password
    ok = await team_repo.verify_team_password(team, payload.password)
    if not ok:
        raise HTTPException(401, "Incorrect team password")

    # 5. Join the team
    joined = await team_repo.join_team(team, current_user)
    if not joined:
        raise HTTPException(400, "Unable to join team")

    return {"message": "Joined successfully", "team_name": team.name}


@router.get("/join")
async def preview_invite_link(token: str, team_repo: TeamsRepositoryDep):
    """
    Validate invite token and return the team name for preview.
    Used by frontend before user enters password.
    """

    try:
        data = decode_team_invite_token(token)
    except Exception as err:
        raise HTTPException(400, "Invalid or expired invite link") from err

    team_id = data["team_id"]
    team = await team_repo.read_team_by_id(team_id)

    if not team:
        raise HTTPException(404, "Team not found")

    return {"team_name": team.name}


# -------------------------------------------------------
# LEAVE TEAM
# -------------------------------------------------------
@router.put("/leave", response_model=dict, status_code=status.HTTP_200_OK)
async def leave_current_team(current_user: CurrentUserDep, team_repo: TeamsRepositoryDep):
    # Get team info
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(400, "User is not in a team")

    member_count = len(team.user_associations)

    # If captain is alone - must delete team
    if current_user.id == team.captain_user_id and member_count == 1:
        raise HTTPException(400, "You are the last member. You must delete the team instead of leaving.")

    # If captain and more than 1 member - must transfer captain role
    if current_user.id == team.captain_user_id and member_count > 1:
        raise HTTPException(400, "Transfer captain role before leaving the team.")
    ok = await team_repo.leave_team(current_user)
    if not ok:
        raise HTTPException(400, "User is not in a team")

    return {"message": "Successfully left the team"}


# -------------------------------------------------------
# TRANSFER CAPTAIN ROLE
# -------------------------------------------------------
@router.post("/actions/{team_name}/transfer-captain", response_model=dict)
async def transfer_captain(
    team_name: str,
    new_captain_username: str = Body(..., embed=True),
    current_user: CurrentUserDep = None,
    team_repo: TeamsRepositoryDep = None,
):
    # Load team
    team = await team_repo.read_team_by_name(team_name)
    if not team:
        raise HTTPException(404, "Team not found")

    # Only captain or admin
    await assert_captain(team_repo, team.id, current_user)

    # Cannot transfer to yourself
    if new_captain_username == current_user.username:
        raise HTTPException(400, "You cannot transfer captain role to yourself")

    # Check if target user is in the team
    target_user = None
    for assoc in team.user_associations:
        if assoc.user.username == new_captain_username:
            target_user = assoc.user
            break

    if not target_user:
        raise HTTPException(400, "Selected user is not a member of this team")

    # Update captain ID
    await team_repo.transfer_captain(team, target_user.id)

    return {"message": "Captain role transferred successfully"}


# -------------------------------------------------------
# GET MY TEAM
# -------------------------------------------------------
@router.get("/myteam", response_model=FullTeamInResponse, status_code=status.HTTP_200_OK)
async def get_my_team(current_user: CurrentUserDep, team_repo: TeamsRepositoryDep):
    team = await team_repo.get_team_for_user(current_user.id)
    if not team:
        raise HTTPException(404, "User has no active team")

    return await _construct_full_team_response(team, team_repo)


# -------------------------------------------------------
# LIST ALL TEAMS
# -------------------------------------------------------
@router.get("", response_model=list[FullTeamInResponse], status_code=status.HTTP_200_OK)
async def list_teams(team_repo: TeamsRepositoryDep):
    teams = await team_repo.list_all_teams()
    response = []
    for t in teams:
        response.append(await _construct_full_team_response(t, team_repo))

    return response


# -------------------------------------------------------
# GET TEAM BY NAME
# -------------------------------------------------------
@router.get("/by-name/{team_name}", response_model=FullTeamInResponse)
async def get_team_by_name(team_name: str, team_repo: TeamsRepositoryDep):
    team = await team_repo.read_team_by_name(team_name)
    if not team:
        raise HTTPException(404, "Team with specified name does not exist")

    return await _construct_full_team_response(team, team_repo)
