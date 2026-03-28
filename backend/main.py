from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, AsyncGenerator
import os
import sys
from datetime import datetime
from contextlib import asynccontextmanager
from dotenv import load_dotenv

load_dotenv()

# MongoDB Configuration
MONGODB_URI = os.getenv("MONGODB_URI")
client: Optional[AsyncIOMotorClient] = None
db = None

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator:
    global client, db
    print(f"DEBUG: Starting PHENOX Backend...")
    try:
        if MONGODB_URI:
            client = AsyncIOMotorClient(MONGODB_URI)
            db = client.get_default_database()
            # Verify connection
            await client.admin.command('ping')
            print("INFO: Connected to MongoDB via Motor")
        else:
            print("WARNING: MONGODB_URI missing. Running in MOCK_MODE.")
    except Exception as e:
        print(f"ERROR: MongoDB Connection failed: {e}")
        db = None
    
    yield
    
    if client:
        client.close()
        print("INFO: MongoDB Connection closed")

app = FastAPI(title="PHENOX Cyberpunk API", version="1.0.0", lifespan=lifespan)

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Schemas
class GoldBatch(BaseModel):
    batchId: str
    weight: float
    purity: int
    location: str
    certification: Optional[str] = None
    isPublic: bool = True
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class AuditLog(BaseModel):
    action: str
    details: str
    adminEmail: str
    ipAddress: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Mock Auth Dependency
async def get_current_user(request: Request):
    clerk_secret = os.getenv("CLERK_SECRET_KEY")
    if not clerk_secret:
        return {"email": "demo@phenox.com"}
    return {"email": "demo@phenox.com"}

# Endpoints
@app.get("/api/v1/batches")
async def get_batches():
    if db is not None:
        try:
            cursor = db.batches.find().sort("timestamp", -1)
            results = await cursor.to_list(length=100)
            # Serialize Mongo IDs
            for res in results:
                res["_id"] = str(res["_id"])
            return results
        except Exception as e:
            print(f"DB Error: {e}")
    
    return [
        {"batchId": "B-77-MOCK", "weight": 500, "purity": 24, "location": "Neo-Tokyo Center", "timestamp": str(datetime.utcnow())}
    ]

@app.post("/api/v1/batches")
async def add_batch(batch: GoldBatch, user: dict = Depends(get_current_user), request: Request = None):
    ip_address = request.client.host if request else "127.0.0.1"
    batch_data = batch.dict()
    
    if db is not None:
        try:
            await db.batches.insert_one(batch_data.copy())
            log = AuditLog(
                action="INITIALIZE_BATCH",
                details=f"Batch {batch.batchId} created by {user['email']}",
                adminEmail=user['email'],
                ipAddress=ip_address
            )
            await db.logs.insert_one(log.dict())
        except Exception as e:
            print(f"POST Error: {e}")
            
    return {"status": "success", "data": batch_data}

@app.get("/api/v1/logs")
async def get_logs():
    if db is not None:
        try:
            cursor = db.logs.find().sort("timestamp", -1)
            results = await cursor.to_list(length=50)
            for res in results:
                res["_id"] = str(res["_id"])
            return results
        except Exception: pass
        
    return [
        {"action": "MOCK_EVENT", "details": "System initialized in Python/FastAPI", "adminEmail": "system@phenox.com", "ipAddress": "127.0.0.1", "timestamp": str(datetime.utcnow())}
    ]

@app.get("/api/v1/gold-price")
async def get_gold_price():
    return {
        "status": "success",
        "data": {
            "usd": 68.45,
            "inr": 5683.20,
            "timestamp": str(datetime.utcnow())
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3001)
