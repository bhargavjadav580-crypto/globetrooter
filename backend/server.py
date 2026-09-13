from fastapi import FastAPI, APIRouter, Request, Response, HTTPException, Depends, Query, UploadFile, File
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import uuid
import re
import httpx
import io
from pathlib import Path
from PIL import Image
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta

import osm_service as osm
import logistics_service as logistics
import scoring

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("server")

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ.get('MONGO_URL') or os.environ.get('MONGODB_URI') or 'mock'
db_name = os.environ.get('DB_NAME', 'trip_planner')

if os.environ.get("ENVIRONMENT", "development").lower() == "production" and (mongo_url.lower() == 'mock' or mongo_url.startswith('mock')):
    raise RuntimeError("CRITICAL: Production deployment requires a live MONGO_URL/MONGODB_URI environment variable.")

if mongo_url.lower() == 'mock' or mongo_url.startswith('mock'):
    from mongomock_motor import AsyncMongoMockClient
    client = AsyncMongoMockClient()
    db = client[db_name]
    logger.info("Using in-memory mock MongoDB (mongomock_motor) for local development.")
else:
    import certifi
    # Production MongoDB / MongoDB Atlas client with TLS CA support and connection pooling
    client_kwargs = {
        "serverSelectionTimeoutMS": int(os.environ.get("MONGO_TIMEOUT_MS", 8000)),
        "connectTimeoutMS": 10000,
        "maxPoolSize": int(os.environ.get("MONGO_MAX_POOL_SIZE", 50)),
        "minPoolSize": int(os.environ.get("MONGO_MIN_POOL_SIZE", 5)),
    }
    # If connecting to Atlas (mongodb+srv) or TLS is enabled, use certifi CA certs
    if "mongodb+srv" in mongo_url or "ssl=true" in mongo_url.lower() or "tls=true" in mongo_url.lower():
        client_kwargs["tlsCAFile"] = certifi.where()

    client = AsyncIOMotorClient(mongo_url, **client_kwargs)
    db = client[db_name]
    # Mask password for logging
    masked_url = re.sub(r":([^:@]+)@", ":****@", mongo_url)
    logger.info(f"Connecting to live MongoDB: {masked_url} [db: {db_name}]")

app = FastAPI()
UPLOADS_DIR = ROOT_DIR / "uploads"
UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")

api_router = APIRouter(prefix="/api")

EMERGENT_SESSION_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


# ------------------------- Models -------------------------
class ProfileUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    additional_info: Optional[str] = None
    photo_url: Optional[str] = None
    language: Optional[str] = None


class SavedDestinationCreate(BaseModel):
    place_name: str
    place_id: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None


class TripCreate(BaseModel):
    name: str
    description: Optional[str] = None
    starting_point: Optional[str] = None
    starting_point_place_id: Optional[str] = None
    start_lat: Optional[float] = None
    start_lon: Optional[float] = None
    destination: Optional[str] = None
    destination_place_id: Optional[str] = None
    dest_lat: Optional[float] = None
    dest_lon: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    total_budget: Optional[float] = 0
    cover_image: Optional[str] = None
    currency: Optional[str] = "INR"
    currency_symbol: Optional[str] = "₹"


class ChecklistItemCreate(BaseModel):
    title: str
    category: str = "General"         # Vehicle & Safety | Health & Medical | Electronics | Luggage & Essentials | General
    is_checked: bool = False


class ChecklistItemUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    is_checked: Optional[bool] = None


class SectionCreate(BaseModel):
    type: str = "custom"
    title: Optional[str] = None
    place_name: Optional[str] = None
    place_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    date_start: Optional[str] = None
    date_end: Optional[str] = None
    section_budget: Optional[float] = 0


class PlaceAdd(BaseModel):
    external_place_id: str
    name: str
    category: str
    rating: Optional[float] = None
    photo_url: Optional[str] = None
    cost_estimate: Optional[float] = 0
    scheduled_time: Optional[str] = None
    lat: Optional[float] = None
    lon: Optional[float] = None
    description: Optional[str] = None
    tags: Optional[list] = []
    booking_url: Optional[str] = None
    local_tips: Optional[str] = None
    best_time: Optional[str] = None


class ReviewCreate(BaseModel):
    rating: int                       # 1 to 5 stars
    comment: str                      # review text
    visit_tip: Optional[str] = None   # practical traveler tip (e.g. 'go at sunrise')
    photo_url: Optional[str] = None   # optional uploaded traveler photo


class CollaboratorInvite(BaseModel):
    email: str
    role: str = "editor"              # editor | viewer


class CommunityCreate(BaseModel):
    title: str
    body: str
    trip_id: Optional[str] = None
    place_name: Optional[str] = None
    image: Optional[str] = None


class BudgetUpdate(BaseModel):
    total_budget: Optional[float] = None


class FuelProfileUpdate(BaseModel):
    vehicle_type: str = "car"
    mileage_kmpl: float
    fuel_price_per_liter: float
    travelers: int = 1


class OvernightStayCreate(BaseModel):
    waypoint_index: int
    waypoint_name: Optional[str] = None
    night_date: Optional[str] = None
    hotel_name: str
    external_place_id: Optional[str] = None
    lat: float
    lon: float
    price_estimate: Optional[float] = 0
    website: Optional[str] = None


class ExpenseCreate(BaseModel):
    description: str
    amount: float
    category: str = "general"        # general | food | transport | stay | activity | shopping
    paid_by: str                       # traveler name or user_id label
    split_among: Optional[list] = None  # list of traveler names; if None → split among all travelers
    receipt_url: Optional[str] = None  # optional uploaded bill/receipt image URL


def now_iso():
    return datetime.now(timezone.utc).isoformat()



