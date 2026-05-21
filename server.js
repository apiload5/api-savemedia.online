const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Content-Type', 'application/json');
    if (req.method === 'OPTIONS') return res.status(200).end();
    next();
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'API is running' });
});

// Main endpoint
app.get('/api/download', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    try {
        console.log("Processing URL:", url);
        
        const command = `yt-dlp -j "${url}"`;
        const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
        
        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        const videoInfo = JSON.parse(stdout);
        
        const videoFormats = videoInfo.formats
            .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
            .map(f => ({
                quality: f.height ? `${f.height}p` : 'Video',
                ext: 'mp4',
                filesize: f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB` : null,
                url: f.url
            }));
        
        const bestQuality = videoFormats.sort((a, b) => {
            const aQ = parseInt(a.quality) || 0;
            const bQ = parseInt(b.quality) || 0;
            return bQ - aQ;
        })[0];
        
        const response = {
            success: true,
            title: videoInfo.title,
            thumbnail: videoInfo.thumbnail,
            duration: videoInfo.duration,
            uploader: videoInfo.uploader,
            videoFormats: videoFormats.slice(0, 5),
            videoUrl: bestQuality?.url
        };
        
        console.log("Sending response for:", videoInfo.title);
        return res.json(response);
        
    } catch (error) {
        console.error("Error:", error.message);
        return res.status(500).json({ 
            error: 'Extraction failed',
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ API running on port ${PORT}`);
});
