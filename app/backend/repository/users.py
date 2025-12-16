import typing

import sqlalchemy
from fastapi import HTTPException, status
from loguru import logger
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import functions as sqlalchemy_functions

from app.backend.db.models import UserTable
from app.backend.repository.base import BaseCRUDRepository
from app.backend.schema.users import UserInCreate, UserInUpdate
from app.backend.security.password import PasswordManager
from app.backend.utils.exceptions import DBEntityAlreadyExists, DBEntityDoesNotExist


class UserCRUDRepository(BaseCRUDRepository):
    def __init__(self, async_session: AsyncSession, pwd_manager: PasswordManager):
        super().__init__(async_session)
        self.pwd_manager = pwd_manager

    # -----------------------------
    # CREATE ACCOUNT (SECURE)
    # -----------------------------
    async def create_account(self, account_create: UserInCreate) -> UserTable | None:
        """
        Creates a new user account securely.
        Returns:
            - UserTable instance if success
            - None if username/email already in use (IntegrityError)
        """

        try:
            # Secure password hashing (argon2id + pepper)
            hashed_pwd = self.pwd_manager.hash_password(account_create.password)

            new_account = UserTable(
                username=account_create.username,
                email=account_create.email,
                hashed_password=hashed_pwd,
            )

            self.async_session.add(new_account)
            await self.async_session.commit()
            await self.async_session.refresh(new_account)

            logger.info(f"Account created: username={new_account.username}, email={new_account.email}")

            return new_account

        except IntegrityError:
            # Roll back failed transaction
            await self.async_session.rollback()

            # Do NOT log specific email/username - prevents enumeration
            logger.warning("Account creation failed due to duplicate username/email.")

            return None

    # -----------------------------
    async def read_accounts(self) -> typing.Sequence[UserTable]:
        stmt = sqlalchemy.select(UserTable)
        result = await self.async_session.execute(stmt)
        return result.scalars().all()

    # -----------------------------
    async def read_account_by_id(self, id_: int) -> UserTable | None:
        stmt = sqlalchemy.select(UserTable).where(UserTable.id == id_)
        result = await self.async_session.execute(stmt)
        return result.scalar()

    # -----------------------------
    async def read_account_by_username(self, username: str) -> UserTable | None:
        stmt = sqlalchemy.select(UserTable).where(UserTable.username == username)
        result = await self.async_session.execute(stmt)
        return result.scalars().first()

    # -----------------------------
    async def read_account_by_email(self, email: str) -> UserTable | None:
        stmt = sqlalchemy.select(UserTable).where(UserTable.email == email)
        result = await self.async_session.execute(stmt)
        return result.scalar()

    # -----------------------------
    # UPDATE ACCOUNT (SECURE)
    # -----------------------------
    async def update_account_by_id(self, id: int, account_update: UserInUpdate) -> UserTable:
        """
        Updates user account fields securely.
        All optional fields validated through Pydantic schema.
        Handles:
            - username update
            - email update
            - password re-hash
        """
        try:
            new_account_data = account_update.model_dump(exclude_unset=True)

            # Fetch user first
            select_stmt = sqlalchemy.select(UserTable).where(UserTable.id == id)
            query = await self.async_session.execute(select_stmt)
            update_account = query.scalar()

            if not update_account:
                raise DBEntityDoesNotExist(f"Account with id `{id}` does not exist!")

            # Begin update
            update_stmt = (
                sqlalchemy.update(UserTable).where(UserTable.id == id).values(updated_at=sqlalchemy_functions.now())
            )

            if "username" in new_account_data:
                update_stmt = update_stmt.values(username=new_account_data["username"])

            if "email" in new_account_data:
                update_stmt = update_stmt.values(email=new_account_data["email"])

            if "password" in new_account_data:
                # Secure hashing again
                hashed_password = self.pwd_manager.hash_password(new_account_data["password"])
                update_stmt = update_stmt.values(hashed_password=hashed_password)

            await self.async_session.execute(update_stmt)
            await self.async_session.commit()
            await self.async_session.refresh(update_account)

            logger.info(f"Account updated successfully (id={id}, fields={list(new_account_data.keys())})")

            return update_account

        except IntegrityError as e:
            await self.async_session.rollback()
            logger.warning("Account update failed due to duplicate email/username.")
            raise DBEntityAlreadyExists("Username or email already taken") from e

    # -----------------------------
    async def change_password_by_admin(
        self,
        user_id: int,
        new_password: str,
    ) -> None:
        user = await self.async_session.get(UserTable, user_id)

        if not user:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

        # Block password reuse
        if self.pwd_manager.verify_password(new_password, user.hashed_password):
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                "New password must be different from the current password",
            )

        user.hashed_password = self.pwd_manager.hash_password(new_password)
        await self.async_session.commit()

    # -----------------------------
    async def delete_account_by_id(self, id: int) -> None:
        # 1. Check if account exists
        select_stmt = sqlalchemy.select(UserTable).where(UserTable.id == id)
        query = await self.async_session.execute(select_stmt)
        delete_account = query.scalar()

        if not delete_account:
            raise DBEntityDoesNotExist(f"Account with id `{id}` does not exist!")

        # 2. Proper DELETE statement
        delete_stmt = sqlalchemy.delete(UserTable).where(UserTable.id == id)
        await self.async_session.execute(delete_stmt)
        await self.async_session.commit()

        logger.info(f"Account deleted (id={id})")

    # -----------------------------
    async def is_username_taken(self, username: str) -> bool:
        """Returns True if username is taken, False if available."""
        username_stmt = sqlalchemy.select(UserTable.username).where(UserTable.username == username)
        username_query = await self.async_session.execute(username_stmt)
        db_username = username_query.scalar()

        return db_username is not None

    # -----------------------------
    async def is_email_taken(self, email: str) -> bool:
        """Returns True if email is taken, False if available."""
        email_stmt = sqlalchemy.select(UserTable.email).where(UserTable.email == email)
        email_query = await self.async_session.execute(email_stmt)
        db_email = email_query.scalar()

        return db_email is not None
