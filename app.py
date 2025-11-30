from fastapi import FastAPI, Query, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import yt_dlp
import asyncio
import hashlib
import time
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://savemedia.online",
        "https://www.savemedia.online", 
        "https://ticnotester.blogspot.com",
        "http://localhost:3000",  # Local testing
    ],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# Simple cache
cache = {}

def ultra_fast_extract(url: str):
    """Vercel ke 5s mein complete hone wala function"""
    try:
        ydl_opts = {
            "quiet": True,
            "skip_download": True,
            "no_warnings": True,
            "socket_timeout": 3,  # 3 seconds only
            "extract_timeout": 4,  # 4 seconds max
            "noplaylist": True,
            "ignoreerrors": True,
            "extract_flat": False,
            "youtube_include_dash_manifest": False,
        }
        
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            
            # Only get basic info first
            basic_info = {
                "title": info.get("title", "video"),
                "thumbnail": info.get("thumbnail"),
                "uploader": info.get("uploader"),
                "duration": info.get("duration"),
            }
            
            # FAST format filtering - only first 2 progressive formats
            formats = []
            for f in info.get("formats", []):
                if (f.get("url") and 
                    f.get("acodec") != "none" and 
                    f.get("vcodec") != "none" and
                    f.get("height") is not None):
                    
                    formats.append({
                        "format_id": f.get("format_id"),
                        "ext": f.get("ext", "mp4"),
                        "filesize": f.get("filesize"),
                        "url": f.get("url"),
                        "resolution": f"{f.get('height', '')}p",
                    })
                    
                    # ONLY 2 FORMATS - for speed
                    if len(formats) >= 2:
                        break
            
            return {
                "success": True,
                **basic_info,
                "formats": formats,
            }
            
    except Exception as e:
        error_msg = str(e)
        if "timeout" in error_msg.lower():
            return {"success": False, "error": "Video processing timeout - try shorter video"}
        else:
            return {"success": False, "error": f"Extraction failed: {error_msg}"}

@app.get("/")
async def home():
    return {"status": "active", "message": "🚀 Ultra Fast SaveMedia Backend"}

@app.get("/download")
async def download_video(url: str = Query(..., description="YouTube URL")):
    start_time = time.time()
    
    # URL validation
    if not url or ("youtube.com" not in url and "youtu.be" not in url):
        return JSONResponse(
            status_code=400,
            content={"error": "Please provide a valid YouTube URL"}
        )
    
    # Cache check
    cache_key = hashlib.md5(url.encode()).hexdigest()
    if cache_key in cache:
        cache_data = cache[cache_key]
        if time.time() - cache_data["timestamp"] < 300:  # 5 minutes
            return {
                **cache_data["data"],
                "cached": True,
                "processing_time": 0.01
            }
    
    try:
        # ULTRA FAST timeout - 6 seconds only
        loop = asyncio.get_event_loop()
        result = await asyncio.wait_for(
            loop.run_in_executor(None, ultra_fast_extract, url),
            timeout=6.0  # Vercel ke 10s se bahut kam
        )
        
        processing_time = round(time.time() - start_time, 2)
        
        if result["success"]:
            response_data = {
                **result,
                "cached": False,
                "processing_time": processing_time,
                "vercel_optimized": True
            }
            
            # Cache the result
            cache[cache_key] = {
                "data": response_data,
                "timestamp": time.time()
            }
            
            return response_data
        else:
            raise HTTPException(status_code=400, detail=result["error"])
            
    except asyncio.TimeoutError:
        logger.error("Vercel timeout - processing took too long")
        raise HTTPException(
            status_code=408,
            detail="Video processing timeout - Vercel limit exceeded. Try shorter videos or different URL."
        )
    except Exception as e:
        logger.error(f"Server error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "platform": "Vercel",
        "max_timeout": "6 seconds",
        "cache_size": len(cache)
    }

# Emergency cleanup for cache
@app.on_event("startup")
async def startup_event():
    async def clean_cache():
        while True:
            await asyncio.sleep(60)
            current_time = time.time()
            expired_keys = [k for k, v in cache.items() if current_time - v["timestamp"] > 300]
            for key in expired_keys:
                del cache[key]
            if expired_keys:
                logger.info(f"Cleaned {len(expired_keys)} cache entries")
    
    # Start background task
    asyncio.create_task(clean_cache())
