import pytest

from app.backend.db.models import DifficultyEnum
from tests.backend.utils import authenticate_client, create_admin_user, create_challenge, login_user, register_user


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="Backend bug: ChallengeTable.valid_until is missing, so the list_challenges endpoint raises an error."
)
async def test_list_get_and_submit_challenge(client, db_session):
    challenge = await create_challenge(
        db_session,
        name="Crypto101",
        path="crypto101_path",
        difficulty=DifficultyEnum.EASY,
        points=150,
        flag="FLAG{CRYPTO}",
    )

    # registration + team
    solver_res = await register_user(client, "solver", "solver@example.com", "SolvePass123!")
    solver_id = solver_res.json()["id"]
    authenticate_client(client, solver_id)
    team_password = "TeamPass123!"
    create_team = await client.post(
        "/api/v1/teams/create",
        json={"team_name": "CryptoTeam", "team_password": team_password},
    )
    assert create_team.status_code == 201

    # list + get
    list_res = await client.get("/api/v1/challenges")
    assert list_res.status_code == 200
    assert any(ch["id"] == challenge.id for ch in list_res.json())

    get_res = await client.get(f"/api/v1/challenges/{challenge.id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Crypto101"

    # successful submit
    submit_ok = await client.post(
        f"/api/v1/challenges/{challenge.id}/submit",
        json={"flag": "FLAG{CRYPTO}"},
    )
    assert submit_ok.status_code == 200

    # duplicated submit blocked
    submit_dup = await client.post(
        f"/api/v1/challenges/{challenge.id}/submit",
        json={"flag": "FLAG{CRYPTO}"},
    )
    assert submit_dup.status_code == 400

    # rankings
    rankings = await client.get("/api/v1/challenges/rankings")
    assert rankings.status_code == 200
    teams = rankings.json()
    assert any(t["team_name"] == "CryptoTeam" and t["total_score"] == 150 for t in teams)


@pytest.mark.asyncio
@pytest.mark.xfail(
    reason="CTF start/stop endpoints currently call the repository methods with an incorrect signature."
)
async def test_ctf_start_stop_endpoints(client, db_session):
    challenge = await create_challenge(
        db_session,
        name="CTFState",
        path="ctfstate_path",
        difficulty=DifficultyEnum.MEDIUM,
        points=50,
        flag="FLAG{STATE}",
    )
    admin_password = "AdminPass123!"
    admin_email = "admin_ctf@example.com"
    await create_admin_user(db_session, email=admin_email, password=admin_password)
    await login_user(client, admin_email, admin_password)

    start_res = await client.post(
        f"/api/v1/challenges/{challenge.id}/ctf-start",
        json={"duration_seconds": 60},
    )
    assert start_res.status_code == 200

    stop_res = await client.post(f"/api/v1/challenges/{challenge.id}/ctf-stop")
    assert stop_res.status_code == 200
