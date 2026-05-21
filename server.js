import os
import json
import subprocess
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/api/health', methods=['GET'])
def health():
    try:
        result = subprocess.run(['yt-dlp', '--version'], capture_output=True, text=True, timeout=10)
        return jsonify({
            'status': 'OK',
            'yt_dlp_version': result.stdout.strip(),
            'message': 'Python API is running!'
        })
    except Exception as e:
        return jsonify({'status': 'ERROR', 'message': str(e)})

@app.route('/api/download', methods=['GET'])
def download():
    url = request.args.get('url')
    
    if not url:
        return jsonify({'error': 'No URL provided'}), 400
    
    try:
        # Get video info as JSON
        cmd = ['yt-dlp', '-j', url]
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        
        if result.returncode != 0:
            return jsonify({
                'error': 'yt-dlp failed',
                'details': result.stderr
            }), 500
        
        if not result.stdout:
            return jsonify({'error': 'No output from yt-dlp'}), 500
        
        data = json.loads(result.stdout)
        
        # Get best video URL
        video_url = None
        for f in data.get('formats', []):
            if f.get('ext') == 'mp4' and f.get('vcodec') != 'none':
                if not video_url:
                    video_url = f.get('url')
                # Prefer higher quality
                if f.get('height') and video_url:
                    current_height = 0
                    for existing in data.get('formats', []):
                        if existing.get('url') == video_url:
                            current_height = existing.get('height', 0)
                            break
                    if f.get('height', 0) > current_height:
                        video_url = f.get('url')
        
        return jsonify({
            'success': True,
            'title': data.get('title', 'Video'),
            'thumbnail': data.get('thumbnail'),
            'duration': data.get('duration'),
            'videoUrl': video_url or data.get('url')
        })
        
    except subprocess.TimeoutExpired:
        return jsonify({'error': 'Request timeout'}), 500
    except json.JSONDecodeError as e:
        return jsonify({'error': 'Invalid JSON from yt-dlp', 'details': str(e)}), 500
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 10000))
    app.run(host='0.0.0.0', port=port)
