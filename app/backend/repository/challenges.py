import hmac
from pathlib import Path

from loguru import logger
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.backend.db.models import ChallengeTable, UserCompletedChallengeTable
from app.backend.repository.base import BaseCRUDRepository
from app.backend.utils.flag_store import RedisFlagStore, TeamFlagStore


class ChallengesCRUDRepository(BaseCRUDRepository):
    def __init__(self, async_session: AsyncSession):
        super().__init__(async_session)

    async def list_challenges(self) -> list[ChallengeTable]:
        stmt = select(ChallengeTable)
        query = await self.async_session.execute(stmt)
        return list(query.scalars().all())

    async def read_challenge_by_id(self, challenge_id: int) -> ChallengeTable | None:
        stmt = select(ChallengeTable).where(ChallengeTable.id == challenge_id)
        query = await self.async_session.execute(stmt)
        return query.scalar()

    async def has_user_completed(self, user_id: int, challenge_id: int) -> bool:
        stmt = select(UserCompletedChallengeTable).where(
            (UserCompletedChallengeTable.user_id == user_id)
            & (UserCompletedChallengeTable.challenge_id == challenge_id)
        )
        q = await self.async_session.execute(stmt)
        return q.scalar() is not None

    async def record_completion(self, user_id: int, challenge_id: int) -> UserCompletedChallengeTable | None:
        try:
            # construct instance and set fields to satisfy static analyzers
            completion = UserCompletedChallengeTable()
            completion.user_id = user_id
            completion.challenge_id = challenge_id
            self.async_session.add(completion)
            await self.async_session.commit()
            await self.async_session.refresh(completion)
            logger.info(f"Recorded completion: user={user_id} challenge={challenge_id}")
            return completion
        except IntegrityError:
            await self.async_session.rollback()
            logger.exception("Failed to record completion due to IntegrityError")
            return None

    async def validate_flag(self, challenge: ChallengeTable, submitted_flag: str, user_id: int | None = None) -> bool:
        """
        Validate the submitted flag.
        - If user_id is provided, first check per-instance flag in Redis (spawned flag).
        - Fallback to challenge.static_flag (if you have a static flag stored in DB).
        """
        # 1) check instance-specific flag in Redis
        if user_id is not None:
            store = RedisFlagStore()
            expected = await store.get_flag(user_id, challenge.id)
            if expected:
                # constant-time compare
                return hmac.compare_digest(expected, submitted_flag)

        # 2) fallback to challenge-level flag (if applicable)
        static_flag = challenge.flag
        if static_flag:
            return hmac.compare_digest(static_flag, submitted_flag)

        # no known flag
        return False

    def _read_expected_flag_from_disk(self, challenge: ChallengeTable) -> str | None:
        """Try to read a flag/secret from the challenge directory on disk.
        The repository searches common filenames in the challenges folder.
        Returns flag string (stripped) or None if not found.
        """
        # challenge.path is expected to be a relative folder under the top-level challenges/ directory
        candidates = ["secret.txt", "flag.txt", "secret", "flag"]
        base_dir = Path(__file__).resolve().parents[2] / "challenges"
        if challenge.path:
            challenge_dir = base_dir / challenge.path
        else:
            challenge_dir = base_dir / (challenge.name if challenge.name else "")

        if not challenge_dir.exists():
            return None

        for fname in candidates:
            fpath = challenge_dir / fname
            if fpath.exists() and fpath.is_file():
                try:
                    return fpath.read_text(encoding="utf-8").strip()
                except Exception:
                    continue
        return None

    async def validate_flag_team(self, challenge: ChallengeTable, submitted_flag: str, team_id: int) -> bool:
        """
        Validate a submitted flag for a team-scoped instance.
        - First check per-team Redis flag.
        - Fallback to static flag stored in DB (if any).
        """
        store = TeamFlagStore()
        expected = await store.get_flag(team_id, challenge.id)
        if expected:
            return hmac.compare_digest(expected, submitted_flag)

        static_flag = challenge.flag
        if static_flag:
            return hmac.compare_digest(static_flag, submitted_flag)

        return False

    async def get_user_solved_ids(self, user_id: int) -> list[int]:
        stmt = select(UserCompletedChallengeTable.challenge_id).where(UserCompletedChallengeTable.user_id == user_id)
        res = await self.async_session.execute(stmt)
        return [int(x) for x in res.scalars().all()]

    async def get_user_total_score(self, user_id: int) -> int:
        stmt = (
            select(func.coalesce(func.sum(ChallengeTable.points), 0))
            .select_from(UserCompletedChallengeTable)
            .join(ChallengeTable, UserCompletedChallengeTable.challenge_id == ChallengeTable.id)
            .where(UserCompletedChallengeTable.user_id == user_id)
        )
        res = await self.async_session.execute(stmt)
        return int(res.scalar_one() or 0)

    async def list_user_solves_with_challenge(self, user_id: int):
        stmt = (
            select(
                UserCompletedChallengeTable.challenge_id,
                UserCompletedChallengeTable.completed_at,
                ChallengeTable.name,
                ChallengeTable.category,
                ChallengeTable.points,
            )
            .select_from(UserCompletedChallengeTable)
            .join(ChallengeTable, ChallengeTable.id == UserCompletedChallengeTable.challenge_id)
            .where(UserCompletedChallengeTable.user_id == user_id)
            .order_by(UserCompletedChallengeTable.completed_at.asc())
        )

        res = await self.async_session.execute(stmt)
        return res.all()
