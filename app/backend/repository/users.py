import typing

import sqlalchemy
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

    async def create_account(self, account_create: UserInCreate) -> UserTable | None:
        try:
            hashed_pwd = self.pwd_manager.hash_password(account_create.password)
            new_account = UserTable(
                username=account_create.username, email=account_create.email, hashed_password=hashed_pwd
            )

            self.async_session.add(instance=new_account)
            await self.async_session.commit()
            await self.async_session.refresh(instance=new_account)
            logger.info(f"Account created: username={new_account.username}, email={new_account.email}")

            return new_account
        except IntegrityError:
            await self.async_session.rollback()
            logger.error(f"Account creation failed due to IntegrityError for email={account_create.email}")
            return None

    async def read_accounts(self) -> typing.Sequence[UserTable]:
        stmt = sqlalchemy.select(UserTable)
        query = await self.async_session.execute(statement=stmt)
        return query.scalars().all()

    async def read_account_by_id(self, id_: int) -> UserTable | None:
        stmt = sqlalchemy.select(UserTable).where(UserTable.id == id_)
        query = await self.async_session.execute(statement=stmt)
        return query.scalar()

    async def read_account_by_username(self, username: str) -> UserTable | None:
        stmt = sqlalchemy.select(UserTable).where(UserTable.username == username)
        query = await self.async_session.execute(statement=stmt)
        return query.scalar()

    async def read_account_by_email(self, email: str) -> UserTable | None:
        stmt = sqlalchemy.select(UserTable).where(UserTable.email == email)
        query = await self.async_session.execute(statement=stmt)
        return query.scalar()

    async def update_account_by_id(self, id: int, account_update: UserInUpdate) -> UserTable:
        try:
            new_account_data = account_update.model_dump(exclude_unset=True)

            select_stmt = sqlalchemy.select(UserTable).where(UserTable.id == id)
            query = await self.async_session.execute(statement=select_stmt)
            update_account = query.scalar()

            if not update_account:
                raise DBEntityDoesNotExist(f"Account with id `{id}` does not exist!")

            update_stmt = (
                sqlalchemy.update(UserTable).where(UserTable.id == id).values(updated_at=sqlalchemy_functions.now())
            )

            if "username" in new_account_data:
                update_stmt = update_stmt.values(username=new_account_data["username"])

            if "email" in new_account_data:
                update_stmt = update_stmt.values(email=new_account_data["email"])

            if "password" in new_account_data:
                hashed_password = self.pwd_manager.hash_password(new_account_data["password"])
                update_stmt = update_stmt.values(hashed_password=hashed_password)

            await self.async_session.execute(statement=update_stmt)
            await self.async_session.commit()
            await self.async_session.refresh(instance=update_account)
            logger.info(f"Account updated: id={id}, fields={list(new_account_data.keys())}")

            return update_account

        except IntegrityError as e:
            await self.async_session.rollback()
            logger.error(f"Account update failed due to IntegrityError for id={id}")
            raise DBEntityAlreadyExists("Username or email already taken") from e

    async def delete_account_by_id(self, id: int) -> None:
        select_stmt = sqlalchemy.select(UserTable).where(UserTable.id == id)
        query = await self.async_session.execute(statement=select_stmt)
        delete_account = query.scalar()

        if not delete_account:
            raise DBEntityDoesNotExist(f"Account with id `{id}` does not exist!")

        stmt = sqlalchemy.delete(UserTable).where(UserTable.id == id)

        await self.async_session.execute(statement=stmt)
        await self.async_session.commit()

    async def is_username_taken(self, username: str) -> bool:
        """Returns True if username is taken, False if available."""
        username_stmt = sqlalchemy.select(UserTable.username).where(UserTable.username == username)
        username_query = await self.async_session.execute(username_stmt)
        db_username = username_query.scalar()

        return db_username is not None

    async def is_email_taken(self, email: str) -> bool:
        """Returns True if email is taken, False if available."""
        email_stmt = sqlalchemy.select(UserTable.email).where(UserTable.email == email)
        email_query = await self.async_session.execute(email_stmt)
        db_email = email_query.scalar()

        return db_email is not None
