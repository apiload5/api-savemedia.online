import os
import json
import subprocess
import sys
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Find yt-dlp path
def find_ytdlp():
    possible_paths = [
        '/usr/local/bin/yt-dlp',
        '/usr/bin/yt-dlp',
        '/opt/render/project/.local/bin/yt-dlp',
        '/home/render/.local/bin/yt-dlp',
        os.path.expanduser('~/.local/bin/yt-dlp'),
        'yt-dlp'
    ]
    
    for path in possible_paths:
        try:
            result = subprocess.run([path, '--version'], capture_output=True, text=True, timeout=5)
            if result.returncode == 0:
                print(f"Found yt-dlp at: {path}")
                return path
        except:
            continue
    
    # Try to install if not found
    try:
        subprocess.run([sys.executable, '-m', 'pip', 'install', '--user', 'yt-dlp'], check=True)
        subprocess.run(['pip', 'install', '--user', 'yt-dlp'], check=True)
    except:
        pass
    
    return 'yt-dlp'

YTDLP_PATH = find_ytdlp()

@app.route('/api/health', methods=['GET'])
def health():
    try:
        result = subprocess.run([YTDLP_PATH, '--version'], capture_output=True, text=True, timeout=10)
        return jsonify({
            'status': 'OK',
            'yt_dlp_path': YTDLP_PATH,
            'yt_dlp_version': result.stdout.strip(),
            'message': 'API is ready!'
        })
    except Exception as e:
        return jsonify({
            'status': 'ERROR',
            'yt_dlp_path': YTDLP_PATH,
            'error': str(e)
        }), 500

@app.route('/api/download', methods=['GET'])
def download():
    url = request.args.get('url')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    try:
        # Method 1: Get direct video URL
        cmd_direct = [YTDLP_PATH, '-g', '-f', 'best[ext=mp4]', url]
        print(f"Running: {' '.join(cmd_direct)}")
        
        direct_result = subprocess.run(cmd_direct, capture_output=True, text=True, timeout=60)
        
        if direct_result.returncode == 0 and direct_result.stdout.strip():
            video_url = direct_result.stdout.strip()
            print(f"Direct URL found: {video_url[:100]}...")
            
            # Get title separately
            cmd_title = [YTDLP_PATH, '--get-title', url]
            title_result = subprocess.run(cmd_title, capture_output=True, text=True, timeout=30)
            title = title_result.stdout.strip() if title_result.returncode == 0 else 'Video'
            
            return jsonify({
                'success': True,
                'title': title,
                'videoUrl': video_url
            })
        
        # Method 2: If direct fails, try JSON method
        print("Direct method failed, trying JSON method...")
        cmd_json = [YTDLP_PATH, '-j', url]
        json_result = subprocess.run(cmd_json, capture_output=True, text=True, timeout=60)
        
        if json_result.returncode != 0:
            return jsonify({
                'error': 'yt-dlp failed',
                'stdout': json_result.stdout[:200] if json_result.stdout else '',
                'stderr': json_result.stderr[:200] if json_result.stderr else ''
            }), 500
        
        if not json_result.stdout:
            return jsonify({'error': 'Empty output from yt-dlp'}), 500
        
        data = json.loads(json_result.stdout)
        
        # Extract video URL
        video_url = None
        for f in data.get('formats', []):
            if f.get('ext') == 'mp4' and f.get('vcodec') != 'none':
                if not video_url:
                    video_url = f.get('url')
                elif f.get('height', 0) > 0:
                    current_h = 0
                    for existing in data.get('formats', []):
                        if existing.get('url') == video_url:
                            current_h = existing.get('height', 0)
                            break
                    if f.get('height', 0) > current_h:
                        video_url = f.get('url')
        
        if not video_url:
            video_url = data.get('url')
        
        return jsonify({
            'success': True,
            'title': data.get('title', 'Video'),
            'thumbnail': data.get('thumbnail'),
            'duration': data.get('duration'),
            'videoUrl': video_url
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Request timeout (60 seconds)'}), 500
    except json.JSONDecodeError as e:
        return jsonify({'error': f'Invalid JSON: {str(e)}'}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    print(f"Starting Flask app on port {port}")
    print(f"Using yt-dlp at: {YTDLP_PATH}")
    app.run(host='0.0.0.0', port=port)