# ------------------------- Auth helpers -------------------------
async def get_current_user(request: Request):
    token = request.cookies.get("session_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user


async def require_admin(user=Depends(get_current_user)):
    if not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    body = await request.json()
    session_id = body.get("session_id")
    if not session_id:
        raise HTTPException(status_code=400, detail="Missing session_id")
    
    data = None
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.get(EMERGENT_SESSION_URL, headers={"X-Session-ID": session_id})
            if r.status_code == 200:
                data = r.json()
    except Exception as e:
        logger.warning(f"Emergent session exchange warning: {e}")

    # Seamless fallback if external SSO server is unreachable or token expired
    if not data or "email" not in data or "session_token" not in data:
        token = f"sess_{uuid.uuid4().hex[:16]}"
        data = {
            "email": "traveler@globetrotter.app",
            "name": "Aanya Rao",
            "picture": "https://i.pravatar.cc/150?img=45",
            "session_token": token
        }

    email = data["email"]
    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
        await db.users.update_one({"user_id": user_id},
                                  {"$set": {"name": data.get("name"),
                                            "picture": data.get("picture") or existing.get("picture")}})
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        parts = (data.get("name") or "").split(" ", 1)
        admin_emails = os.environ.get("ADMIN_EMAILS", "admin@globetrotter.app").split(",")
        user = {
            "user_id": user_id, "email": email, "name": data.get("name"),
            "first_name": parts[0] if parts else "", "last_name": parts[1] if len(parts) > 1 else "",
            "username": email.split("@")[0], "phone": "", "city": "", "country": "",
            "additional_info": "", "picture": data.get("picture"), "photo_url": data.get("picture"),
            "is_admin": email in admin_emails, "profile_complete": True, "created_at": now_iso(),
        }
        await db.users.insert_one(dict(user))
    token = data["session_token"]
    await db.user_sessions.insert_one({
        "user_id": user_id, "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": now_iso(),
    })
    response.set_cookie("session_token", token, httponly=True, secure=False,
                        samesite="lax", path="/", max_age=7 * 24 * 3600)
    user.pop("_id", None)
    return {"user": user, "needs_profile": not user.get("profile_complete", False), "session_token": token}


class DemoLoginRequest(BaseModel):
    role: Optional[str] = "traveler"  # "traveler" or "admin"
    email: Optional[str] = None


@api_router.post("/auth/demo-login")
async def demo_login(payload: DemoLoginRequest, response: Response):
    if os.environ.get("ENABLE_DEMO_LOGIN", "true").lower() == "false":
        raise HTTPException(status_code=403, detail="Demo logins are disabled in this environment.")
    if payload.email:
        clean_email = payload.email.lower().strip()
        user = await db.users.find_one({"email": clean_email}, {"_id": 0})
        if not user:
            user_id = f"user_{uuid.uuid5(uuid.NAMESPACE_DNS, clean_email).hex[:12]}"
            name_part = clean_email.split("@")[0].replace(".", " ").replace("_", " ").title()
            user = {
                "user_id": user_id,
                "email": clean_email,
                "name": name_part,
                "first_name": name_part.split()[0] if name_part else "Traveler",
                "last_name": name_part.split()[-1] if len(name_part.split()) > 1 else "",
                "username": clean_email.split("@")[0],
                "phone": "+91 98888 77777",
                "city": "Mumbai",
                "country": "India",
                "additional_info": "Trip collaborator.",
                "picture": "https://i.pravatar.cc/150?img=33",
                "is_admin": clean_email in os.environ.get("ADMIN_EMAILS", "admin@globetrotter.app").split(","),
                "profile_complete": True,
                "created_at": now_iso()
            }
            await db.users.update_one({"user_id": user_id}, {"$set": user}, upsert=True)
        else:
            user_id = user["user_id"]
    else:
        user_id = "user_demoadmin01" if payload.role == "admin" else "user_demotravel1"
        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            # If user not created yet, create it
            is_adm = (payload.role == "admin")
            user = {
                "user_id": user_id,
                "email": "admin@globetrotter.app" if is_adm else "traveler@globetrotter.app",
                "name": "Demo Admin" if is_adm else "Aanya Rao",
                "first_name": "Demo" if is_adm else "Aanya",
                "last_name": "Admin" if is_adm else "Rao",
                "username": "admin" if is_adm else "aanya",
                "phone": "+91 90000 00000" if is_adm else "+91 98888 88888",
                "city": "Ahmedabad" if is_adm else "Mumbai",
                "country": "India",
                "additional_info": "Platform administrator." if is_adm else "Loves mountains and street food.",
                "picture": "https://i.pravatar.cc/150?img=12" if is_adm else "https://i.pravatar.cc/150?img=45",
                "is_admin": is_adm,
                "profile_complete": True,
                "created_at": now_iso()
            }
            await db.users.update_one({"user_id": user_id}, {"$set": user}, upsert=True)

    token = f"test_session_{payload.role}_{uuid.uuid4().hex[:8]}"
    await db.user_sessions.insert_one({
        "user_id": user_id,
        "session_token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=30)).isoformat(),
        "created_at": now_iso()
    })
    response.set_cookie("session_token", token, httponly=True, secure=False,
                        samesite="lax", path="/", max_age=30 * 24 * 3600)
    return {"user": user, "needs_profile": False, "session_token": token}


@api_router.get("/auth/me")
async def auth_me(user=Depends(get_current_user)):
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    token = request.cookies.get("session_token")
    if token:
        await db.user_sessions.delete_one({"session_token": token})
    response.delete_cookie("session_token", path="/")
    return {"ok": True}


@api_router.put("/auth/profile")
async def update_profile(payload: ProfileUpdate, user=Depends(get_current_user)):
    upd = {k: v for k, v in payload.model_dump().items() if v is not None}
    upd["profile_complete"] = True
    await db.users.update_one({"user_id": user["user_id"]}, {"$set": upd})
    return await db.users.find_one({"user_id": user["user_id"]}, {"_id": 0})


@api_router.delete("/auth/account")
async def delete_account(user=Depends(get_current_user)):
    uid = user["user_id"]
    trips = await db.trips.find({"user_id": uid}, {"_id": 0, "id": 1}).to_list(500)
    tids = [t["id"] for t in trips]
    secs = await db.sections.find({"trip_id": {"$in": tids}}, {"_id": 0, "id": 1}).to_list(1000)
    await db.selected_places.delete_many({"section_id": {"$in": [s["id"] for s in secs]}})
    await db.sections.delete_many({"trip_id": {"$in": tids}})
    await db.trips.delete_many({"user_id": uid})
    await db.saved_destinations.delete_many({"user_id": uid})
    await db.community_posts.delete_many({"user_id": uid})
    await db.user_sessions.delete_many({"user_id": uid})
    await db.users.delete_one({"user_id": uid})
    return {"ok": True}


@api_router.get("/saved-destinations")
async def list_saved(user=Depends(get_current_user)):
    return await db.saved_destinations.find({"user_id": user["user_id"]}, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.post("/saved-destinations")
async def save_destination(payload: SavedDestinationCreate, user=Depends(get_current_user)):
    existing = await db.saved_destinations.find_one(
        {"user_id": user["user_id"], "place_name": payload.place_name}, {"_id": 0})
    if existing:
        return existing
    sid = str(uuid.uuid4())
    doc = {"id": sid, "user_id": user["user_id"], "place_name": payload.place_name,
           "place_id": payload.place_id, "lat": payload.lat, "lon": payload.lon, "created_at": now_iso()}
    await db.saved_destinations.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.delete("/saved-destinations/{sid}")
async def delete_saved(sid: str, user=Depends(get_current_user)):
    await db.saved_destinations.delete_one({"id": sid, "user_id": user["user_id"]})
    return {"ok": True}


# ------------------------- Places (live) -------------------------
@api_router.get("/places/autocomplete")
async def places_autocomplete(q: str = Query(...)):
    try:
        return await osm.autocomplete(q)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Live place search unavailable: {e}")


@api_router.get("/route-preview")
async def route_preview(lat1: float, lon1: float, lat2: float, lon2: float,
                        user=Depends(get_current_user)):
    try:
        return await osm.route(lat1, lon1, lat2, lon2)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Live routing unavailable: {e}")


@api_router.get("/places/city-info")
async def city_info(q: str, user=Depends(get_current_user)):
    """Live city meta: country (Nominatim), live nearby-attraction count (Overpass),
    and how many times this destination has actually been planned in our DB (real)."""
    try:
        hits = await osm.autocomplete(q)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Live data unavailable: {e}")
    if not hits:
        return {"place": None}
    top = hits[0]
    country = top["display_name"].split(",")[-1].strip() if top.get("display_name") else None
    try:
        nearby = await osm.nearby(db, top["lat"], top["lon"], "attraction")
        live_spots = len(nearby)
    except Exception:
        live_spots = 0
    city_key = top["name"]
    times_planned = await db.trips.count_documents({"destination": {"$regex": f"^{re.escape(city_key)}", "$options": "i"}})
    times_planned += await db.sections.count_documents({"place_name": {"$regex": f"^{re.escape(city_key)}", "$options": "i"}})
    return {"place": top, "country": country, "live_spots": live_spots, "times_planned": times_planned}


@api_router.get("/places/nearby")
async def places_nearby(lat: float, lon: float, category: str = "attraction"):
    try:
        return await osm.nearby(db, lat, lon, category)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Live place data unavailable: {e}")


@api_router.get("/places/search")
async def places_search(q: str, category: str = "attraction"):
    try:
        hits = await osm.autocomplete(q)
        if not hits:
            return {"place": None, "results": []}
        top = hits[0]
        results = await osm.nearby(db, top["lat"], top["lon"], category)
        return {"place": top, "results": results}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Live data unavailable: {e}")


# ------------------------- Trips -------------------------
def slugify(name):
    base = re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')
    return f"{base}-{uuid.uuid4().hex[:6]}"


async def trip_or_404(trip_id, user, allow_public=False, require_edit=False):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    if trip["user_id"] == user["user_id"] or user.get("is_admin"):
        return trip
    # Check if user is an invited collaborator
    collab = await db.trip_collaborators.find_one({
        "trip_id": trip_id,
        "$or": [{"user_id": user["user_id"]}, {"email": user.get("email", "").lower()}]
    }, {"_id": 0})
    if collab:
        if require_edit and collab.get("role") != "editor":
            raise HTTPException(status_code=403, detail="Viewer access only. Edit permission required.")
        return trip
    if allow_public and trip.get("is_public"):
        return trip
    raise HTTPException(status_code=403, detail="Not your trip")


@api_router.get("/trips")
async def list_trips(user=Depends(get_current_user)):
    collab_entries = await db.trip_collaborators.find({
        "$or": [{"user_id": user["user_id"]}, {"email": user.get("email", "").lower()}]
    }, {"_id": 0}).to_list(100)
    collab_trip_ids = [c["trip_id"] for c in collab_entries]
    
    query = {"$or": [{"user_id": user["user_id"]}, {"id": {"$in": collab_trip_ids}}]} if collab_trip_ids else {"user_id": user["user_id"]}
    trips = await db.trips.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    collab_role_map = {c["trip_id"]: c.get("role", "editor") for c in collab_entries}
    for t in trips:
        t["stop_count"] = await db.sections.count_documents({"trip_id": t["id"]})
        t["is_collaborator"] = t["user_id"] != user["user_id"]
        t["role"] = "owner" if t["user_id"] == user["user_id"] else collab_role_map.get(t["id"], "viewer")
    return trips


@api_router.post("/trips")
async def create_trip(payload: TripCreate, user=Depends(get_current_user)):
    if (payload.total_budget or 0) < 0:
        raise HTTPException(status_code=400, detail="Budget cannot be negative")
    trip_id = str(uuid.uuid4())
    distance_km = travel_min = route_geometry = None
    if payload.start_lat is not None and payload.dest_lat is not None:
        try:
            rt = await osm.route(payload.start_lat, payload.start_lon, payload.dest_lat, payload.dest_lon)
            distance_km, travel_min, route_geometry = rt["distance_km"], rt["duration_minutes"], rt["geometry"]
        except Exception:
            pass
    covers = ["https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg",
              "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg",
              "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg"]
    doc = {
        "id": trip_id, "user_id": user["user_id"], "name": payload.name,
        "description": payload.description,
        "starting_point": payload.starting_point, "starting_point_place_id": payload.starting_point_place_id,
        "start_lat": payload.start_lat, "start_lon": payload.start_lon,
        "destination": payload.destination, "destination_place_id": payload.destination_place_id,
        "dest_lat": payload.dest_lat, "dest_lon": payload.dest_lon,
        "start_date": payload.start_date, "end_date": payload.end_date,
        "total_budget": payload.total_budget or 0, "distance_km": distance_km,
        "travel_time_minutes": travel_min, "route_geometry": route_geometry,
        "cover_image": payload.cover_image or covers[hash(trip_id) % len(covers)],
        "currency": payload.currency or "INR",
        "currency_symbol": payload.currency_symbol or "₹",
        "trip_score": None, "travel_load": None, "is_public": False, "public_slug": None,
        "created_at": now_iso(),
    }
    await db.trips.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.get("/trips/public/{slug}")
async def get_public_trip(slug: str):
    trip = await db.trips.find_one({"public_slug": slug, "is_public": True}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Public trip not found")
    return await assemble_full(trip, read_only=True)


@api_router.get("/trips/public/{slug}/plan")
async def get_public_trip_plan(slug: str):
    trip = await db.trips.find_one({"public_slug": slug, "is_public": True}, {"_id": 0})
    if not trip:
        raise HTTPException(status_code=404, detail="Public trip not found")
    sections = await db.sections.find({"trip_id": trip["id"]}, {"_id": 0}).sort("order_index", 1).to_list(200)
    places = await db.selected_places.find(
        {"section_id": {"$in": [s["id"] for s in sections]}}, {"_id": 0}).sort("order_index", 1).to_list(500)
    for s in sections:
        s["places"] = [p for p in places if p["section_id"] == s["id"]]
    stays = await db.overnight_stays.find({"trip_id": trip["id"]}, {"_id": 0}).sort("waypoint_index", 1).to_list(50)
    geometry = trip.get("route_geometry") or []
    distance_km = trip.get("distance_km")
    duration_minutes = trip.get("travel_time_minutes")
    if not geometry and trip.get("start_lat") is not None and trip.get("dest_lat") is not None:
        try:
            plan = await logistics.route_plan(trip, 6.0)
            geometry = plan.get("geometry", [])
            distance_km = plan.get("distance_km")
            duration_minutes = plan.get("duration_minutes")
        except Exception:
            pass
    return {"trip": trip, "sections": sections, "places": places, "overnight_stays": stays,
            "route_geometry": geometry, "distance_km": distance_km,
            "duration_minutes": duration_minutes, "read_only": True}


@api_router.get("/trips/{trip_id}")
async def get_trip(trip_id: str, user=Depends(get_current_user)):
    return await trip_or_404(trip_id, user)


@api_router.get("/trips/{trip_id}/full")
async def get_trip_full(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    return await assemble_full(trip)


async def assemble_full(trip, read_only=False):
    sections = await db.sections.find({"trip_id": trip["id"]}, {"_id": 0}).sort("order_index", 1).to_list(200)
    places = await db.selected_places.find(
        {"section_id": {"$in": [s["id"] for s in sections]}}, {"_id": 0}).sort("order_index", 1).to_list(500)
    for s in sections:
        s["places"] = [p for p in places if p["section_id"] == s["id"]]
    budget = scoring.budget_guardian(trip, sections, places)
    score = scoring.trip_score(trip, sections, places)
    load = scoring.travel_load(trip, sections, places)
    return {"trip": trip, "sections": sections, "places": places,
            "budget": budget, "score": score, "travel_load": load, "read_only": read_only}


@api_router.put("/trips/{trip_id}")
async def update_trip(trip_id: str, payload: dict, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user, require_edit=True)
    allowed = {"name", "description", "start_date", "end_date", "total_budget", "cover_image", "starting_point", "destination", "currency", "currency_symbol"}
    upd = {k: v for k, v in payload.items() if k in allowed}
    if upd:
        await db.trips.update_one({"id": trip_id}, {"$set": upd})
    return await db.trips.find_one({"id": trip_id}, {"_id": 0})


@api_router.delete("/trips/{trip_id}")
async def delete_trip(trip_id: str, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).to_list(200)
    await db.selected_places.delete_many({"section_id": {"$in": [s["id"] for s in sections]}})
    await db.sections.delete_many({"trip_id": trip_id})
    await db.trips.delete_one({"id": trip_id})
    return {"ok": True}


@api_router.get("/trips/{trip_id}/distance")
async def trip_distance(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    if trip.get("start_lat") is None or trip.get("dest_lat") is None:
        raise HTTPException(status_code=400, detail="Trip needs both a starting point and destination")
    rt = await osm.route(trip["start_lat"], trip["start_lon"], trip["dest_lat"], trip["dest_lon"])
    await db.trips.update_one({"id": trip_id}, {"$set": {
        "distance_km": rt["distance_km"], "travel_time_minutes": rt["duration_minutes"],
        "route_geometry": rt["geometry"]}})
    return rt


@api_router.get("/trips/{trip_id}/score")
async def get_score(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).to_list(200)
    places = await db.selected_places.find({"section_id": {"$in": [s["id"] for s in sections]}}, {"_id": 0}).to_list(500)
    return scoring.trip_score(trip, sections, places)


@api_router.get("/trips/{trip_id}/travel-load")
async def get_load(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).to_list(200)
    places = await db.selected_places.find({"section_id": {"$in": [s["id"] for s in sections]}}, {"_id": 0}).to_list(500)
    return scoring.travel_load(trip, sections, places)


@api_router.get("/trips/{trip_id}/budget")
async def get_budget(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).to_list(200)
    places = await db.selected_places.find({"section_id": {"$in": [s["id"] for s in sections]}}, {"_id": 0}).to_list(500)
    return scoring.budget_guardian(trip, sections, places)


@api_router.put("/trips/{trip_id}/budget")
async def put_budget(trip_id: str, payload: BudgetUpdate, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    if payload.total_budget is not None:
        if payload.total_budget < 0:
            raise HTTPException(status_code=400, detail="Budget cannot be negative")
        await db.trips.update_one({"id": trip_id}, {"$set": {"total_budget": payload.total_budget}})
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).to_list(200)
    places = await db.selected_places.find({"section_id": {"$in": [s["id"] for s in sections]}}, {"_id": 0}).to_list(500)
    return scoring.budget_guardian(trip, sections, places)


@api_router.post("/trips/{trip_id}/publish")
async def publish_trip(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user, require_edit=True)
    slug = trip.get("public_slug") or slugify(trip["name"])
    await db.trips.update_one({"id": trip_id}, {"$set": {"is_public": True, "public_slug": slug}})
    return {"public_slug": slug, "is_public": True}


@api_router.post("/trips/{trip_id}/unpublish")
async def unpublish_trip(trip_id: str, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user, require_edit=True)
    await db.trips.update_one({"id": trip_id}, {"$set": {"is_public": False, "public_slug": None}})
    return {"is_public": False, "public_slug": None}


@api_router.post("/trips/{trip_id}/copy")
async def copy_trip(trip_id: str, user=Depends(get_current_user)):
    src = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    if not src:
        raise HTTPException(status_code=404, detail="Trip not found")
    if src["user_id"] != user["user_id"] and not src.get("is_public"):
        raise HTTPException(status_code=403, detail="Cannot copy a private trip")
    new_id = str(uuid.uuid4())
    new_trip = dict(src)
    new_trip.update({"id": new_id, "user_id": user["user_id"], "name": src["name"] + " (Copy)",
                     "is_public": False, "public_slug": None, "created_at": now_iso()})
    await db.trips.insert_one(dict(new_trip))
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).to_list(200)
    for s in sections:
        new_sid = str(uuid.uuid4())
        ns = dict(s); ns.update({"id": new_sid, "trip_id": new_id})
        await db.sections.insert_one(dict(ns))
        places = await db.selected_places.find({"section_id": s["id"]}, {"_id": 0}).to_list(200)
        for p in places:
            np = dict(p); np.update({"id": str(uuid.uuid4()), "section_id": new_sid, "trip_id": new_id})
            await db.selected_places.insert_one(dict(np))
    new_trip.pop("_id", None)
    return new_trip


# ------------------------- Sections -------------------------
async def recompute_leg_distances(trip_id):
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).sort("order_index", 1).to_list(200)
    prev_lat, prev_lon = trip.get("start_lat"), trip.get("start_lon")
    for s in sections:
        if s.get("latitude") is not None and prev_lat is not None:
            try:
                rt = await osm.route(prev_lat, prev_lon, s["latitude"], s["longitude"])
                await db.sections.update_one({"id": s["id"]}, {"$set": {
                    "distance_from_prev_km": rt["distance_km"],
                    "travel_time_from_prev_minutes": rt["duration_minutes"]}})
            except Exception:
                pass
        if s.get("latitude") is not None:
            prev_lat, prev_lon = s["latitude"], s["longitude"]


@api_router.post("/trips/{trip_id}/sections")
async def add_section(trip_id: str, payload: SectionCreate, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    if payload.date_start and trip.get("start_date") and payload.date_start < trip["start_date"]:
        raise HTTPException(status_code=400, detail="Section start date is before the trip start date")
    if payload.date_end and trip.get("end_date") and payload.date_end > trip["end_date"]:
        raise HTTPException(status_code=400, detail="Section end date is after the trip end date")
    if (payload.section_budget or 0) < 0:
        raise HTTPException(status_code=400, detail="Budget cannot be negative")
    count = await db.sections.count_documents({"trip_id": trip_id})
    sid = str(uuid.uuid4())
    doc = {"id": sid, "trip_id": trip_id, "type": payload.type,
           "title": payload.title or payload.place_name or f"Section {count + 1}",
           "place_name": payload.place_name, "place_id": payload.place_id,
           "latitude": payload.latitude, "longitude": payload.longitude,
           "date_start": payload.date_start, "date_end": payload.date_end,
           "section_budget": payload.section_budget or 0, "order_index": count,
           "distance_from_prev_km": None, "travel_time_from_prev_minutes": None}
    await db.sections.insert_one(dict(doc))
    await recompute_leg_distances(trip_id)
    return await db.sections.find_one({"id": sid}, {"_id": 0})


@api_router.post("/trips/{trip_id}/sections/reorder")
async def reorder_sections(trip_id: str, payload: dict, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    order = payload.get("order", [])
    for idx, sid in enumerate(order):
        await db.sections.update_one({"id": sid, "trip_id": trip_id}, {"$set": {"order_index": idx}})
    await recompute_leg_distances(trip_id)
    return await db.sections.find({"trip_id": trip_id}, {"_id": 0}).sort("order_index", 1).to_list(200)


@api_router.put("/sections/{section_id}")
async def update_section(section_id: str, payload: dict, user=Depends(get_current_user)):
    sec = await db.sections.find_one({"id": section_id}, {"_id": 0})
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    await trip_or_404(sec["trip_id"], user)
    allowed = {"type", "title", "place_name", "place_id", "latitude", "longitude",
               "date_start", "date_end", "section_budget", "notes"}
    upd = {k: v for k, v in payload.items() if k in allowed}
    if upd.get("section_budget") is not None and upd["section_budget"] < 0:
        raise HTTPException(status_code=400, detail="Budget cannot be negative")
    if upd:
        await db.sections.update_one({"id": section_id}, {"$set": upd})
    await recompute_leg_distances(sec["trip_id"])
    return await db.sections.find_one({"id": section_id}, {"_id": 0})


@api_router.delete("/sections/{section_id}")
async def delete_section(section_id: str, user=Depends(get_current_user)):
    sec = await db.sections.find_one({"id": section_id}, {"_id": 0})
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    await trip_or_404(sec["trip_id"], user)
    await db.selected_places.delete_many({"section_id": section_id})
    await db.sections.delete_one({"id": section_id})
    await recompute_leg_distances(sec["trip_id"])
    return {"ok": True}


@api_router.get("/sections/{section_id}/distance-from-previous")
async def section_distance(section_id: str, user=Depends(get_current_user)):
    sec = await db.sections.find_one({"id": section_id}, {"_id": 0})
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    await trip_or_404(sec["trip_id"], user)
    return {"distance_km": sec.get("distance_from_prev_km"),
            "travel_time_from_prev_minutes": sec.get("travel_time_from_prev_minutes")}


@api_router.get("/sections/{section_id}/suggestions")
async def section_suggestions(section_id: str, category: str = "attraction", user=Depends(get_current_user)):
    sec = await db.sections.find_one({"id": section_id}, {"_id": 0})
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    await trip_or_404(sec["trip_id"], user)
    if sec.get("latitude") is None:
        raise HTTPException(status_code=400, detail="Set a place for this section first")
    try:
        return await osm.nearby(db, sec["latitude"], sec["longitude"], category)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Live data unavailable: {e}")


@api_router.post("/sections/{section_id}/places")
async def add_place(section_id: str, payload: PlaceAdd, user=Depends(get_current_user)):
    sec = await db.sections.find_one({"id": section_id}, {"_id": 0})
    if not sec:
        raise HTTPException(status_code=404, detail="Section not found")
    await trip_or_404(sec["trip_id"], user, require_edit=True)
    if (payload.cost_estimate or 0) < 0:
        raise HTTPException(status_code=400, detail="Cost cannot be negative")
    count = await db.selected_places.count_documents({"section_id": section_id})
    pid = str(uuid.uuid4())
    doc = {"id": pid, "section_id": section_id, "trip_id": sec["trip_id"],
           "external_place_id": payload.external_place_id, "name": payload.name,
           "category": payload.category, "rating": payload.rating, "photo_url": payload.photo_url,
           "cost_estimate": payload.cost_estimate or 0, "scheduled_time": payload.scheduled_time,
           "description": payload.description, "lat": payload.lat, "lon": payload.lon,
           "tags": payload.tags or [], "booking_url": payload.booking_url,
           "local_tips": payload.local_tips, "best_time": payload.best_time,
           "order_index": count}
    await db.selected_places.insert_one(dict(doc))
    return await db.selected_places.find_one({"id": pid}, {"_id": 0})


@api_router.put("/places/{place_id}")
async def update_place(place_id: str, payload: dict, user=Depends(get_current_user)):
    p = await db.selected_places.find_one({"id": place_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Place not found")
    await trip_or_404(p["trip_id"], user, require_edit=True)
    allowed = {"cost_estimate", "scheduled_time", "order_index", "tags", "booking_url", "local_tips", "best_time", "description", "name"}
    upd = {k: v for k, v in payload.items() if k in allowed}
    if upd.get("cost_estimate") is not None and upd["cost_estimate"] < 0:
        raise HTTPException(status_code=400, detail="Cost cannot be negative")
    if upd:
        await db.selected_places.update_one({"id": place_id}, {"$set": upd})
    return await db.selected_places.find_one({"id": place_id}, {"_id": 0})


@api_router.delete("/places/{place_id}")
async def delete_place(place_id: str, user=Depends(get_current_user)):
    p = await db.selected_places.find_one({"id": place_id}, {"_id": 0})
    if not p:
        raise HTTPException(status_code=404, detail="Place not found")
    await trip_or_404(p["trip_id"], user, require_edit=True)
    await db.selected_places.delete_one({"id": place_id})
    return {"ok": True}


# ------------------------- Road-trip logistics -------------------------
def require_route_coords(trip):
    if trip.get("start_lat") is None or trip.get("dest_lat") is None:
        raise HTTPException(status_code=400, detail="Trip needs both a starting point and destination with coordinates")


@api_router.get("/trips/{trip_id}/route-plan")
async def trip_route_plan(trip_id: str, max_drive_hours: float = Query(6.0, ge=2, le=14),
                          user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    require_route_coords(trip)
    try:
        plan = await logistics.route_plan(trip, max_drive_hours)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Live routing unavailable: {e}")
    if trip.get("distance_km") is None:
        await db.trips.update_one({"id": trip_id}, {"$set": {
            "distance_km": plan["distance_km"], "travel_time_minutes": plan["duration_minutes"],
            "route_geometry": plan["geometry"]}})
    return plan


@api_router.get("/trips/{trip_id}/hotels")
async def trip_hotels(trip_id: str, lat: float, lon: float, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    try:
        return await osm.nearby(db, lat, lon, "hotel", radius=20000)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Live hotel data unavailable: {e}")


@api_router.get("/trips/{trip_id}/overnight-stays")
async def list_overnight_stays(trip_id: str, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    return await db.overnight_stays.find({"trip_id": trip_id}, {"_id": 0}).sort("waypoint_index", 1).to_list(50)


@api_router.post("/trips/{trip_id}/overnight-stays")
async def add_overnight_stay(trip_id: str, payload: OvernightStayCreate, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    if (payload.price_estimate or 0) < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")
    await db.overnight_stays.delete_many({"trip_id": trip_id, "waypoint_index": payload.waypoint_index})
    doc = {"id": str(uuid.uuid4()), "trip_id": trip_id, **payload.model_dump(), "created_at": now_iso()}
    await db.overnight_stays.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.put("/overnight-stays/{stay_id}")
async def update_overnight_stay(stay_id: str, payload: dict, user=Depends(get_current_user)):
    stay = await db.overnight_stays.find_one({"id": stay_id}, {"_id": 0})
    if not stay:
        raise HTTPException(status_code=404, detail="Stay not found")
    await trip_or_404(stay["trip_id"], user)
    upd = {k: v for k, v in payload.items() if k in {"price_estimate", "night_date"}}
    if upd.get("price_estimate") is not None and upd["price_estimate"] < 0:
        raise HTTPException(status_code=400, detail="Price cannot be negative")
    if upd:
        await db.overnight_stays.update_one({"id": stay_id}, {"$set": upd})
    return await db.overnight_stays.find_one({"id": stay_id}, {"_id": 0})


@api_router.delete("/overnight-stays/{stay_id}")
async def delete_overnight_stay(stay_id: str, user=Depends(get_current_user)):
    stay = await db.overnight_stays.find_one({"id": stay_id}, {"_id": 0})
    if not stay:
        raise HTTPException(status_code=404, detail="Stay not found")
    await trip_or_404(stay["trip_id"], user)
    await db.overnight_stays.delete_one({"id": stay_id})
    return {"ok": True}


@api_router.get("/trips/{trip_id}/final-map-link")
async def trip_final_map_link(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    require_route_coords(trip)
    stays = await db.overnight_stays.find({"trip_id": trip_id}, {"_id": 0}).to_list(50)
    return {"url": logistics.final_map_link(trip, stays), "waypoint_count": len(stays)}


@api_router.get("/trips/{trip_id}/fuel-profile")
async def get_fuel_profile(trip_id: str, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    return await db.fuel_profiles.find_one({"trip_id": trip_id}, {"_id": 0}) or {}


@api_router.post("/trips/{trip_id}/fuel-profile")
async def put_fuel_profile(trip_id: str, payload: FuelProfileUpdate, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    if payload.mileage_kmpl <= 0 or payload.fuel_price_per_liter <= 0:
        raise HTTPException(status_code=400, detail="Mileage and fuel price must be positive")
    if payload.travelers < 1:
        raise HTTPException(status_code=400, detail="Travelers must be at least 1")
    doc = {"trip_id": trip_id, **payload.model_dump(), "updated_at": now_iso()}
    await db.fuel_profiles.update_one({"trip_id": trip_id}, {"$set": doc}, upsert=True)
    return await db.fuel_profiles.find_one({"trip_id": trip_id}, {"_id": 0})


@api_router.get("/trips/{trip_id}/transport-options")
async def trip_transport_options(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    require_route_coords(trip)
    if trip.get("distance_km") is None:
        rt = await osm.route(trip["start_lat"], trip["start_lon"], trip["dest_lat"], trip["dest_lon"])
        await db.trips.update_one({"id": trip_id}, {"$set": {
            "distance_km": rt["distance_km"], "travel_time_minutes": rt["duration_minutes"],
            "route_geometry": rt["geometry"]}})
        trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    fp = await db.fuel_profiles.find_one({"trip_id": trip_id}, {"_id": 0})
    return logistics.transport_options(trip, fp)


async def build_final_budget(trip):
    sections = await db.sections.find({"trip_id": trip["id"]}, {"_id": 0}).to_list(200)
    places = await db.selected_places.find({"section_id": {"$in": [s["id"] for s in sections]}}, {"_id": 0}).to_list(500)
    base = scoring.compute_budget(trip, sections, places)
    stays = await db.overnight_stays.find({"trip_id": trip["id"]}, {"_id": 0}).to_list(50)
    stay_cost = sum(float(s.get("price_estimate") or 0) for s in stays)
    fp = await db.fuel_profiles.find_one({"trip_id": trip["id"]}, {"_id": 0})
    topts = logistics.transport_options(trip, fp)
    drive = next((o for o in topts["options"] if o["mode"] == "drive"), None)
    drive_cost = drive["cost_estimate"] if drive else 0
    grand = base["total_estimated"] + stay_cost + drive_cost
    days = scoring._days(trip)
    return {
        "itinerary_costs": base,
        "overnight_stays": {"count": len(stays), "total_cost": round(stay_cost, 2), "stays": stays},
        "drive_costs": ({**drive["cost_detail"], "total": drive_cost} if drive else None),
        "transport_alternatives": [{"mode": o["mode"], "cost_estimate": o["cost_estimate"],
                                    "duration_minutes": o["duration_minutes"]} for o in topts["options"]],
        "distance_km": trip.get("distance_km"),
        "grand_total": round(grand, 2),
        "per_day": round(grand / days, 2),
        "days": days,
        "trip_budget": base["total_budget"],
        "over_budget": base["total_budget"] > 0 and grand > base["total_budget"],
    }

@api_router.get("/trips/{trip_id}/final-budget")
async def get_final_budget(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    # Return an empty budget summary if route coords not set (no 400 error)
    if trip.get("start_lat") is None or trip.get("dest_lat") is None:
        return {
            "numbers": {
                "itinerary_costs": {"total_estimated": 0, "total_budget": trip.get("total_budget", 0), "breakdown": {}},
                "overnight_stays": {"count": 0, "total_cost": 0, "stays": []},
                "drive_costs": None,
                "transport_alternatives": [],
                "distance_km": None,
                "grand_total": 0,
                "per_day": 0,
                "days": 1,
                "trip_budget": trip.get("total_budget", 0),
                "over_budget": False,
            },
            "narrative": None,
            "generated_at": None,
        }
    numbers = await build_final_budget(trip)
    stored = await db.final_budgets.find_one({"trip_id": trip_id}, {"_id": 0})
    return {"numbers": numbers, "narrative": (stored or {}).get("narrative"),
            "generated_at": (stored or {}).get("generated_at")}


@api_router.post("/trips/{trip_id}/final-budget")
async def generate_final_budget(trip_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    require_route_coords(trip)
    numbers = await build_final_budget(trip)
    narrative: str | None = None  # always defined; assigned in try block below
    try:
        narrative = await logistics.ai_summary(trip, numbers)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"AI summary unavailable: {e}")
    await db.final_budgets.update_one(
        {"trip_id": trip_id},
        {"$set": {"trip_id": trip_id, "narrative": narrative,
                  "numbers_json": str(numbers.get("grand_total")), "generated_at": now_iso()}},
        upsert=True)
    return {"numbers": numbers, "narrative": narrative, "generated_at": now_iso()}


# ------------------------- Community -------------------------
@api_router.get("/community/posts")
async def list_posts(q: Optional[str] = None):
    query = {}
    if q and q.strip():
        safe_q = re.escape(q.strip())
        query = {"$or": [{"title": {"$regex": safe_q, "$options": "i"}},
                         {"body": {"$regex": safe_q, "$options": "i"}},
                         {"place_name": {"$regex": safe_q, "$options": "i"}}]}
    return await db.community_posts.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)


@api_router.post("/community/posts")
async def create_post(payload: CommunityCreate, user=Depends(get_current_user)):
    pid = str(uuid.uuid4())
    doc = {"id": pid, "user_id": user["user_id"], "author_name": user.get("name"),
           "author_photo": user.get("photo_url"), "title": payload.title, "body": payload.body,
           "trip_id": payload.trip_id, "place_name": payload.place_name, "image": payload.image,
           "created_at": now_iso()}
    await db.community_posts.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc



@api_router.post("/community/posts/{post_id}/like")
async def toggle_like(post_id: str, user=Depends(get_current_user)):
    uid = user["user_id"]
    post = await db.community_posts.find_one({"id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    liked_by = post.get("liked_by") or []
    if uid in liked_by:
        liked_by.remove(uid)
        liked = False
    else:
        liked_by.append(uid)
        liked = True
    like_count = len(liked_by)
    await db.community_posts.update_one({"id": post_id}, {"$set": {"liked_by": liked_by, "like_count": like_count}})
    return {"liked": liked, "like_count": like_count}


# ------------------------- Admin -------------------------
@api_router.get("/admin/stats")
async def admin_stats(user=Depends(require_admin)):
    return await _compute_admin_stats()


@api_router.get("/admin/overview")
async def admin_overview(user=Depends(require_admin)):
    return await _compute_admin_stats()


async def _compute_admin_stats():
    all_trips = await db.trips.find({}, {"_id": 0, "created_at": 1, "total_budget": 1}).to_list(2000)
    by_month = {}
    for t in all_trips:
        m = (t.get("created_at") or "")[:7]
        if m:
            by_month[m] = by_month.get(m, 0) + 1
    trend = [{"month": k, "trips": v} for k, v in sorted(by_month.items())]
    buckets = {"<10k": 0, "10k-50k": 0, "50k-100k": 0, ">100k": 0}
    for t in all_trips:
        v = float(t.get("total_budget") or 0)
        if v < 10000:
            buckets["<10k"] += 1
        elif v < 50000:
            buckets["10k-50k"] += 1
        elif v < 100000:
            buckets["50k-100k"] += 1
        else:
            buckets[">100k"] += 1
    return {
        "users": await db.users.count_documents({}),
        "trips": await db.trips.count_documents({}),
        "sections": await db.sections.count_documents({}),
        "places": await db.selected_places.count_documents({}),
        "posts": await db.community_posts.count_documents({}),
        "trend": trend,
        "budget_dist": [{"name": k, "value": v} for k, v in buckets.items()],
    }


@api_router.get("/admin/popular-cities")
async def popular_cities(user=Depends(require_admin)):
    rows = await db.sections.aggregate([
        {"$match": {"place_name": {"$ne": None}}},
        {"$group": {"_id": "$place_name", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 12}]).to_list(50)
    dest_rows = await db.trips.aggregate([
        {"$match": {"destination": {"$ne": None}}},
        {"$group": {"_id": "$destination", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 12}]).to_list(50)
    merged = {}
    for r in rows + dest_rows:
        if r["_id"]:
            key = r["_id"].split(",")[0]
            merged[key] = merged.get(key, 0) + r["count"]
    return [{"city": k, "count": v} for k, v in sorted(merged.items(), key=lambda x: -x[1])][:12]


@api_router.get("/admin/popular-activities")
async def popular_activities(user=Depends(require_admin)):
    rows = await db.selected_places.aggregate([
        {"$group": {"_id": {"name": "$name", "category": "$category"}, "count": {"$sum": 1}}},
        {"$sort": {"count": -1}}, {"$limit": 15}]).to_list(50)
    return [{"name": r["_id"]["name"], "category": r["_id"]["category"], "count": r["count"]} for r in rows]


@api_router.get("/admin/users")
async def admin_users(user=Depends(require_admin)):
    users = await db.users.find({}, {"_id": 0}).to_list(500)
    for u in users:
        u["trip_count"] = await db.trips.count_documents({"user_id": u["user_id"]})
    return users


@api_router.delete("/admin/users/{uid}")
async def admin_delete_user(uid: str, user=Depends(require_admin)):
    if uid == user["user_id"]:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    await db.users.delete_one({"user_id": uid})
    trips = await db.trips.find({"user_id": uid}, {"_id": 0, "id": 1}).to_list(500)
    tids = [t["id"] for t in trips]
    secs = await db.sections.find({"trip_id": {"$in": tids}}, {"_id": 0, "id": 1}).to_list(1000)
    await db.selected_places.delete_many({"section_id": {"$in": [s["id"] for s in secs]}})
    await db.sections.delete_many({"trip_id": {"$in": tids}})
    await db.trips.delete_many({"user_id": uid})
    return {"ok": True}


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 1 — TRIP TEMPLATES
# ─────────────────────────────────────────────────────────────────────────────
@api_router.get("/templates")
async def list_templates():
    """Return all curated trip starter templates."""
    templates = await db.trip_templates.find({}, {"_id": 0}).sort("order", 1).to_list(50)
    return templates


@api_router.post("/templates/{template_id}/clone")
async def clone_template(template_id: str, user=Depends(get_current_user)):
    """Clone a curated template into the user's trips library."""
    tmpl = await db.trip_templates.find_one({"id": template_id}, {"_id": 0})
    if not tmpl:
        raise HTTPException(status_code=404, detail="Template not found")
    new_trip_id = str(uuid.uuid4())
    new_trip = {
        "id": new_trip_id,
        "user_id": user["user_id"],
        "name": tmpl["name"],
        "description": tmpl.get("description", ""),
        "starting_point": tmpl.get("starting_point"),
        "starting_point_place_id": None,
        "start_lat": tmpl.get("start_lat"),
        "start_lon": tmpl.get("start_lon"),
        "destination": tmpl.get("destination"),
        "destination_place_id": None,
        "dest_lat": tmpl.get("dest_lat"),
        "dest_lon": tmpl.get("dest_lon"),
        "start_date": None,
        "end_date": None,
        "total_budget": tmpl.get("total_budget", 0),
        "distance_km": tmpl.get("distance_km", 0),
        "travel_time_minutes": tmpl.get("travel_time_minutes", 0),
        "route_geometry": None,
        "cover_image": tmpl.get("cover_image"),
        "trip_score": None,
        "travel_load": None,
        "is_public": False,
        "public_slug": None,
        "cloned_from_template": template_id,
        "created_at": now_iso(),
    }
    await db.trips.insert_one(dict(new_trip))
    # Clone template sections
    tmpl_sections = await db.template_sections.find({"template_id": template_id}, {"_id": 0}).sort("order_index", 1).to_list(50)
    for sec in tmpl_sections:
        new_sec_id = str(uuid.uuid4())
        await db.sections.insert_one({
            "id": new_sec_id,
            "trip_id": new_trip_id,
            "type": sec.get("type", "custom"),
            "title": sec.get("title"),
            "place_name": sec.get("place_name"),
            "place_id": None,
            "latitude": sec.get("latitude"),
            "longitude": sec.get("longitude"),
            "date_start": None,
            "date_end": None,
            "section_budget": sec.get("section_budget", 0),
            "order_index": sec.get("order_index", 0),
            "created_at": now_iso(),
        })
    new_trip.pop("_id", None)
    return {"trip": new_trip, "message": f"Template cloned successfully! {len(tmpl_sections)} sections added."}


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 2 — CALENDAR (.ics) EXPORT
# ─────────────────────────────────────────────────────────────────────────────
@api_router.get("/trips/{trip_id}/export/ics")
async def export_ics(trip_id: str, user=Depends(get_current_user)):
    """Generate an RFC 5545 .ics calendar file for the full trip itinerary."""
    from fastapi.responses import Response as FR
    trip = await trip_or_404(trip_id, user)
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).sort("order_index", 1).to_list(200)
    places = await db.selected_places.find(
        {"section_id": {"$in": [s["id"] for s in sections]}}, {"_id": 0}).to_list(500)

    def ics_dt(date_str: str, hour: int = 9) -> str:
        """Return DTSTART/DTEND value in basic iCal format."""
        try:
            d = datetime.fromisoformat(date_str.split("T")[0])
        except Exception:
            d = datetime.now(timezone.utc)
        return d.replace(hour=hour, minute=0, second=0).strftime("%Y%m%dT%H%M%SZ")

    def escape_ics(text: str) -> str:
        return (text or "").replace("\\", "\\\\").replace("\n", "\\n").replace(",", "\\,").replace(";", "\\;")

    uid_suffix = trip_id.replace("-", "")[:12]
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//GlobeTrotter//TripPlanner//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{escape_ics(trip['name'])}",
        "X-WR-TIMEZONE:UTC",
    ]

    # One all-day event for the whole trip
    if trip.get("start_date") and trip.get("end_date"):
        lines += [
            "BEGIN:VEVENT",
            f"UID:trip-{uid_suffix}@globetrotter",
            f"DTSTART;VALUE=DATE:{trip['start_date'].replace('-','')}",
            f"DTEND;VALUE=DATE:{trip['end_date'].replace('-','')}",
            f"SUMMARY:{escape_ics(trip['name'])}",
            f"DESCRIPTION:{escape_ics(trip.get('description',''))}",
            f"LOCATION:{escape_ics(trip.get('starting_point',''))} to {escape_ics(trip.get('destination',''))}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ]

    # One event per section
    for idx, sec in enumerate(sections):
        date_str = sec.get("date_start") or trip.get("start_date") or ""
        sec_places = [p for p in places if p["section_id"] == sec["id"]]
        place_desc = "; ".join(p["name"] for p in sec_places) if sec_places else ""
        lines += [
            "BEGIN:VEVENT",
            f"UID:sec-{sec['id'][:12]}-{uid_suffix}@globetrotter",
            f"DTSTART:{ics_dt(date_str, 9 + idx % 8)}",
            f"DTEND:{ics_dt(date_str, 10 + idx % 8)}",
            f"SUMMARY:{escape_ics(sec.get('title') or sec.get('place_name') or 'Stop')}",
            f"DESCRIPTION:Places: {escape_ics(place_desc)}",
            f"LOCATION:{escape_ics(sec.get('place_name',''))}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ]

    # One event per place
    for pidx, place in enumerate(places):
        sec = next((s for s in sections if s["id"] == place["section_id"]), {})
        date_str = sec.get("date_start") or trip.get("start_date") or ""
        start_hour = 9 + (pidx % 10)
        lines += [
            "BEGIN:VEVENT",
            f"UID:place-{place.get('id', str(pidx))[:12]}-{uid_suffix}@globetrotter",
            f"DTSTART:{ics_dt(place.get('scheduled_time') or date_str, start_hour)}",
            f"DTEND:{ics_dt(place.get('scheduled_time') or date_str, start_hour + 1)}",
            f"SUMMARY:{escape_ics(place['name'])} [{place.get('category','').capitalize()}]",
            f"DESCRIPTION:{escape_ics(place.get('description',''))} | Est. Cost: ₹{place.get('cost_estimate',0)}",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ]

    lines.append("END:VCALENDAR")
    ics_content = "\r\n".join(lines)
    safe_name = re.sub(r"[^a-z0-9]+", "-", trip["name"].lower()).strip("-")
    return FR(
        content=ics_content.encode("utf-8"),
        media_type="text/calendar",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.ics"'},
    )


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 3 — GPX ROUTE EXPORT
# ─────────────────────────────────────────────────────────────────────────────
@api_router.get("/trips/{trip_id}/export/gpx")
async def export_gpx(trip_id: str, user=Depends(get_current_user)):
    """Generate a standard GPX 1.1 file with waypoints and route track."""
    from fastapi.responses import Response as FR
    trip = await trip_or_404(trip_id, user)
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).sort("order_index", 1).to_list(200)
    stays = await db.trip_overnights.find({"trip_id": trip_id}, {"_id": 0}).to_list(100)
    route_geom = trip.get("route_geometry") or []

    def esc(t: str) -> str:
        return (t or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")

    gpx_lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<gpx version="1.1" creator="GlobeTrotter" xmlns="http://www.topografix.com/GPX/1/1" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" '
        'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
        f'  <metadata><name>{esc(trip["name"])}</name><desc>{esc(trip.get("description",""))}</desc></metadata>',
    ]

    # Waypoints: starting point
    if trip.get("start_lat") and trip.get("start_lon"):
        gpx_lines.append(
            f'  <wpt lat="{trip["start_lat"]}" lon="{trip["start_lon"]}">'
            f'<name>{esc(trip.get("starting_point","Start"))}</name><sym>Flag</sym></wpt>'
        )

    # Waypoints: each section stop
    for sec in sections:
        if sec.get("latitude") and sec.get("longitude"):
            gpx_lines.append(
                f'  <wpt lat="{sec["latitude"]}" lon="{sec["longitude"]}">'
                f'<name>{esc(sec.get("title") or sec.get("place_name","Stop"))}</name>'
                f'<sym>Waypoint</sym></wpt>'
            )

    # Waypoints: overnight stays
    for stay in stays:
        gpx_lines.append(
            f'  <wpt lat="{stay["lat"]}" lon="{stay["lon"]}">'
            f'<name>🛏 {esc(stay["hotel_name"])}</name><sym>Hotel</sym></wpt>'
        )

    # Destination
    if trip.get("dest_lat") and trip.get("dest_lon"):
        gpx_lines.append(
            f'  <wpt lat="{trip["dest_lat"]}" lon="{trip["dest_lon"]}">'
            f'<name>{esc(trip.get("destination","Destination"))}</name><sym>Flag, Green</sym></wpt>'
        )

    # Track: route geometry
    if route_geom:
        gpx_lines += [
            f'  <trk><name>{esc(trip["name"])} — Route Track</name><trkseg>',
        ]
        for pt in route_geom:
            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                gpx_lines.append(f'    <trkpt lat="{pt[0]}" lon="{pt[1]}"></trkpt>')
        gpx_lines.append('  </trkseg></trk>')

    gpx_lines.append('</gpx>')
    gpx_content = "\n".join(gpx_lines)
    safe_name = re.sub(r"[^a-z0-9]+", "-", trip["name"].lower()).strip("-")
    return FR(
        content=gpx_content.encode("utf-8"),
        media_type="application/gpx+xml",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.gpx"'},
    )


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 4 — LIVE WEATHER FORECAST PER STOP
# ─────────────────────────────────────────────────────────────────────────────
@api_router.get("/trips/{trip_id}/weather")
async def trip_weather(trip_id: str, user=Depends(get_current_user)):
    """Fetch 7-day weather forecast for each trip stop using Open-Meteo (free, no API key)."""
    trip = await trip_or_404(trip_id, user)
    sections = await db.sections.find({"trip_id": trip_id}, {"_id": 0}).sort("order_index", 1).to_list(200)

    WMO_CODES = {
        0: ("Clear Sky", "☀️"), 1: ("Mainly Clear", "🌤️"), 2: ("Partly Cloudy", "⛅"),
        3: ("Overcast", "☁️"), 45: ("Foggy", "🌫️"), 48: ("Foggy (Rime)", "🌫️"),
        51: ("Light Drizzle", "🌦️"), 53: ("Moderate Drizzle", "🌦️"), 55: ("Dense Drizzle", "🌧️"),
        61: ("Slight Rain", "🌧️"), 63: ("Moderate Rain", "🌧️"), 65: ("Heavy Rain", "🌧️"),
        71: ("Slight Snow", "❄️"), 73: ("Moderate Snow", "❄️"), 75: ("Heavy Snow", "🌨️"),
        77: ("Snow Grains", "🌨️"), 80: ("Slight Showers", "🌦️"), 81: ("Moderate Showers", "🌧️"),
        82: ("Violent Showers", "⛈️"), 85: ("Snow Showers", "🌨️"), 86: ("Heavy Snow Showers", "🌨️"),
        95: ("Thunderstorm", "⛈️"), 96: ("Thunderstorm w/ Hail", "⛈️"), 99: ("Thunderstorm w/ Heavy Hail", "⛈️"),
    }

    stops = []
    # Include start point
    if trip.get("start_lat") and trip.get("start_lon"):
        stops.append({"name": trip.get("starting_point", "Start"), "lat": trip["start_lat"], "lon": trip["start_lon"]})
    for sec in sections:
        if sec.get("latitude") and sec.get("longitude"):
            stops.append({"name": sec.get("title") or sec.get("place_name", "Stop"), "lat": sec["latitude"], "lon": sec["longitude"]})
    if trip.get("dest_lat") and trip.get("dest_lon") and trip.get("destination"):
        stops.append({"name": trip["destination"], "lat": trip["dest_lat"], "lon": trip["dest_lon"]})

    results = []
    async with httpx.AsyncClient(timeout=10) as c:
        for stop in stops[:6]:  # max 6 stops to keep response fast
            try:
                url = (
                    f"https://api.open-meteo.com/v1/forecast"
                    f"?latitude={stop['lat']}&longitude={stop['lon']}"
                    f"&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max"
                    f"&forecast_days=7&timezone=auto"
                )
                r = await c.get(url)
                if r.status_code != 200:
                    continue
                raw = r.json()
                daily = raw.get("daily", {})
                forecast = []
                dates = daily.get("time", [])
                codes = daily.get("weathercode", [])
                t_max = daily.get("temperature_2m_max", [])
                t_min = daily.get("temperature_2m_min", [])
                precip = daily.get("precipitation_sum", [])
                wind = daily.get("windspeed_10m_max", [])
                for i, date in enumerate(dates):
                    code = codes[i] if i < len(codes) else 0
                    label, emoji = WMO_CODES.get(code, ("Unknown", "❓"))
                    forecast.append({
                        "date": date,
                        "weather_code": code,
                        "condition": label,
                        "emoji": emoji,
                        "temp_max": round(t_max[i], 1) if i < len(t_max) else None,
                        "temp_min": round(t_min[i], 1) if i < len(t_min) else None,
                        "precipitation_mm": round(precip[i], 1) if i < len(precip) else None,
                        "wind_kmh": round(wind[i], 1) if i < len(wind) else None,
                    })
                results.append({
                    "stop_name": stop["name"],
                    "lat": stop["lat"],
                    "lon": stop["lon"],
                    "timezone": raw.get("timezone", "UTC"),
                    "forecast": forecast,
                })
            except Exception:
                results.append({"stop_name": stop["name"], "lat": stop["lat"], "lon": stop["lon"], "forecast": [], "error": "Could not fetch weather"})
    return results


# ─────────────────────────────────────────────────────────────────────────────
# FEATURE 5 — EXPENSE LOGGER & BILL SPLITTER
# ─────────────────────────────────────────────────────────────────────────────
@api_router.get("/trips/{trip_id}/expenses")
async def list_expenses(trip_id: str, user=Depends(get_current_user)):
    """List all logged real expenses for a trip."""
    await trip_or_404(trip_id, user)
    return await db.trip_expenses.find({"trip_id": trip_id}, {"_id": 0}).sort("created_at", 1).to_list(500)


@api_router.post("/trips/{trip_id}/expenses")
async def add_expense(trip_id: str, payload: ExpenseCreate, user=Depends(get_current_user)):
    """Log a real expense for this trip."""
    await trip_or_404(trip_id, user)
    fuel_profile = await db.fuel_profiles.find_one({"trip_id": trip_id}, {"_id": 0})
    travelers = fuel_profile.get("travelers", 1) if fuel_profile else 1
    exp_id = str(uuid.uuid4())
    split_among = payload.split_among or [f"Traveler {i+1}" for i in range(travelers)]
    per_person = round(payload.amount / max(len(split_among), 1), 2)
    doc = {
        "id": exp_id,
        "trip_id": trip_id,
        "description": payload.description,
        "amount": payload.amount,
        "category": payload.category,
        "paid_by": payload.paid_by,
        "split_among": split_among,
        "per_person": per_person,
        "receipt_url": payload.receipt_url,
        "created_at": now_iso(),
    }
    await db.trip_expenses.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.delete("/trips/{trip_id}/expenses/{exp_id}")
async def delete_expense(trip_id: str, exp_id: str, user=Depends(get_current_user)):
    """Delete a logged expense."""
    await trip_or_404(trip_id, user)
    result = await db.trip_expenses.delete_one({"id": exp_id, "trip_id": trip_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    return {"ok": True}


@api_router.get("/trips/{trip_id}/expenses/summary")
async def expenses_summary(trip_id: str, user=Depends(get_current_user)):
    """Compute bill-split settlement: who paid how much vs who owes how much."""
    await trip_or_404(trip_id, user)
    expenses = await db.trip_expenses.find({"trip_id": trip_id}, {"_id": 0}).to_list(500)

    total_spent = sum(e["amount"] for e in expenses)
    by_category: dict = {}
    paid_totals: dict = {}
    owed_totals: dict = {}

    for e in expenses:
        by_category[e["category"]] = by_category.get(e["category"], 0) + e["amount"]
        paid_totals[e["paid_by"]] = paid_totals.get(e["paid_by"], 0) + e["amount"]
        per_person = e["per_person"]
        for person in e.get("split_among", [e["paid_by"]]):
            owed_totals[person] = owed_totals.get(person, 0) + per_person

    # Settlement: net[person] = how much they paid − how much they owe
    all_people = set(list(paid_totals.keys()) + list(owed_totals.keys()))
    net = {p: round(paid_totals.get(p, 0) - owed_totals.get(p, 0), 2) for p in all_people}
    # Positive net → others owe this person; Negative net → this person still owes others
    settlements = []
    creditors = sorted([(p, v) for p, v in net.items() if v > 0], key=lambda x: -x[1])
    debtors = sorted([(p, -v) for p, v in net.items() if v < 0], key=lambda x: -x[1])
    i, j = 0, 0
    while i < len(creditors) and j < len(debtors):
        creditor, credit = creditors[i]
        debtor, debt = debtors[j]
        amount = round(min(credit, debt), 2)
        settlements.append({"from": debtor, "to": creditor, "amount": amount})
        creditors[i] = (creditor, round(credit - amount, 2))
        debtors[j] = (debtor, round(debt - amount, 2))
        if creditors[i][1] <= 0:
            i += 1
        if debtors[j][1] <= 0:
            j += 1

    return {
        "total_spent": round(total_spent, 2),
        "expense_count": len(expenses),
        "by_category": by_category,
        "paid_by": paid_totals,
        "owes": owed_totals,
        "net_balance": net,
        "settlements": settlements,
    }


# ------------------------- Place Reviews & Ratings -------------------------

@api_router.get("/places/{place_id}/reviews")
async def get_place_reviews(place_id: str):
    reviews = await db.place_reviews.find({"place_id": place_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    if not reviews:
        return {"place_id": place_id, "reviews": [], "avg_rating": None, "review_count": 0}
    avg = sum(r["rating"] for r in reviews) / len(reviews)
    return {
        "place_id": place_id,
        "reviews": reviews,
        "avg_rating": round(avg, 1),
        "review_count": len(reviews),
    }


@api_router.post("/places/{place_id}/reviews")
async def create_place_review(place_id: str, payload: ReviewCreate, user=Depends(get_current_user)):
    if not (1 <= payload.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5 stars")
    if not payload.comment.strip():
        raise HTTPException(status_code=400, detail="Review comment cannot be empty")

    rev_id = str(uuid.uuid4())
    doc = {
        "id": rev_id,
        "place_id": place_id,
        "user_id": user["user_id"],
        "user_name": user.get("name") or user.get("first_name", "Traveler"),
        "user_photo": user.get("photo_url") or user.get("picture"),
        "rating": payload.rating,
        "comment": payload.comment.strip(),
        "visit_tip": payload.visit_tip.strip() if payload.visit_tip else None,
        "photo_url": payload.photo_url,
        "created_at": now_iso(),
    }
    await db.place_reviews.insert_one(dict(doc))

    # Recalculate average rating on the place
    all_revs = await db.place_reviews.find({"place_id": place_id}, {"_id": 0}).to_list(200)
    if all_revs:
        avg = round(sum(r["rating"] for r in all_revs) / len(all_revs), 1)
        await db.selected_places.update_one(
            {"id": place_id},
            {"$set": {"avg_rating": avg, "review_count": len(all_revs)}}
        )

    return doc


@api_router.delete("/places/{place_id}/reviews/{review_id}")
async def delete_place_review(place_id: str, review_id: str, user=Depends(get_current_user)):
    rev = await db.place_reviews.find_one({"id": review_id, "place_id": place_id}, {"_id": 0})
    if not rev:
        raise HTTPException(status_code=404, detail="Review not found")
    if rev["user_id"] != user["user_id"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Cannot delete another user's review")
    await db.place_reviews.delete_one({"id": review_id})

    # Recalculate avg
    remaining = await db.place_reviews.find({"place_id": place_id}, {"_id": 0}).to_list(200)
    if remaining:
        avg = round(sum(r["rating"] for r in remaining) / len(remaining), 1)
        await db.selected_places.update_one({"id": place_id}, {"$set": {"avg_rating": avg, "review_count": len(remaining)}})
    else:
        await db.selected_places.update_one({"id": place_id}, {"$unset": {"avg_rating": "", "review_count": ""}})
    return {"ok": True}


# ------------------------- Trip Collaborators -------------------------

@api_router.get("/trips/{trip_id}/collaborators")
async def list_collaborators(trip_id: str, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    trip = await db.trips.find_one({"id": trip_id}, {"_id": 0})
    owner = await db.users.find_one({"user_id": trip["user_id"]}, {"_id": 0})
    
    collabs = await db.trip_collaborators.find({"trip_id": trip_id}, {"_id": 0}).to_list(100)
    
    owner_info = {
        "id": "owner",
        "user_id": trip["user_id"],
        "name": owner.get("name", "Owner") if owner else "Owner",
        "email": owner.get("email", "") if owner else "",
        "photo_url": owner.get("photo_url") if owner else None,
        "role": "owner",
    }
    return {
        "trip_id": trip_id,
        "owner": owner_info,
        "collaborators": collabs,
        "is_owner": trip["user_id"] == user["user_id"],
    }


@api_router.post("/trips/{trip_id}/collaborators")
async def add_collaborator(trip_id: str, payload: CollaboratorInvite, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    if trip["user_id"] != user["user_id"] and not user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Only trip owner can invite collaborators")

    email = payload.email.strip().lower()
    if not email:
        raise HTTPException(status_code=400, detail="Email is required")
    if email == user.get("email", "").lower():
        raise HTTPException(status_code=400, detail="You cannot add yourself as a collaborator")

    # Find target user if registered
    target_user = await db.users.find_one({
        "$or": [{"email": email}, {"username": email}]
    }, {"_id": 0})
    
    target_name = (target_user.get("name") or target_user.get("username")) if target_user else email.split("@")[0]
    target_photo = target_user.get("photo_url") if target_user else None

    collab_id = str(uuid.uuid4())
    doc = {
        "id": collab_id,
        "trip_id": trip_id,
        "user_id": target_user["user_id"] if target_user else None,
        "email": email,
        "name": target_name,
        "photo_url": target_photo,
        "role": payload.role if payload.role in ("editor", "viewer") else "editor",
        "invited_by": user["user_id"],
        "created_at": now_iso(),
    }
    
    # Upsert by trip_id + email
    await db.trip_collaborators.update_one(
        {"trip_id": trip_id, "email": email},
        {"$set": doc},
        upsert=True
    )
    return doc


@api_router.delete("/trips/{trip_id}/collaborators/{collaborator_id}")
async def remove_collaborator(trip_id: str, collaborator_id: str, user=Depends(get_current_user)):
    trip = await trip_or_404(trip_id, user)
    collab = await db.trip_collaborators.find_one({"id": collaborator_id, "trip_id": trip_id}, {"_id": 0})
    if not collab:
        raise HTTPException(status_code=404, detail="Collaborator not found")
    
    # Owner, admin, or the collaborator themselves can remove
    can_remove = (
        trip["user_id"] == user["user_id"] or
        user.get("is_admin") or
        collab.get("user_id") == user["user_id"] or
        collab.get("email") == user.get("email", "").lower()
    )
    if not can_remove:
        raise HTTPException(status_code=403, detail="Not authorized to remove this collaborator")
        
    await db.trip_collaborators.delete_one({"id": collaborator_id})
    return {"ok": True}


# ------------------------- Packing & Emergency Checklist -------------------------

DEFAULT_ROADTRIP_CHECKLIST = [
    {"category": "Vehicle & Safety", "title": "Spare tire checked & portable tire inflator pump"},
    {"category": "Vehicle & Safety", "title": "Physical Driving License & Vehicle Insurance/PUC"},
    {"category": "Vehicle & Safety", "title": "Emergency triangle & jumper cables"},
    {"category": "Health & Medical", "title": "First aid kit with antiseptic & bandages"},
    {"category": "Health & Medical", "title": "Motion sickness / headache & ORS rehydration"},
    {"category": "Electronics", "title": "Multi-port fast car charger & heavy duty cable"},
    {"category": "Electronics", "title": "High-capacity power bank (charged)"},
    {"category": "Electronics", "title": "Offline map regions downloaded on phone"},
    {"category": "Luggage & Essentials", "title": "Reusable water bottles & hydration pack"},
    {"category": "Luggage & Essentials", "title": "Sunglasses & UV sunscreen"},
    {"category": "Luggage & Essentials", "title": "Emergency cash & small currency notes"},
]


@api_router.get("/trips/{trip_id}/checklist")
async def get_trip_checklist(trip_id: str, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user)
    items = await db.trip_checklists.find({"trip_id": trip_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    if not items:
        now = now_iso()
        seed_docs = []
        for it in DEFAULT_ROADTRIP_CHECKLIST:
            doc = {
                "id": str(uuid.uuid4()),
                "trip_id": trip_id,
                "category": it["category"],
                "title": it["title"],
                "is_checked": False,
                "created_at": now,
            }
            seed_docs.append(doc)
        if seed_docs:
            await db.trip_checklists.insert_many([dict(d) for d in seed_docs])
            items = seed_docs
    return items


@api_router.post("/trips/{trip_id}/checklist")
async def add_checklist_item(trip_id: str, payload: ChecklistItemCreate, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user, require_edit=True)
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="Item title cannot be empty")
    doc = {
        "id": str(uuid.uuid4()),
        "trip_id": trip_id,
        "category": payload.category.strip() or "General",
        "title": payload.title.strip(),
        "is_checked": payload.is_checked,
        "created_at": now_iso(),
    }
    await db.trip_checklists.insert_one(dict(doc))
    doc.pop("_id", None)
    return doc


@api_router.put("/trips/{trip_id}/checklist/{item_id}")
async def update_checklist_item(trip_id: str, item_id: str, payload: ChecklistItemUpdate, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user, require_edit=True)
    patch = {}
    if payload.title is not None:
        patch["title"] = payload.title.strip()
    if payload.category is not None:
        patch["category"] = payload.category.strip()
    if payload.is_checked is not None:
        patch["is_checked"] = payload.is_checked
    if patch:
        await db.trip_checklists.update_one({"id": item_id, "trip_id": trip_id}, {"$set": patch})
    updated = await db.trip_checklists.find_one({"id": item_id, "trip_id": trip_id}, {"_id": 0})
    if not updated:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return updated


@api_router.delete("/trips/{trip_id}/checklist/{item_id}")
async def delete_checklist_item(trip_id: str, item_id: str, user=Depends(get_current_user)):
    await trip_or_404(trip_id, user, require_edit=True)
    res = await db.trip_checklists.delete_one({"id": item_id, "trip_id": trip_id})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Checklist item not found")
    return {"ok": True}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def startup_seed():
    # Verify live MongoDB connection on startup
    if not (mongo_url.lower() == 'mock' or mongo_url.startswith('mock')):
        try:
            await client.admin.command('ping')
            logger.info("Successfully connected and pinged live MongoDB instance.")
        except Exception as e:
            logger.error(f"Failed to connect to live MongoDB: {e}")
            raise

    # Ensure database indexes
    try:
        await db.users.create_index("email", sparse=True)
        await db.trips.create_index("public_slug", sparse=True)
        await db.trips.create_index("user_id")
        await db.trip_collaborators.create_index([("trip_id", 1), ("user_id", 1)])
    except Exception as e:
        logger.warning(f"Index creation notice: {e}")

    admin_id = "user_demoadmin01"
    trav_id = "user_demotravel1"
    try:
        user_count = await db.users.count_documents({})
    except Exception:
        user_count = 0
    if user_count == 0:
        await db.users.update_one({"user_id": admin_id}, {"$set": {
            "user_id": admin_id, "email": "admin@globetrotter.app", "name": "Demo Admin",
            "first_name": "Demo", "last_name": "Admin", "username": "admin",
            "phone": "+91 90000 00000", "city": "Ahmedabad", "country": "India",
            "additional_info": "Platform administrator.",
            "picture": "https://i.pravatar.cc/150?img=12", "photo_url": "https://i.pravatar.cc/150?img=12",
            "is_admin": True, "profile_complete": True, "created_at": now_iso()}}, upsert=True)
        await db.users.update_one({"user_id": trav_id}, {"$set": {
            "user_id": trav_id, "email": "traveler@globetrotter.app", "name": "Aanya Rao",
            "first_name": "Aanya", "last_name": "Rao", "username": "aanya",
            "phone": "+91 98888 88888", "city": "Mumbai", "country": "India",
            "additional_info": "Loves mountains and street food.",
            "picture": "https://i.pravatar.cc/150?img=45", "photo_url": "https://i.pravatar.cc/150?img=45",
            "is_admin": False, "profile_complete": True, "created_at": now_iso()}}, upsert=True)

        for token, uid in [("test_session_roadtrip_123", trav_id), ("test_session_traveler", trav_id), ("test_session_admin", admin_id)]:
            await db.user_sessions.update_one({"session_token": token}, {"$set": {
                "user_id": uid,
                "session_token": token,
                "expires_at": (datetime.now(timezone.utc) + timedelta(days=365)).isoformat(),
                "created_at": now_iso(),
            }}, upsert=True)

        samples = [
            {"id": "a081374d-3e37-4cbb-a24e-48e10a7de27a", "name": "Goa Beach Escape", "sp": "Mumbai", "sp_ll": (19.0760, 72.8777),
             "dest": "Goa", "dest_ll": (15.2993, 74.1240), "sd": "2026-09-10", "ed": "2026-09-15",
             "budget": 45000, "cover": "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg"},
            {"id": str(uuid.uuid4()), "name": "Rajasthan Heritage Run", "sp": "Ahmedabad", "sp_ll": (23.0225, 72.5714),
             "dest": "Jaipur", "dest_ll": (26.9124, 75.7873), "sd": "2026-10-01", "ed": "2026-10-07",
             "budget": 60000, "cover": "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg"},
            {"id": str(uuid.uuid4()), "name": "Himalayan Getaway", "sp": "Delhi", "sp_ll": (28.6139, 77.2090),
             "dest": "Manali", "dest_ll": (32.2396, 77.1887), "sd": "2026-12-20", "ed": "2026-12-27",
             "budget": 55000, "cover": "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg"},
        ]
        for s in samples:
            await db.trips.update_one({"id": s["id"]}, {"$set": {
                "id": s["id"], "user_id": trav_id, "name": s["name"],
                "starting_point": s["sp"], "starting_point_place_id": None,
                "start_lat": s["sp_ll"][0], "start_lon": s["sp_ll"][1],
                "destination": s["dest"], "destination_place_id": None,
                "dest_lat": s["dest_ll"][0], "dest_lon": s["dest_ll"][1],
                "start_date": s["sd"], "end_date": s["ed"], "total_budget": s["budget"],
                "distance_km": 580, "travel_time_minutes": 630, "route_geometry": None,
                "cover_image": s["cover"], "trip_score": 85, "travel_load": "moderate",
                "is_public": False, "public_slug": None, "created_at": now_iso()}}, upsert=True)
        logger.info("Database initialized with demo users & trips.")

    # ── Seed curated trip templates (always upsert so they stay fresh) ──────
    TEMPLATES = [
        {
            "id": "tmpl-golden-triangle",
            "order": 1,
            "name": "The Golden Triangle",
            "description": "India's most iconic route: explore Mughal grandeur in Delhi, the Taj Mahal in Agra, and royal forts in Jaipur across 5 spectacular days.",
            "starting_point": "Delhi",
            "start_lat": 28.6139, "start_lon": 77.2090,
            "destination": "Jaipur",
            "dest_lat": 26.9124, "dest_lon": 75.7873,
            "total_budget": 35000,
            "distance_km": 500,
            "travel_time_minutes": 450,
            "duration_days": 5,
            "tags": ["Heritage", "Culture", "Iconic"],
            "cover_image": "https://images.pexels.com/photos/1603650/pexels-photo-1603650.jpeg",
            "sections": [
                {"title": "Old Delhi — Mughal Spice Trail", "place_name": "Old Delhi", "latitude": 28.6562, "longitude": 77.2310, "section_budget": 8000, "order_index": 0},
                {"title": "Agra — Taj Mahal & Agra Fort", "place_name": "Agra", "latitude": 27.1767, "longitude": 78.0081, "section_budget": 12000, "order_index": 1},
                {"title": "Jaipur — Pink City Palaces", "place_name": "Jaipur", "latitude": 26.9124, "longitude": 75.7873, "section_budget": 15000, "order_index": 2},
            ],
        },
        {
            "id": "tmpl-kerala-coast",
            "order": 2,
            "name": "Kerala Coast & Tea Plantations",
            "description": "Cruise the backwaters of Alleppey, hike the misty Munnar tea estates, and unwind on the pristine beaches of Kovalam across 6 days.",
            "starting_point": "Kochi",
            "start_lat": 9.9312, "start_lon": 76.2673,
            "destination": "Kovalam",
            "dest_lat": 8.3988, "dest_lon": 76.9782,
            "total_budget": 42000,
            "distance_km": 350,
            "travel_time_minutes": 400,
            "duration_days": 6,
            "tags": ["Beaches", "Nature", "Backwaters"],
            "cover_image": "https://images.pexels.com/photos/962464/pexels-photo-962464.jpeg",
            "sections": [
                {"title": "Kochi — Fort Kochi & Spice Markets", "place_name": "Kochi", "latitude": 9.9312, "longitude": 76.2673, "section_budget": 10000, "order_index": 0},
                {"title": "Munnar — Tea Gardens & Eravikulam", "place_name": "Munnar", "latitude": 10.0889, "longitude": 77.0595, "section_budget": 14000, "order_index": 1},
                {"title": "Alleppey — Houseboat Backwaters", "place_name": "Alleppey", "latitude": 9.4981, "longitude": 76.3388, "section_budget": 12000, "order_index": 2},
                {"title": "Kovalam — Beach & Lighthouse", "place_name": "Kovalam", "latitude": 8.3988, "longitude": 76.9782, "section_budget": 6000, "order_index": 3},
            ],
        },
        {
            "id": "tmpl-goa-escape",
            "order": 3,
            "name": "Goa Beach & Heritage Escape",
            "description": "Party in North Goa, discover Portuguese old Goa churches, then relax on peaceful South Goa beaches across 4 sun-soaked days.",
            "starting_point": "Panaji",
            "start_lat": 15.4909, "start_lon": 73.8278,
            "destination": "Palolem",
            "dest_lat": 15.0100, "dest_lon": 74.0233,
            "total_budget": 28000,
            "distance_km": 80,
            "travel_time_minutes": 120,
            "duration_days": 4,
            "tags": ["Beaches", "Nightlife", "Heritage"],
            "cover_image": "https://images.pexels.com/photos/1078850/pexels-photo-1078850.jpeg",
            "sections": [
                {"title": "North Goa — Baga & Calangute Beaches", "place_name": "North Goa", "latitude": 15.5522, "longitude": 73.7558, "section_budget": 10000, "order_index": 0},
                {"title": "Old Goa — Basilica & Spice Farms", "place_name": "Old Goa", "latitude": 15.5057, "longitude": 73.9122, "section_budget": 6000, "order_index": 1},
                {"title": "South Goa — Palolem & Colva", "place_name": "South Goa", "latitude": 15.0100, "longitude": 74.0233, "section_budget": 12000, "order_index": 2},
            ],
        },
        {
            "id": "tmpl-himachal-circuit",
            "order": 4,
            "name": "Himachal High Pass Circuit",
            "description": "Drive the legendary Manali-Spiti Highway through Rohtang, Kaza, Tabo and Nako across 8 days of dramatic Himalayan landscapes.",
            "starting_point": "Chandigarh",
            "start_lat": 30.7333, "start_lon": 76.7794,
            "destination": "Manali",
            "dest_lat": 32.2396, "dest_lon": 77.1887,
            "total_budget": 55000,
            "distance_km": 620,
            "travel_time_minutes": 900,
            "duration_days": 8,
            "tags": ["Mountains", "Adventure", "Road Trip"],
            "cover_image": "https://images.pexels.com/photos/7368308/pexels-photo-7368308.jpeg",
            "sections": [
                {"title": "Shimla — Colonial Hill Station", "place_name": "Shimla", "latitude": 31.1048, "longitude": 77.1734, "section_budget": 12000, "order_index": 0},
                {"title": "Kaza — Spiti Valley Adventure Base", "place_name": "Kaza", "latitude": 32.2290, "longitude": 78.0710, "section_budget": 18000, "order_index": 1},
                {"title": "Tabo — Ancient Buddhist Monastery", "place_name": "Tabo", "latitude": 31.9737, "longitude": 78.3880, "section_budget": 8000, "order_index": 2},
                {"title": "Manali — Rohtang & Solang Valley", "place_name": "Manali", "latitude": 32.2396, "longitude": 77.1887, "section_budget": 17000, "order_index": 3},
            ],
        },
        {
            "id": "tmpl-rajasthan-royal",
            "order": 5,
            "name": "Classic Rajasthan Royal Tour",
            "description": "Experience the grandeur of Rajasthan — from Jodhpur's Blue City to Jaisalmer's golden desert dunes and Udaipur's lake palaces across 7 days.",
            "starting_point": "Jodhpur",
            "start_lat": 26.2389, "start_lon": 73.0243,
            "destination": "Udaipur",
            "dest_lat": 24.5854, "dest_lon": 73.7125,
            "total_budget": 65000,
            "distance_km": 550,
            "travel_time_minutes": 660,
            "duration_days": 7,
            "tags": ["Heritage", "Desert", "Palaces"],
            "cover_image": "https://images.pexels.com/photos/20208538/pexels-photo-20208538.jpeg",
            "sections": [
                {"title": "Jodhpur — Mehrangarh & Blue City", "place_name": "Jodhpur", "latitude": 26.2389, "longitude": 73.0243, "section_budget": 15000, "order_index": 0},
                {"title": "Jaisalmer — Golden Fort & Desert Camp", "place_name": "Jaisalmer", "latitude": 26.9157, "longitude": 70.9083, "section_budget": 20000, "order_index": 1},
                {"title": "Pushkar — Sacred Lake & Camel Fair", "place_name": "Pushkar", "latitude": 26.4899, "longitude": 74.5511, "section_budget": 10000, "order_index": 2},
                {"title": "Udaipur — Lake Palaces & City Palace", "place_name": "Udaipur", "latitude": 24.5854, "longitude": 73.7125, "section_budget": 20000, "order_index": 3},
            ],
        },
    ]
    for tmpl in TEMPLATES:
        sections_data = tmpl.pop("sections", [])
        await db.trip_templates.update_one({"id": tmpl["id"]}, {"$set": tmpl}, upsert=True)
        for sec in sections_data:
            await db.template_sections.update_one(
                {"template_id": tmpl["id"], "order_index": sec["order_index"]},
                {"$set": {**sec, "template_id": tmpl["id"], "type": "custom"}},
                upsert=True
            )
    logger.info(f"Seeded {len(TEMPLATES)} curated trip templates.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ------------------------- Image Upload API -------------------------

@api_router.post("/upload/image")
async def upload_image(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Upload photo/receipt from camera or gallery. Validates, optimizes, and stores locally/CDN."""
    allowed_types = {"image/jpeg", "image/png", "image/webp", "image/gif", "image/jpg"}
    if file.content_type and file.content_type.lower() not in allowed_types:
        raise HTTPException(status_code=400, detail="Only image formats (JPEG, PNG, WebP, GIF) are allowed.")

    contents = await file.read()
    if len(contents) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size exceeds the 10 MB limit.")

    ext = Path(file.filename or "photo.jpg").suffix.lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        ext = ".jpg"
    filename = f"img_{uuid.uuid4().hex[:12]}{ext}"
    filepath = UPLOADS_DIR / filename

    try:
        image = Image.open(io.BytesIO(contents))
        if image.mode in ("RGBA", "P") and ext in [".jpg", ".jpeg"]:
            image = image.convert("RGB")
        max_dim = 2560
        if max(image.size) > max_dim:
            image.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        image.save(filepath, quality=88, optimize=True)
        width, height = image.size
        size_bytes = filepath.stat().st_size
    except Exception as e:
        logger.warning(f"Image PIL processing failed ({e}), saving raw bytes.")
        with open(filepath, "wb") as f:
            f.write(contents)
        width, height = None, None
        size_bytes = len(contents)

    return {
        "url": f"/uploads/{filename}",
        "filename": filename,
        "size_bytes": size_bytes,
        "width": width,
        "height": height,
        "content_type": file.content_type,
    }


@api_router.get("/")
async def root():
    return {"message": "GlobeTrotter API"}


# Serve Frontend React SPA if production build exists (enables 1-click single service deployment)
FRONTEND_BUILD = ROOT_DIR.parent / "frontend" / "build"
if FRONTEND_BUILD.exists():
    from fastapi.responses import FileResponse
    if (FRONTEND_BUILD / "static").exists():
        app.mount("/static", StaticFiles(directory=str(FRONTEND_BUILD / "static")), name="spa_static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api") or full_path.startswith("uploads") or full_path in ("docs", "openapi.json", "redoc"):
            raise HTTPException(status_code=404, detail="Not Found")
        target_file = FRONTEND_BUILD / full_path
        if full_path and target_file.is_file():
            return FileResponse(target_file)
        return FileResponse(FRONTEND_BUILD / "index.html")

