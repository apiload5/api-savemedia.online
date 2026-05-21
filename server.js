const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs');
const path = require('path');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS for Blogger
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'yt-dlp API is running' });
});

// Main download endpoint
app.get('/api/download', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    try {
        // Get yt-dlp path
        const ytdlpPath = getYtDlpPath();
        
        // Extract video info using yt-dlp JSON output
        const command = `${ytdlpPath} -j "${url}"`;
        const { stdout, stderr } = await execPromise(command, { timeout: 45000 });
        
        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        const videoInfo = JSON.parse(stdout);
        
        // Extract video formats (mp4)
        const videoFormats = videoInfo.formats
            .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
            .map(f => ({
                quality: f.height ? `${f.height}p` : (f.format_note || 'Video'),
                ext: f.ext,
                filesize: f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
                url: f.url
            }));
        
        // Extract audio formats
        const audioFormats = videoInfo.formats
            .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
            .map(f => ({
                quality: f.abr ? `${f.abr}kbps` : (f.format_note || 'Audio'),
                ext: 'mp3',
                url: f.url
            }));
        
        // Get best quality video
        const bestQuality = videoFormats.sort((a, b) => {
            const aQ = parseInt(a.quality) || 0;
            const bQ = parseInt(b.quality) || 0;
            return bQ - aQ;
        })[0];
        
        // Get best audio
        const bestAudio = audioFormats[0];
        
        res.json({
            success: true,
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration,
            uploader: videoInfo.uploader,
            platform: videoInfo.extractor,
            videoFormats: videoFormats,
            audioFormats: audioFormats,
            videoUrl: bestQuality?.url,
            audioUrl: bestAudio?.url
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ 
            error: 'Failed to extract video',
            details: error.message 
        });
    }
});

// Direct audio download (MP3)
app.get('/api/audio', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    try {
        const ytdlpPath = getYtDlpPath();
        
        // Get best audio URL
        const command = `${ytdlpPath} -f bestaudio --get-url "${url}"`;
        const { stdout } = await execPromise(command, { timeout: 30000 });
        const audioUrl = stdout.trim();
        
        res.json({
            success: true,
            audioUrl: audioUrl
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Helper: Get yt-dlp path
function getYtDlpPath() {
    // Check local binary first
    const localPath = path.join(__dirname, 'bin', 'yt-dlp');
    if (fs.existsSync(localPath)) {
        return localPath;
    }
    // Fallback to system yt-dlp
    return 'yt-dlp';
}

app.listen(PORT, () => {
    console.log(`✅ yt-dlp API running on port ${PORT}`);
});

module.exports = app;
