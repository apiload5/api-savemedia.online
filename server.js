const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

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

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'yt-dlp installed!' });
});

// Main download endpoint
app.get('/api/download', async (req, res) => {
    const url = req.query.url;
    
    if (!url) {
        return res.status(400).json({ error: 'URL nahi diya' });
    }

    try {
        // Check if yt-dlp exists
        const checkCommand = 'which yt-dlp';
        await execPromise(checkCommand);
        
        // Extract video info
        const command = `yt-dlp -j "${url}"`;
        const { stdout } = await execPromise(command, { timeout: 60000 });
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
        
        // Best quality
        const bestQuality = videoFormats.sort((a, b) => {
            const aQ = parseInt(a.quality) || 0;
            const bQ = parseInt(b.quality) || 0;
            return bQ - aQ;
        })[0];
        
        res.json({
            success: true,
            title: data.title,
            thumbnail: data.thumbnail,
            duration: data.duration,
            uploader: data.uploader,
            videoFormats: videoFormats.slice(0, 5),
            videoUrl: bestQuality?.url
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
});
