import random
import secrets
import string

import sqlalchemy
from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.backend.db.models import TeamTable, UserCompletedChallengeTable, UserInTeamTable, UserTable
from app.backend.repository.base import BaseCRUDRepository
from app.backend.schema.teams import TeamInCreate
from app.backend.security.password import PasswordManager


async def _generate_unique_join_code(async_session: AsyncSession) -> str:
    chars = string.ascii_letters + string.digits
    while True:
        code = "".join(random.choices(chars, k=8))
        code_in_db = await async_session.execute(select(TeamTable).where(TeamTable.join_code == code))
        code_row = code_in_db.scalar()
        if not code_row:
            return code


class TeamsCRUDRepository(BaseCRUDRepository):
    def __init__(self, async_session: AsyncSession):
        super().__init__(async_session)
        self.pwd_manager = PasswordManager()

    # -------------------------------------------------------
    # CREATE TEAM
    # -------------------------------------------------------
    async def create_team(self, team_in_create: TeamInCreate, creator: UserTable):
        try:
            join_code = await _generate_unique_join_code(async_session=self.async_session)
            invite_token = secrets.token_urlsafe(32)
            hashed_pwd = self.pwd_manager.hash_password(team_in_create.team_password)

            new_team = TeamTable(
                name=team_in_create.team_name,
                invite_token=invite_token,
                join_code=join_code,
                captain_user_id=creator.id,
                team_password_hash=hashed_pwd,
            )

            self.async_session.add(new_team)
            await self.async_session.commit()
            await self.async_session.refresh(new_team)

            assoc = UserInTeamTable(user_id=creator.id, team_id=new_team.id)
            self.async_session.add(assoc)
            await self.async_session.commit()

            return await self.read_team_by_id(new_team.id)

        except IntegrityError:
            await self.async_session.rollback()
            return None

    # -------------------------------------------------------
    # GET TEAM FOR USER
    # -------------------------------------------------------
    async def get_team_for_user(self, user_id: int) -> TeamTable | None:
        stmt = (
            select(TeamTable)
            .join(UserInTeamTable, UserInTeamTable.team_id == TeamTable.id)
            .where(UserInTeamTable.user_id == user_id)
            .options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        )
        query = await self.async_session.execute(stmt)
        return query.scalar()

    # -------------------------------------------------------
    # BASIC READS
    # -------------------------------------------------------
    async def read_team_by_id(self, team_id: int):
        stmt = (
            select(TeamTable)
            .where(TeamTable.id == team_id)
            .options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        )
        query = await self.async_session.execute(stmt)
        return query.scalar()

    async def read_team_by_name(self, name: str):
        stmt = (
            select(TeamTable)
            .where(TeamTable.name == name)
            .options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        )
        q = await self.async_session.execute(stmt)
        return q.scalar()

    async def read_team_by_invite_token(self, token: str):
        stmt = (
            select(TeamTable)
            .where(TeamTable.invite_token == token)
            .options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        )
        q = await self.async_session.execute(stmt)
        return q.scalar()

    # -------------------------------------------------------
    # CAPTAIN CHECK
    # -------------------------------------------------------
    async def ensure_captain(self, team_id: int, user: UserTable):
        team = await self.read_team_by_id(team_id)
        if not team:
            return None, False
        return team, team.captain_user_id == user.id

    # -------------------------------------------------------
    # REGENERATE INVITE TOKEN
    # -------------------------------------------------------
    async def regenerate_invite_token(self, team: TeamTable):
        team.invite_token = secrets.token_urlsafe(32)
        await self.async_session.commit()
        return team.invite_token

    # -------------------------------------------------------
    # UPDATE PASSWORD
    # -------------------------------------------------------
    async def update_password(self, team: TeamTable, new_password: str):
        team.team_password_hash = self.pwd_manager.hash_password(new_password)
        await self.async_session.commit()
        return True

    # -------------------------------------------------------
    # VERIFY TEAM PASSWORD
    # -------------------------------------------------------
    async def verify_team_password(self, team: TeamTable, password: str) -> bool:
        """
        Returns True if password matches stored team password hash.
        """
        return self.pwd_manager.verify_password(password, team.team_password_hash)

    # -------------------------------------------------------
    # DELETE TEAM
    # -------------------------------------------------------
    async def delete_team_by_id(self, team_id: int) -> bool:
        # ensure team exists
        team = await self.read_team_by_id(team_id)
        if not team:
            return False

        # Delete user associations first
        await self.async_session.execute(delete(UserInTeamTable).where(UserInTeamTable.team_id == team_id))

        # Delete the team
        stmt = delete(TeamTable).where(TeamTable.id == team_id)
        await self.async_session.execute(stmt)

        # Commit both operations
        await self.async_session.commit()

        logger.info(f"Deleted team id={team_id} and cleared all user associations")
        return True

    # -------------------------------------------------------
    # JOIN TEAM
    # -------------------------------------------------------
    async def join_team(self, team: TeamTable, user: UserTable):
        query = await self.async_session.execute(select(UserInTeamTable).where(UserInTeamTable.user_id == user.id))
        if query.scalar():
            return None

        new_assoc = UserInTeamTable(user_id=user.id, team_id=team.id)
        self.async_session.add(new_assoc)
        await self.async_session.commit()
        logger.info(f"User id={user.id} joined team id={team.id}")
        return await self.read_team_by_id(team.id)

    # -------------------------------------------------------
    # LEAVE TEAM
    # -------------------------------------------------------
    async def leave_team(self, user: UserTable):
        query = await self.async_session.execute(select(UserInTeamTable).where(UserInTeamTable.user_id == user.id))
        assoc = query.scalar()
        if not assoc:
            return False

        team_id = assoc.team_id

        await self.async_session.execute(delete(UserInTeamTable).where(UserInTeamTable.user_id == user.id))
        await self.async_session.commit()

        # delete empty team
        q2 = await self.async_session.execute(
            select(func.count()).select_from(UserInTeamTable).where(UserInTeamTable.team_id == team_id)
        )
        if q2.scalar_one() == 0:
            await self.delete_team_by_id(team_id)
        logger.info(f"User id={user.id} left team id={team_id}")

        return True

    # -------------------------------------------------------
    # TRANSFER CAPTAIN ROLE
    # -------------------------------------------------------
    async def transfer_captain(self, team, new_captain_id: int) -> bool:
        """
        Updates the captain_user_id for a team.
        """
        stmt = sqlalchemy.update(TeamTable).where(TeamTable.id == team.id).values(captain_user_id=new_captain_id)

        await self.async_session.execute(stmt)
        await self.async_session.commit()

        # Refresh the model to reflect changes
        await self.async_session.refresh(team)

        return True

    # -------------------------------------------------------
    # SCORE HISTORY
    # -------------------------------------------------------
    async def get_team_scores(self, team_id: int) -> list[UserCompletedChallengeTable]:
        # select completion records for users who are in the specified team
        stmt = (
            select(UserCompletedChallengeTable)
            .join(UserTable, UserCompletedChallengeTable.user_id == UserTable.id)
            .join(UserInTeamTable, UserInTeamTable.user_id == UserTable.id)
            .where(UserInTeamTable.team_id == team_id)
            .options(joinedload(UserCompletedChallengeTable.user), joinedload(UserCompletedChallengeTable.challenge))
            .order_by(UserCompletedChallengeTable.completed_at)
        )
        query = await self.async_session.execute(stmt)
        return query.scalars().all()

    # -------------------------------------------------------
    # LIST TEAMS
    # -------------------------------------------------------
    async def list_all_teams(self) -> list[TeamTable]:
        stmt = select(TeamTable).options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        query = await self.async_session.execute(stmt)
        return query.scalars().all()
