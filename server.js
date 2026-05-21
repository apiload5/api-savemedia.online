const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Content-Type', 'application/json');
    next();
});

function getYtDlpPath() {
    const possiblePaths = [
        path.join(__dirname, 'bin', 'yt-dlp'),
        '/opt/render/project/src/bin/yt-dlp'
    ];
    
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return 'yt-dlp';
}

// Health check
app.get('/api/health', async (req, res) => {
    const ytPath = getYtDlpPath();
    const exists = fs.existsSync(ytPath);
    let version = null;
    let testOutput = null;
    
    if (exists) {
        try {
            const { stdout } = await execPromise(`${ytPath} --version`);
            version = stdout.trim();
        } catch(e) { version = e.message; }
        
        // Test with a simple URL
        try {
            const { stdout } = await execPromise(`${ytPath} -j "https://www.youtube.com/watch?v=dQw4w9WgXcQ"`, { timeout: 30000 });
            testOutput = stdout ? stdout.substring(0, 200) : 'EMPTY';
        } catch(e) { testOutput = e.message; }
    }
    
    res.json({ 
        status: 'OK',
        yt_dlp_path: ytPath,
        file_exists: exists,
        version: version,
        test_output: testOutput
    });
});

// Main endpoint
app.get('/api/download', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'No URL provided' });
    }

    try {
        const ytPath = getYtDlpPath();
        
        // First, try to get just the direct URL without JSON parsing
        const urlCommand = `${ytPath} -g -f best "${url}"`;
        console.log('Getting direct URL:', urlCommand);
        
        let videoUrl = null;
        try {
            const { stdout } = await execPromise(urlCommand, { timeout: 60000 });
            videoUrl = stdout.trim();
            console.log('Direct URL found:', videoUrl.substring(0, 100));
        } catch(e) {
            console.log('Direct URL failed:', e.message);
        }
        
        // If direct URL works, return it
        if (videoUrl && videoUrl.startsWith('http')) {
            return res.json({
                success: true,
                title: 'Video',
                videoUrl: videoUrl
            });
        }
        
        // Otherwise try JSON method
        const jsonCommand = `${ytPath} -j "${url}"`;
        console.log('Getting JSON:', jsonCommand);
        
        const { stdout, stderr } = await execPromise(jsonCommand, { timeout: 60000 });
        
        if (!stdout || stdout.trim() === '') {
            throw new Error(`yt-dlp returned empty. Stderr: ${stderr || 'none'}`);
        }
        
        const data = JSON.parse(stdout);
        
        const videoFormats = (data.formats || [])
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
            title: data.title || 'Video',
            thumbnail: data.thumbnail,
            videoUrl: bestQuality?.url || videoUrl
        });
        
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ 
            error: 'Extraction failed',
            details: error.message
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ API running on port ${PORT}`);
    console.log(`yt-dlp path: ${getYtDlpPath()}`);
});
