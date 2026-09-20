#!/usr/bin/env python3

from flask import Flask, request, abort, Response, send_file, send_from_directory, url_for, redirect
from werkzeug.utils import secure_filename
import b2_utils
import os, random, json, re, mimetypes, hashlib, shutil
from pathlib import Path, PurePath
from urllib.parse import quote_plus

# from encode_video import encode_video

# /var/cache/kpa-motionpuzzle is automatically created & owned by the service when DynamicUser=yes and CacheDirectory=kpa-motionpuzzle are set.
CACHE_DIR = Path(os.getenv('CACHE_DIR', '/var/cache/kpa-motionpuzzle'))
ONE_YEAR_SECONDS = 365*24*60*60
MIN_FREE_DISK_BYTES = 1e9
print(f'Cacheing b2 to {CACHE_DIR}')

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100*1024*1024  # 100MB max upload

secret_password = Path('secret.txt').read_text().strip()


def get_free_space():
    try:
        return shutil.disk_usage(CACHE_DIR).free
    except OSError:
        return shutil.disk_usage('/').free


@app.route('/')
def homepage():
    return send_file(Path().absolute().parent / 'client' / 'index.html')

@app.route('/<path:path>')
def serve_client_path(path):
    assert '..' not in path, path
    return send_from_directory(Path().absolute().parent / 'client', path)

@app.route('/content/<path:path>')
def get_content(path: str):
    # Safe path normalization: prevents leading slash and path traversal
    safe_path = str(PurePath('/', path).relative_to('/'))
    cache_file = CACHE_DIR / quote_plus(safe_path)

    # Check cache
    if cache_file.exists():
        print(f'=> Getting {safe_path} from disk cache')
        return send_file(cache_file, download_name=Path(safe_path).name, max_age=ONE_YEAR_SECONDS)

    # Fall back to B2
    mimetype = mimetypes.guess_type(safe_path)[0] or 'application/octet-stream'
    try:
        content = b2_utils.get_file_content(None, f'motionpuzzle/processed/{safe_path}')
    except b2_utils.NoSuchKey:  # Replace with your B2 SDK's specific NotFound/NoSuchKey exception
        abort(404)

    # Populate cache
    if should_cache(safe_path, content):
        print(f'=> Getting {safe_path} ({len(content)//3}KB) from b2, cacheing to disk')
        try:
            CACHE_DIR.mkdir(parents=True, exist_ok=True)
            temp_file = cache_file.with_suffix('.tmp')
            temp_file.write_bytes(content)
            temp_file.replace(cache_file)  # Atomic rename
        except OSError:
            pass  # If disk write fails, still return response to user
    else:
        print(f'=> Getting {safe_path} ({len(content)//3}KB) from b2, NOT cacheing')

    # Return 304 Not Modified if etag matches
    etag = f'"{hashlib.md5(content).hexdigest()}"'
    if request.headers.get('If-None-Match') == etag:
        response = Response(status=304)
        response.headers['ETag'] = etag
        response.headers['Cache-Control'] = f'public, max-age={ONE_YEAR_SECONDS}'
        return response

    # Return 200
    response = Response(content, mimetype=mimetype)
    response.headers['ETag'] = etag
    response.headers['Cache-Control'] = f'public, max-age={ONE_YEAR_SECONDS}, immutable'
    return response

def should_cache(path:str, content:bytes) -> bool:
    if get_free_space() < MIN_FREE_DISK_BYTES: return False
    if re.fullmatch(r'.*/[0-9]+\.jpg', path): return False  # DON'T cache all the image series
    if len(content) < 1e6: return True  # DO cache small
    return False



@app.route('/create')
@app.route('/upload.html')
def upload_redirect():
    return redirect(url_for('upload_file'))
@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    return 'not implemented'

    # if request.method == 'GET':
    #     return send_file(Path().absolute().parent / 'client' / 'upload.html')

    # elif request.method == 'POST':
    #     form = request.form.to_dict()

    #     print('files =', request.files)
    #     print('form =', form, flush=True)

    #     if get_free_space() < 500e6:
    #         abort(Response('Too little space left on disk', 500))


    #     if not form['streetname'].lower().strip().startswith(secret_password):
    #         abort(Response('Wrong password.', 404))

    #     start_time = float(form['starttime'])
    #     if not 0 <= start_time < 1000:
    #         abort(Response('Illegal start time.', 404))
    #     end_time = float(form['endtime']) if 'endtime' in form else 999  # I hope this doesn't confuse ffmpeg
    #     if not 0 <= end_time < 1000:
    #         abort(Response('Illegal end time.', 404))

    #     bounce = bool(form.get('bounce', ''))

    #     puzzlename = form['puzzlename']
    #     if puzzlename == '':
    #         abort(Response('Name was left blank.', 404))

    #     if 'video' not in request.files:
    #         abort(Response('This request didnt have any files.', 404))
    #     file = request.files['video']
    #     if not file or file.filename == '':
    #         abort(Response('This request didnt include any real files.', 404))

    #     filename = secure_filename(form['puzzleid'] or puzzlename)
    #     while (upload_dir_path / filename).exists(): filename += random.choice('123456789')
    #     while (serve_dir_path / filename).exists(): filename += random.choice('123456789')
    #     file.save(upload_dir_path / filename)
    #     (upload_dir_path / f'{filename}.json').write_text(json.dumps({
    #         'start_seconds': start_time,
    #         'end_seconds': end_time,
    #         'bounce': bounce,
    #         'puzzlename': puzzlename,
    #     }, indent=1))
    #     encode_video(filename)

    #     return f'Saved as <a href="/puzzle.html?image={filename}">{filename}</a>'
