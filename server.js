const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'application/json');
    next();
});

// yt-dlp ka exact path - Render pe local bin folder mein hai
function getYtDlpPath() {
    const possiblePaths = [
        path.join(__dirname, 'bin', 'yt-dlp'),
        '/opt/render/project/src/bin/yt-dlp',
        '/opt/render/project/.local/bin/yt-dlp',
        '/home/render/.local/bin/yt-dlp'
    ];
    
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            console.log('Found yt-dlp at:', p);
            return p;
        }
    }
    
    console.log('yt-dlp not found in paths, using default');
    return 'yt-dlp';
}

// Health check
app.get('/api/health', async (req, res) => {
    const ytPath = getYtDlpPath();
    const exists = fs.existsSync(ytPath);
    
    res.json({ 
        status: 'OK', 
        yt_dlp_path: ytPath,
        file_exists: exists,
        message: exists ? 'yt-dlp ready' : 'yt-dlp not found'
    });
});

// Main download endpoint
app.get('/api/download', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    try {
        const ytPath = getYtDlpPath();
        
        // Check if file exists
        if (!fs.existsSync(ytPath) && ytPath !== 'yt-dlp') {
            throw new Error(`yt-dlp not found at ${ytPath}`);
        }
        
        const command = `${ytPath} -j "${url}"`;
        console.log('Running:', command);
        
        const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
        
        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        const data = JSON.parse(stdout);
        
        const videoFormats = data.formats
            .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
            .map(f => ({
                quality: f.height ? `${f.height}p` : 'Video',
                ext: 'mp4',
                url: f.url
            }));
        
        const bestQuality = videoFormats.sort((a, b) => {
            const aQ = parseInt(a.quality) || 0;
            const bQ = parseInt(b.quality) || 0;
            return bQ - aQ;
        })[0];
        
        res.json({
            success: true,
            title: data.title,
            thumbnail: data.thumbnail,
            videoUrl: bestQuality?.url
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ API running on port ${PORT}`);
    console.log(`yt-dlp path: ${getYtDlpPath()}`);
});
