const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS for Blogger
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    res.header('Content-Type', 'application/json');
    next();
});

// yt-dlp ka exact path dhundho
function getYtDlpPath() {
    // Possible paths where yt-dlp could be installed
    const possiblePaths = [
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
        '/opt/render/project/.local/bin/yt-dlp',
        '/home/render/.local/bin/yt-dlp',
        '/app/.local/bin/yt-dlp',
        'yt-dlp'  // fallback
    ];
    
    for (const path of possiblePaths) {
        if (fs.existsSync(path)) {
            console.log('Found yt-dlp at:', path);
            return path;
        }
    }
    
    // Agar nahi mila toh 'which' command try karo
    return 'yt-dlp';
}

// Health check - yt-dlp status
app.get('/api/health', async (req, res) => {
    const ytPath = getYtDlpPath();
    const pathExists = fs.existsSync(ytPath) || ytPath === 'yt-dlp';
    
    res.json({ 
        status: 'OK',
        yt_dlp_path: ytPath,
        path_exists: pathExists,
        message: 'API is running'
    });
});

// Main download endpoint
app.get('/api/download', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'URL nahi diya' });
    }

    try {
        const ytPath = getYtDlpPath();
        console.log('Using yt-dlp path:', ytPath);
        
        // Command with full path
        const command = `${ytPath} -j "${url}"`;
        console.log('Running command:', command);
        
        const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
        
        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        const data = JSON.parse(stdout);
        
        // Video formats (mp4 only)
        const videoFormats = data.formats
            .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
            .map(f => ({
                quality: f.height ? `${f.height}p` : 'Video',
                ext: 'mp4',
                filesize: f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
                url: f.url
            }));
        
        // Best quality video
        const bestQuality = videoFormats.sort((a, b) => {
            const aQ = parseInt(a.quality) || 0;
            const bQ = parseInt(b.quality) || 0;
            return bQ - aQ;
        })[0];
        
        // Audio format
        const audioFormat = data.formats
            .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
            .map(f => ({
                quality: f.abr ? `${f.abr}kbps` : 'Audio',
                ext: 'mp3',
                url: f.url
            }))[0];
        
        res.json({
            success: true,
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            uploader: data.uploader,
            videoFormats: videoFormats.slice(0, 5),
            audioFormats: audioFormat ? [{ quality: audioFormat.quality, ext: 'mp3', url: audioFormat.url }] : [],
            videoUrl: bestQuality?.url,
            audioUrl: audioFormat?.url
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
    console.log(`yt-dlp path check: ${getYtDlpPath()}`);
});
