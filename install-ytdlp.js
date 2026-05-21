const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec } = require('child_process');

const BIN_DIR = path.join(__dirname, 'bin');
const YTDLP_PATH = path.join(BIN_DIR, 'yt-dlp');

async function downloadYtDlp() {
    console.log('📥 Downloading yt-dlp...');
    
    if (!fs.existsSync(BIN_DIR)) {
        fs.mkdirSync(BIN_DIR, { recursive: true });
    }
    
    // Detect platform
    const platform = process.platform;
    let url = '';
    
    if (platform === 'win32') {
        url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    } else {
        url = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';
    }
    
    const file = fs.createWriteStream(YTDLP_PATH);
    
    return new Promise((resolve, reject) => {
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                // Make executable on Unix
                if (platform !== 'win32') {
                    fs.chmodSync(YTDLP_PATH, '755');
                }
                console.log('✅ yt-dlp installed successfully!');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(YTDLP_PATH, () => {});
            console.error('❌ Download failed:', err);
            reject(err);
        });
    });
}

async function verifyInstallation() {
    console.log('🔍 Verifying yt-dlp...');
    
    const { exec } = require('child_process');
    const util = require('util');
    const execPromise = util.promisify(exec);
    
    try {
        const { stdout } = await execPromise(`${YTDLP_PATH} --version`);
        console.log(`✅ yt-dlp version: ${stdout.trim()}`);
        return true;
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

// Run installation
(async () => {
    try {
        await downloadYtDlp();
        await verifyInstallation();
        console.log('🎉 Setup complete!');
    } catch (error) {
        console.error('💥 Installation failed:', error);
        process.exit(1);
    }
})();
