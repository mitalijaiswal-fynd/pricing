"""Seed distributor segments and distributors."""
import asyncio
from sqlalchemy import select
from app.database import engine, Base, async_session
from app.models import Distributor, DistributorSegment


SEGMENTS = [
    {"name": "Platinum", "description": "High-volume premium distributors"},
    {"name": "Gold", "description": "Mid-volume established distributors"},
    {"name": "Silver", "description": "Growing distributors"},
    {"name": "Bronze", "description": "Newer or low-volume distributors"},
]

DISTRIBUTORS = [
    {"name": "Sharma Distributors Pvt Ltd", "code": "DIST-001", "city": "Delhi", "state": "Delhi", "region": "North", "segment": "Platinum", "phone": "9876543210"},
    {"name": "Patel Trading Co", "code": "DIST-002", "city": "Ahmedabad", "state": "Gujarat", "region": "West", "segment": "Platinum", "phone": "9876543211"},
    {"name": "Reddy Enterprises", "code": "DIST-003", "city": "Hyderabad", "state": "Telangana", "region": "South", "segment": "Gold", "phone": "9876543212"},
    {"name": "Banerjee & Sons", "code": "DIST-004", "city": "Kolkata", "state": "West Bengal", "region": "East", "segment": "Gold", "phone": "9876543213"},
    {"name": "Singh Wholesale Mart", "code": "DIST-005", "city": "Chandigarh", "state": "Punjab", "region": "North", "segment": "Gold", "phone": "9876543214"},
    {"name": "Iyer Distribution Network", "code": "DIST-006", "city": "Chennai", "state": "Tamil Nadu", "region": "South", "segment": "Silver", "phone": "9876543215"},
    {"name": "Deshmukh Traders", "code": "DIST-007", "city": "Pune", "state": "Maharashtra", "region": "West", "segment": "Silver", "phone": "9876543216"},
    {"name": "Gupta General Store", "code": "DIST-008", "city": "Lucknow", "state": "Uttar Pradesh", "region": "North", "segment": "Silver", "phone": "9876543217"},
    {"name": "Nair Trading House", "code": "DIST-009", "city": "Kochi", "state": "Kerala", "region": "South", "segment": "Bronze", "phone": "9876543218"},
    {"name": "Das Supply Chain", "code": "DIST-010", "city": "Guwahati", "state": "Assam", "region": "East", "segment": "Bronze", "phone": "9876543219"},
    {"name": "Joshi Wholesale Depot", "code": "DIST-011", "city": "Jaipur", "state": "Rajasthan", "region": "North", "segment": "Platinum", "phone": "9876543220"},
    {"name": "Kumar FMCG Distributors", "code": "DIST-012", "city": "Bengaluru", "state": "Karnataka", "region": "South", "segment": "Platinum", "phone": "9876543221"},
    {"name": "Mehta & Associates", "code": "DIST-013", "city": "Mumbai", "state": "Maharashtra", "region": "West", "segment": "Gold", "phone": "9876543222"},
    {"name": "Choudhary Supply Co", "code": "DIST-014", "city": "Patna", "state": "Bihar", "region": "East", "segment": "Silver", "phone": "9876543223"},
    {"name": "Verma Distribution Hub", "code": "DIST-015", "city": "Bhopal", "state": "Madhya Pradesh", "region": "Central", "segment": "Bronze", "phone": "9876543224"},
]


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session() as session:
        existing = (await session.execute(select(DistributorSegment))).scalars().all()
        if existing:
            print("Distributor data already seeded. Skipping.")
            return

        seg_map = {}
        for s in SEGMENTS:
            seg = DistributorSegment(name=s["name"], description=s["description"])
            session.add(seg)
            await session.flush()
            seg_map[s["name"]] = seg.id

        for d in DISTRIBUTORS:
            session.add(Distributor(
                name=d["name"], code=d["code"],
                city=d["city"], state=d["state"], region=d["region"],
                segment_id=seg_map.get(d["segment"]),
                phone=d["phone"],
            ))

        await session.commit()
    print(f"Seeded {len(SEGMENTS)} segments and {len(DISTRIBUTORS)} distributors.")


if __name__ == "__main__":
    asyncio.run(seed())
