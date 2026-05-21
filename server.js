const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS
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
        // Direct yt-dlp command (system installed)
        const command = `yt-dlp -j "${url}"`;
        const { stdout, stderr } = await execPromise(command, { timeout: 60000 });
        
        if (stderr && !stdout) {
            throw new Error(stderr);
        }

        const videoInfo = JSON.parse(stdout);
        
        // Video formats (mp4 only)
        const videoFormats = videoInfo.formats
            .filter(f => f.ext === 'mp4' && f.vcodec !== 'none')
            .map(f => ({
                quality: f.height ? `${f.height}p` : (f.format_note || 'Video'),
                ext: f.ext,
                filesize: f.filesize ? `${(f.filesize / 1024 / 1024).toFixed(1)} MB` : 'Unknown',
                url: f.url
            }));
        
        // Audio formats
        const audioFormats = videoInfo.formats
            .filter(f => f.acodec !== 'none' && f.vcodec === 'none')
            .map(f => ({
                quality: f.abr ? `${f.abr}kbps` : (f.format_note || 'Audio'),
                ext: 'mp3',
                url: f.url
            }));
        
        const bestQuality = videoFormats.sort((a, b) => {
            const aQ = parseInt(a.quality) || 0;
            const bQ = parseInt(b.quality) || 0;
            return bQ - aQ;
        })[0];
        
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

app.listen(PORT, () => {
    console.log(`✅ yt-dlp API running on port ${PORT}`);
});
