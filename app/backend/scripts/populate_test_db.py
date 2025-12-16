import os
import sys
from pathlib import Path

sys.path.insert(0, Path(__file__).absolute().parent.parent.parent.parent.__str__())

if os.getenv("SQLALCHEMY_DATABASE_URL") == "":
    os.environ["SQLALCHEMY_DATABASE_URL"] = "sqlite+aiosqlite:///./app/backend/database.db"

import asyncio
import sys
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.backend.db import models
from app.backend.db.session import AsyncSessionLocal
from app.backend.security.password import PasswordManager


async def seed_db():
    """Insert test data into an existing database

    Adds:
    - 1 admin user
    - 5 test users
    - 2 teams (with captain assigned)
    - 1 test challenge
    """
    pwd_mgr = PasswordManager()

    async with AsyncSessionLocal() as session:
        # check whether we already have any users; if so, skip seeding
        existing = await session.execute(select(models.UserTable).limit(1))
        if existing.scalars().first() is not None:
            print("Seed data already present; skipping seeding.")
            return

        # Create users (including admin)
        users = [
            models.UserTable(
                username="admin",
                email="admin@example.com",
                role=models.RoleEnum.ADMIN,
                hashed_password=pwd_mgr.hash_password("adminpass"),
                is_email_verified=True,
            ),
        ]

        # five test users
        for i in range(1, 6):
            users.append(
                models.UserTable(
                    username=f"testuser{i}",
                    email=f"testuser{i}@example.com",
                    role=models.RoleEnum.USER,
                    hashed_password=pwd_mgr.hash_password("password123"),
                )
            )

        session.add_all(users)
        await session.flush()  # get generated PKs

        # Create two teams and assign captains
        team1 = models.TeamTable(
            name="RedTeam",
            captain_user_id=users[1].id,  # testuser1 as captain
            team_password_hash="team1hash",
            join_code="RED12345",
            invite_token="invite-red-abcdef",
        )

        team2 = models.TeamTable(
            name="BlueTeam",
            captain_user_id=users[2].id,  # testuser2 as captain
            team_password_hash="team2hash",
            join_code="BLU12345",
            invite_token="invite-blue-abcdef",
        )

        session.add_all([team1, team2])
        await session.flush()

        # Add user-team associations (make first three users members of RedTeam, next two of BlueTeam)
        user_team_assocs = []
        user_team_assocs.append(models.UserInTeamTable(user_id=users[1].id, team_id=team1.id))
        user_team_assocs.append(models.UserInTeamTable(user_id=users[2].id, team_id=team1.id))
        user_team_assocs.append(models.UserInTeamTable(user_id=users[3].id, team_id=team1.id))
        user_team_assocs.append(models.UserInTeamTable(user_id=users[4].id, team_id=team2.id))
        user_team_assocs.append(models.UserInTeamTable(user_id=users[5].id, team_id=team2.id))

        session.add_all(user_team_assocs)

        try:
            await session.commit()
            print("Seed data inserted successfully.")
        except IntegrityError as e:
            await session.rollback()
            print(f"Integrity error while inserting seed data: {e}")


async def add_test_challenge():
    async with AsyncSessionLocal() as session:
        # Add a single test challenge
        challenge = models.ChallengeTable(
            name="Hidden Cat",
            path="/project/challenges/deployment/cat.zip",
            description="A seemingly normal cat image hides a flag inside the file. Inspect the file contents (especially the end) to recover the flag in the format flag{...}.",
            hint="Try the obvious input",
            is_download=True,
            difficulty=models.DifficultyEnum.EASY,
            points=100,
            flag="abctest",
            ctf_active=False,
        )

        session.add(challenge)

        try:
            await session.commit()
            print("Seed data inserted successfully.")
        except IntegrityError as e:
            await session.rollback()
            print(f"Integrity error while inserting seed data: {e}")

        challenge = models.ChallengeTable(
            name="Lorem Ipsum",
            path="/",
            description="LoremIpsum",
            hint="Try the obvious input",
            is_download=False,
            difficulty=models.DifficultyEnum.HARD,
            points=250,
            flag=None,
            ctf_active=False,
        )

        session.add(challenge)

        try:
            await session.commit()
            print("Seed data inserted successfully.")
        except IntegrityError as e:
            await session.rollback()
            print(f"Integrity error while inserting seed data: {e}")


async def init_db():
    """Ensure DB is reachable and run seeding. Alembic is expected to manage schema migrations."""
    print("Ensuring schema via Alembic and seeding database with mock data...")
    # run Alembic migrations to create schema if not present
    await seed_db()
    await add_test_challenge()


if __name__ == "__main__":
    asyncio.run(init_db())
