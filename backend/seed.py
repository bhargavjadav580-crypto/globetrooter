"""Seed the app's OWN records only (demo users + demo trips/sections).
Real-world place/food/attraction data is never seeded — it is fetched live."""
import asyncio
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv(Path(__file__).parent / ".env")
client = AsyncIOMotorClient(os.environ["MONGO_URL"])
db = client[os.environ["DB_NAME"]]


def iso():
    return datetime.now(timezone.utc).isoformat()


async def main():
    admin_id = "user_demoadmin01"
    trav_id = "user_demotravel1"
    await db.users.update_one({"user_id": admin_id}, {"$set": {
        "user_id": admin_id, "email": "admin@globetrotter.app", "name": "Demo Admin",
        "first_name": "Demo", "last_name": "Admin", "username": "admin",
        "phone": "+91 90000 00000", "city": "Ahmedabad", "country": "India",
        "additional_info": "Platform administrator.",
        "picture": "https://i.pravatar.cc/150?img=12", "photo_url": "https://i.pravatar.cc/150?img=12",
        "is_admin": True, "profile_complete": True, "created_at": iso()}}, upsert=True)
    await db.users.update_one({"user_id": trav_id}, {"$set": {
        "user_id": trav_id, "email": "traveler@globetrotter.app", "name": "Aanya Rao",
        "first_name": "Aanya", "last_name": "Rao", "username": "aanya",
        "phone": "+91 98888 88888", "city": "Mumbai", "country": "India",
        "additional_info": "Loves mountains and street food.",
        "picture": "https://i.pravatar.cc/150?img=45", "photo_url": "https://i.pravatar.cc/150?img=45",
        "is_admin": False, "profile_complete": True, "created_at": iso()}}, upsert=True)

    # Sample trips for demo traveler (own records; real coords are geographic facts, not curated POIs)
    samples = [
        {"name": "Goa Beach Escape", "sp": "Mumbai", "sp_ll": (19.0760, 72.8777),
         "dest": "Goa", "dest_ll": (15.2993, 74.1240), "sd": "2025-02-10", "ed": "2025-02-15",
         "budget": 45000, "cover": "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg"},
        {"name": "Rajasthan Heritage Run", "sp": "Ahmedabad", "sp_ll": (23.0225, 72.5714),
         "dest": "Jaipur", "dest_ll": (26.9124, 75.7873), "sd": "2026-08-01", "ed": "2026-08-07",
         "budget": 60000, "cover": "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg"},
        {"name": "Himalayan Getaway", "sp": "Delhi", "sp_ll": (28.6139, 77.2090),
         "dest": "Manali", "dest_ll": (32.2396, 77.1887), "sd": "2026-12-20", "ed": "2026-12-27",
         "budget": 55000, "cover": "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg"},
    ]
    await db.trips.delete_many({"user_id": trav_id})
    for s in samples:
        tid = str(uuid.uuid4())
        await db.trips.insert_one({
            "id": tid, "user_id": trav_id, "name": s["name"],
            "starting_point": s["sp"], "starting_point_place_id": None,
            "start_lat": s["sp_ll"][0], "start_lon": s["sp_ll"][1],
            "destination": s["dest"], "destination_place_id": None,
            "dest_lat": s["dest_ll"][0], "dest_lon": s["dest_ll"][1],
            "start_date": s["sd"], "end_date": s["ed"], "total_budget": s["budget"],
            "distance_km": None, "travel_time_minutes": None, "route_geometry": None,
            "cover_image": s["cover"], "trip_score": None, "travel_load": None,
            "is_public": False, "public_slug": None, "created_at": iso()})

    print("Seeded users:", await db.users.count_documents({}), "trips:", await db.trips.count_documents({}))
    client.close()


if __name__ == "__main__":
    asyncio.run(main())
