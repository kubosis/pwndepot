from pathlib import Path

from app.backend.db.models import ChallengeTable, UserCompletedChallengeTable
from app.backend.repository.base import BaseCRUDRepository
from loguru import logger
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession


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

    async def validate_flag(self, challenge: ChallengeTable, submitted_flag: str) -> bool:
        # prefer stored flag in DB
        if getattr(challenge, "flag", None):
            return submitted_flag.strip() == (challenge.flag or "").strip()

        expected = self._read_expected_flag_from_disk(challenge)
        if expected is None:
            # No flag available to validate
            return False
        return submitted_flag.strip() == expected.strip()
