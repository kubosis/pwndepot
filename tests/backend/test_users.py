import pytest

from tests.backend.utils import authenticate_client, create_admin_user, register_user


@pytest.mark.asyncio
async def test_register_login_and_me(client):
    email = "user1@example.com"
    password = "Passw0rd123!"

    res = await register_user(client, "user1", email, password)
    assert res.status_code == 201
    body = res.json()
    assert body["username"] == "user1"

    token = authenticate_client(client, body["id"])
    assert token
    me = await client.get("/api/v1/users/me")
    assert me.status_code == 200
    me_body = me.json()
    assert me_body["username"] == "user1"


@pytest.mark.asyncio
async def test_admin_list_and_delete_users(client, db_session):
    admin_password = "AdminPass123!"
    admin_email = "admin@example.com"
    admin = await create_admin_user(db_session, email=admin_email, password=admin_password)

    user_email = "victim@example.com"
    user_password = "VictimPass123!"
    res = await register_user(client, "victim", user_email, user_password)
    assert res.status_code == 201
    user_id = res.json()["id"]

    # admin "login"
    authenticate_client(client, admin.id)

    # list users
    list_res = await client.get("/api/v1/users/")
    assert list_res.status_code == 200
    users = list_res.json()
    assert any(u["id"] == user_id for u in users)

    # delete user
    del_res = await client.delete(f"/api/v1/users/{user_id}")
    assert del_res.status_code == 200
    assert "deleted" in del_res.json()["message"]
