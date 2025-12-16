import urllib.parse

import pytest

from tests.backend.utils import authenticate_client, register_user


def _extract_token(invite_url: str) -> str:
    parsed = urllib.parse.urlparse(invite_url)
    query = urllib.parse.parse_qs(parsed.query)
    tokens = query.get("token", [])
    return tokens[0]


@pytest.mark.asyncio
async def test_team_create_join_and_myteam_flow(client):
    team_password = "TeamPass123!"

    # user1 creates a team
    res_captain = await register_user(client, "captain", "captain@example.com", "CapPass1234!")
    captain_id = res_captain.json()["id"]
    authenticate_client(client, captain_id)
    create_res = await client.post(
        "/api/v1/teams/create",
        json={"team_name": "AlphaTeam", "team_password": team_password},
    )
    assert create_res.status_code == 201
    team_body = create_res.json()
    token = _extract_token(team_body["invite_url"])

    # user2 joins
    res_member = await register_user(client, "member", "member@example.com", "MemberPass123!")
    member_id = res_member.json()["id"]
    authenticate_client(client, member_id)
    join_res = await client.post(
        "/api/v1/teams/join",
        json={"token": token, "password": team_password},
    )
    assert join_res.status_code == 200

    # both user see their team
    captain_team = await client.get("/api/v1/teams/myteam")
    assert captain_team.status_code == 200
    assert captain_team.json()["team_name"] == "AlphaTeam"

    member_team = await client.get("/api/v1/teams/myteam")
    assert member_team.status_code == 200
    assert member_team.json()["team_name"] == "AlphaTeam"

    # list
    list_res = await client.get("/api/v1/teams")
    assert list_res.status_code == 200
    assert any(t["team_name"] == "AlphaTeam" for t in list_res.json())


@pytest.mark.asyncio
async def test_team_password_change_and_delete(client):
    team_password = "TeamPass123!"
    new_team_password = "NewTeamPass123!"

    res_captain = await register_user(client, "captain2", "captain2@example.com", "Cap2Pass123!")
    captain_id = res_captain.json()["id"]
    authenticate_client(client, captain_id)
    create_res = await client.post(
        "/api/v1/teams/create",
        json={"team_name": "BetaTeam", "team_password": team_password},
    )
    assert create_res.status_code == 201

    # jelszócsere (account_password = saját belépési jelszó)
    pwd_res = await client.put(
        "/api/v1/teams/actions/BetaTeam/password",
        json={"new_password": new_team_password, "account_password": "Cap2Pass123!"},
    )
    assert pwd_res.status_code == 200

    # törlés új csapatjelszóval
    del_res = await client.request(
        "DELETE",
        "/api/v1/teams/actions/BetaTeam",
        json={"team_password": new_team_password},
    )
    assert del_res.status_code == 200
    assert "deleted" in del_res.json()["message"].lower()
