"""
Basic typer app to operate on the database
Useful for stuff we don't want exposed APIs for
such as creating ADMIN acc
"""

import asyncio
from getpass import getpass

import typer
from sqlalchemy import select

from app.backend.db.models import RoleEnum, UserTable
from app.backend.db.session import AsyncSessionLocal
from app.backend.security.password import PasswordManager

app = typer.Typer()


async def _create_admin(username: str, email: str, password: str):
    """
    The asynchronous logic for creating the admin user.
    """
    password_manager = PasswordManager()
    hashed_password = password_manager.hash_password(password)

    admin_user = UserTable(
        username=username,
        email=email,
        hashed_password=hashed_password,
        role=RoleEnum.ADMIN,
        is_email_verified=True,
    )

    async with AsyncSessionLocal() as session:
        stmt = select(UserTable).where(UserTable.email == email)
        result = await session.execute(stmt)
        existing_user = result.scalar_one_or_none()

        if existing_user:
            typer.echo(
                typer.style(
                    f"Admin user with email '{email}' already exists.",
                    fg=typer.colors.YELLOW,
                )
            )
            return

        session.add(admin_user)
        await session.commit()
        await session.refresh(admin_user)

    typer.echo(
        typer.style(
            f"Successfully created admin user '{admin_user.username}' (ID: {admin_user.id})",
            fg=typer.colors.GREEN,
        )
    )


@app.command()
def create_admin(
    username: str = typer.Option("admin", "--username", "-u", help="The username for the admin."),
    email: str = typer.Option(..., "--email", "-e", help="The email for the admin.", prompt=True),
):
    password = getpass("Enter admin password: ")
    password_confirm = getpass("Confirm admin password: ")

    if password != password_confirm:
        typer.echo(typer.style("Passwords do not match!", fg=typer.colors.RED))
        raise typer.Exit(code=1) from None

    if not password:
        typer.echo(typer.style("Password cannot be empty.", fg=typer.colors.RED))
        raise typer.Exit(code=1) from None

    try:
        asyncio.run(_create_admin(username=username, email=email, password=password))
    except Exception as e:
        typer.echo(
            typer.style(
                f"An error occurred: {e}",
                fg=typer.colors.RED,
            )
        )
        raise typer.Exit(code=1) from None


if __name__ == "__main__":
    app()
