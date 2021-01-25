#!/usr/bin/env python3

from flask import Flask, request, abort, Response, send_file, send_from_directory, url_for, redirect
from werkzeug.utils import secure_filename
import os, random, json
from pathlib import Path

from config import upload_dir_path, serve_dir_path
from encode_video import encode_video

app = Flask(__name__)
app.config['MAX_CONTENT_LENGTH'] = 100*1024*1024  # 100MB max upload

secret_password = Path('secret.txt').read_text().strip()


def get_free_space():
    statvfs = os.statvfs(upload_dir_path)
    return statvfs.f_frsize * statvfs.f_bavail

@app.route('/')
def homepage():
    return send_file(Path().absolute().parent / 'client' / 'index.html')

@app.route('/<path:path>')
def serve_client_path(path):
    return send_from_directory(Path().absolute().parent / 'client', path)

@app.route('/all-images')
def all_images_redirect():
    return redirect(url_for('all_images'))
@app.route('/all')
def all_images():
    images = sorted(c.name for c in Path(serve_dir_path).iterdir() if c.is_dir() and not c.is_symlink())
    return '\n'.join(f'<p><a href="/?image={image}">{image}</a></p>' for image in images)

@app.route('/create')
@app.route('/upload.html')
def upload_redirect():
    return redirect(url_for('upload_file'))
@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'GET':
        return send_file(Path().absolute().parent / 'client' / 'upload.html')

    elif request.method == 'POST':
        form = request.form.to_dict()

        print('files =', request.files)
        print('form =', form, flush=True)

        if get_free_space() < 500e6:
            abort(Response('Too little space left on disk', 500))


        if not form['streetname'].lower().strip().startswith(secret_password):
            abort(Response('Wrong password.', 404))

        start_time = float(form['starttime'])
        if not 0 <= start_time < 1000:
            abort(Response('Illegal start time.', 404))
        end_time = float(form['endtime']) if 'endtime' in form else 999  # I hope this doesn't confuse ffmpeg
        if not 0 <= end_time < 1000:
            abort(Response('Illegal end time.', 404))

        bounce = bool(form.get('bounce', ''))

        puzzlename = form['puzzlename']
        if puzzlename == '':
            abort(Response('Name was left blank.', 404))

        if 'video' not in request.files:
            abort(Response('This request didnt have any files.', 404))
        file = request.files['video']
        if not file or file.filename == '':
            abort(Response('This request didnt include any real files.', 404))

        filename = secure_filename(form['puzzleid'] or puzzlename)
        while (upload_dir_path / filename).exists(): filename += random.choice('123456789')
        while (serve_dir_path / filename).exists(): filename += random.choice('123456789')
        file.save(upload_dir_path / filename)
        (upload_dir_path / f'{filename}.json').write_text(json.dumps({
            'start_seconds': start_time,
            'end_seconds': end_time,
            'bounce': bounce,
            'puzzlename': puzzlename,
        }, indent=1))
        encode_video(filename)

        return f'Saved as <a href="/puzzle.html?image={filename}">{filename}</a>'
