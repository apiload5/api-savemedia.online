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

// yt-dlp ka exact path
function getYtDlpPath() {
    const possiblePaths = [
        path.join(__dirname, 'bin', 'yt-dlp'),
        '/opt/render/project/src/bin/yt-dlp',
        '/opt/render/project/.local/bin/yt-dlp',
        'yt-dlp'
    ];
    
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) {
            return p;
        }
    }
    return 'yt-dlp';
}

// Health check with detailed info
app.get('/api/health', async (req, res) => {
    const ytPath = getYtDlpPath();
    const exists = fs.existsSync(ytPath);
    let version = null;
    
    if (exists) {
        try {
            const { stdout } = await execPromise(`${ytPath} --version`);
            version = stdout.trim();
        } catch(e) {}
    }
    
    res.json({ 
        status: 'OK',
        yt_dlp_path: ytPath,
        file_exists: exists,
        version: version
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
        
        if (!fs.existsSync(ytPath) && ytPath !== 'yt-dlp') {
            throw new Error(`yt-dlp not found at ${ytPath}`);
        }
        
        console.log(`Using yt-dlp: ${ytPath}`);
        console.log(`Processing URL: ${url}`);
        
        // Run yt-dlp and capture output
        const command = `${ytPath} -j "${url}"`;
        const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
        
        console.log(`Command output length: ${stdout ? stdout.length : 0}`);
        
        if (stderr) {
            console.log(`Stderr: ${stderr}`);
        }
        
        if (!stdout || stdout.trim() === '') {
            throw new Error('yt-dlp returned empty output. ' + (stderr || ''));
        }
        
        // Try to parse JSON
        let data;
        try {
            data = JSON.parse(stdout);
        } catch (parseError) {
            console.error('JSON parse error. Raw output:', stdout.substring(0, 500));
            throw new Error(`Invalid JSON response from yt-dlp: ${parseError.message}`);
        }
        
        // Extract video formats
        const videoFormats = (data.formats || [])
            .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
            .map(f => ({
                quality: f.height ? `${f.height}p` : 'Video',
                ext: 'mp4',
                url: f.url
            }));
        
        // Get best quality
        const bestQuality = videoFormats.sort((a, b) => {
            const aQ = parseInt(a.quality) || 0;
            const bQ = parseInt(b.quality) || 0;
            return bQ - aQ;
        })[0];
        
        if (!bestQuality) {
            throw new Error('No video formats found');
        }
        
        res.json({
            success: true,
            title: data.title || 'Video',
            thumbnail: data.thumbnail,
            videoUrl: bestQuality.url
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
