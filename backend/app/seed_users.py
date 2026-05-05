"""Seed users with the three maker-checker roles."""
import asyncio
from sqlalchemy import select
from app.database import engine, Base, async_session
from app.models import User

USERS = [
    {"username": "data_entry_1", "display_name": "Rajesh Kumar",   "role": "data_entry"},
    {"username": "data_entry_2", "display_name": "Priya Sharma",   "role": "data_entry"},
    {"username": "coordinator_1", "display_name": "Amit Patel",    "role": "coordinator"},
    {"username": "coordinator_2", "display_name": "Neha Gupta",    "role": "coordinator"},
    {"username": "finance_1",    "display_name": "Suresh Mehta",   "role": "finance"},
    {"username": "finance_2",    "display_name": "Kavita Singh",   "role": "finance"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        existing = (await session.execute(select(User))).scalars().all()
        if existing:
            print("Users already seeded. Skipping.")
            return

        for u in USERS:
            session.add(User(**u))
        await session.commit()

    print(f"Seeded {len(USERS)} users.")


if __name__ == "__main__":
    asyncio.run(seed())
