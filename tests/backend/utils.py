from __future__ import annotations

from app.backend.db.models import ChallengeTable, DifficultyEnum, RoleEnum, UserTable
from app.backend.security.password import PasswordManager
from app.backend.security.tokens import create_jwt_access_token

pwd_manager = PasswordManager()


async def create_admin_user(
    session, *, username="admin", email="admin@example.com", password="AdminPass123!"
) -> UserTable:
    hashed = pwd_manager.hash_password(password)
    admin = UserTable(
        username=username,
        email=email,
        hashed_password=hashed,
        role=RoleEnum.ADMIN,
        is_email_verified=True,
    )
    session.add(admin)
    await session.commit()
    await session.refresh(admin)
    return admin


async def create_challenge(
    session,
    *,
    name="TestChallenge",
    path="test_challenge_path",
    description="Test challenge",
    hint="hint",
    is_download=False,
    difficulty=DifficultyEnum.EASY,
    points=100,
    flag="FLAG{TEST}",
) -> ChallengeTable:
    challenge = ChallengeTable(
        name=name,
        path=path,
        description=description,
        hint=hint,
        is_download=is_download,
        difficulty=difficulty,
        points=points,
        flag=flag,
    )
    session.add(challenge)
    await session.commit()
    await session.refresh(challenge)
    return challenge


async def register_user(client, username: str, email: str, password: str):
    return await client.post(
        "/api/v1/users/register",
        json={"username": username, "email": email, "password": password},
    )


async def login_user(client, email: str, password: str):
    # FastAPI’s OAuth2PasswordRequestForm expects the email in the “username” field.
    res = await client.post(
        "/api/v1/users/login",
        data={"username": email, "password": password},
    )
    token = res.cookies.get("access_token")
    if token:
        client.cookies.set("access_token", token, path="/")
    return res


def authenticate_client(client, user_id: int):
    token = create_jwt_access_token({"sub": str(user_id)})
    client.cookies.set("access_token", token, path="/")
    return token
