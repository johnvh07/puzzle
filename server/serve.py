#!/usr/bin/env python3

from flask import Flask, request, abort, Response, send_file, send_from_directory, url_for, redirect, jsonify
from werkzeug.utils import secure_filename
import boltons.fileutils
import os, random, pathlib, subprocess, json
from pathlib import Path


app = Flask(__name__)
app.config['UPLOAD_DIR'] = './livepuzzle-uploads/'; boltons.fileutils.mkdir_p(app.config['UPLOAD_DIR'])
app.config['SERVE_DIR'] = '/var/www/html/live/'; boltons.fileutils.mkdir_p(app.config['SERVE_DIR'])
app.config['MAX_CONTENT_LENGTH'] = 100*1024*1024  # 100MB max upload

secret_password = pathlib.Path('secret.txt').read_text().strip()


def get_free_space():
    statvfs = os.statvfs(app.config['UPLOAD_DIR'])
    return statvfs.f_frsize * statvfs.f_bavail

@app.route('/')
def homepage():
    return send_file(pathlib.Path().absolute().parent / 'client' / 'index.html')

@app.route('/upload.html')
def upload_redirect():
    return redirect(url_for('upload_file'))

@app.route('/<path:path>')
def serve_client_path(path):
    return send_from_directory(pathlib.Path().absolute().parent / 'client', path)

@app.route('/all')
@app.route('/all-images')
def all_images():
    images = sorted(c.name for c in Path(app.config['SERVE_DIR']).iterdir() if c.is_dir() and not c.is_symlink())
    return '\n'.join(f'<p><a href="/?image={image}">{image}</a></p>' for image in images)

@app.route('/upload', methods=['GET', 'POST'])
def upload_file():
    if request.method == 'GET':
        return send_file(pathlib.Path().absolute().parent / 'client' / 'upload.html')

    elif request.method == 'POST':
        print('files =', request.files)
        print('form =', request.form.to_dict())

        if get_free_space() < 500e6:
            abort(Response('Too little space left on disk', 500))

        if not request.form.to_dict()['streetname'].lower().strip().startswith(secret_password):
            abort(Response('Wrong password.', 404))
        if not 0 <= float(request.form.to_dict()['starttime']) < 1000:
            abort(Response('Illegal start time.', 404))
        if not 0 <= float(request.form.to_dict()['endtime']) < 1000:
            abort(Response('Illegal end time.', 404))

        if 'video' not in request.files:
            abort(Response('This request didnt have any files.', 404))
        file = request.files['video']
        if not file or file.filename == '':
            abort(Response('This request didnt include any real files.', 404))

        filename = secure_filename(request.form.to_dict()['filename'])
        while os.path.exists(os.path.join(app.config['UPLOAD_DIR'], filename)): filename += random.choice('123456789')
        while os.path.exists(os.path.join(app.config['SERVE_DIR'], filename)): filename += random.choice('123456789')
        file.save(os.path.join(app.config['UPLOAD_DIR'], filename))

        boltons.fileutils.mkdir_p(os.path.join(app.config['SERVE_DIR'], filename))
        ffmpeg_stdout = subprocess.check_output([
            '/usr/bin/ffmpeg',
            '-i', os.path.join(app.config['UPLOAD_DIR'], filename),
            '-an',  # remove audio
            '-ss', str(float(request.form.to_dict()['starttime'])),
            '-to', str(float(request.form.to_dict()['endtime'])),
            '-qscale:v', '2',  # quality scales from 1=best to 31=worst
            os.path.join(app.config['SERVE_DIR'], filename, '%d.jpg')
        ], stderr=subprocess.STDOUT)
        print(f'{ffmpeg_stdout=}')

        # I'm commenting this out for now because sometimes it breaks with the error message "MPEG-1/2 does not support 15/1 fps", and anyways mpegts is too inefficient
        #ffmpeg_stdout = subprocess.check_output([
        #    '/usr/bin/ffmpeg',
        #    '-i', os.path.join(app.config['UPLOAD_DIR'], filename),
        #    '-an',  # remove audio
        #    '-ss', str(float(request.form.to_dict()['starttime'])),
        #    '-to', str(float(request.form.to_dict()['endtime'])),
        #    '-f', 'mpegts', '-codec:v', 'mpeg1video',
        #    '-b:v', '11M',  # this bitrate (~1.4MB/s) is a decent size and quality
        #    os.path.join(app.config['SERVE_DIR'], filename+'.ts',)
        #], stderr=subprocess.STDOUT)
        #print(f'{ffmpeg_stdout=}')

        max_filenum = max(int(fname.split('.')[0]) for fname in os.listdir(os.path.join(app.config['SERVE_DIR'], filename)))
        with open(os.path.join(app.config['SERVE_DIR'], filename, 'info.json'), 'w') as f: json.dump({'max_filenum':max_filenum}, f)

        generate_shared_info_json()

        return f'Saved as <a href="/puzzle.html?image={filename}">{filename}</a>'


def generate_shared_info_json():
    ret = []
    for dirpath in Path(app.config['SERVE_DIR']).iterdir():
        if dirpath.is_dir():
            j = json.loads((dirpath / 'info.json').read_text())
            j['name'] = dirpath.name
            j['thumbnail_url'] = f'https://petervh.com/live/{dirpath.name}/1.jpg'
            ret.append(j)
    shared_info_json_path = Path(app.config['SERVE_DIR']) / 'info.json'
    shared_info_json_path.write_text(json.dumps(ret))
