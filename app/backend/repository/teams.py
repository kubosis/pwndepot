import random
import string

from loguru import logger
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload

from app.backend.db.models import TeamTable, UserCompletedChallengeTable, UserInTeamTable, UserTable
from app.backend.repository.base import BaseCRUDRepository
from app.backend.schema.teams import TeamInCreate


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

    async def create_team(self, team_in_create: TeamInCreate, creator: UserTable | None = None) -> TeamTable | None:
        """Create a team and optionally add the creator as a member."""
        try:
            join_code = await _generate_unique_join_code(async_session=self.async_session)

            new_team = TeamTable(name=team_in_create.team_name, join_code=join_code)

            self.async_session.add(instance=new_team)
            await self.async_session.commit()
            await self.async_session.refresh(instance=new_team)

            # add creator to team if provided
            if creator is not None:
                association = UserInTeamTable(user_id=creator.id, team_id=new_team.id)
                self.async_session.add(instance=association)
                await self.async_session.commit()
                await self.async_session.refresh(instance=association)

            logger.info(f"New Team created: teamname={team_in_create.team_name}")
            return new_team

        except IntegrityError:
            await self.async_session.rollback()
            logger.error(f"Account creation failed due to IntegrityError for name={team_in_create.team_name}")
            return None

    async def read_team_by_id(self, team_id: int) -> TeamTable | None:
        stmt = (
            select(TeamTable)
            .where(TeamTable.id == team_id)
            .options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        )
        query = await self.async_session.execute(stmt)
        return query.scalar()

    async def read_team_by_join_code(self, join_code: str) -> TeamTable | None:
        stmt = (
            select(TeamTable)
            .where(TeamTable.join_code == join_code)
            .options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        )
        query = await self.async_session.execute(stmt)
        return query.scalar()

    async def delete_team_by_id(self, team_id: int) -> bool:
        # ensure team exists
        team = await self.read_team_by_id(team_id)
        if not team:
            return False
        stmt = delete(TeamTable).where(TeamTable.id == team_id)
        await self.async_session.execute(stmt)
        await self.async_session.commit()
        logger.info(f"Deleted team id={team_id}")
        return True

    async def join_team_by_code(self, join_code: str, user: UserTable) -> TeamTable | None:
        team = await self.read_team_by_join_code(join_code)
        if not team:
            return None

        # check if user already in any team
        user_assoc_stmt = select(UserInTeamTable).where(UserInTeamTable.user_id == user.id)
        user_assoc_q = await self.async_session.execute(user_assoc_stmt)
        user_assoc = user_assoc_q.scalar()
        if user_assoc:
            # user already in a team
            return None

        # create association
        new_assoc = UserInTeamTable(user_id=user.id, team_id=team.id)
        self.async_session.add(new_assoc)
        await self.async_session.commit()
        await self.async_session.refresh(new_assoc)
        logger.info(f"User id={user.id} joined team id={team.id}")
        return team

    async def leave_team(self, user: UserTable) -> bool:
        # find association(s)
        stmt = select(UserInTeamTable).where(UserInTeamTable.user_id == user.id)
        query = await self.async_session.execute(stmt)
        assoc = query.scalar()
        if not assoc:
            return False

        team_id = assoc.team_id
        # delete the association
        del_stmt = delete(UserInTeamTable).where(UserInTeamTable.user_id == user.id)
        await self.async_session.execute(del_stmt)
        await self.async_session.commit()

        # check if team empty -> delete team
        count_stmt = select(func.count()).select_from(UserInTeamTable).where(UserInTeamTable.team_id == team_id)
        count_q = await self.async_session.execute(count_stmt)
        remaining = count_q.scalar_one()
        if remaining == 0:
            await self.delete_team_by_id(team_id)
        logger.info(f"User id={user.id} left team id={team_id}")
        return True

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

    async def list_all_teams(self) -> list[TeamTable]:
        stmt = select(TeamTable).options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        query = await self.async_session.execute(stmt)
        return query.scalars().all()

    async def get_team_for_user(self, user_id: int) -> TeamTable | None:
        stmt = (
            select(TeamTable)
            .join(UserInTeamTable, UserInTeamTable.team_id == TeamTable.id)
            .where(UserInTeamTable.user_id == user_id)
            .options(selectinload(TeamTable.user_associations).selectinload(UserInTeamTable.user))
        )
        query = await self.async_session.execute(stmt)
        return query.scalar()
