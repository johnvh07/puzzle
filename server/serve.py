#!/usr/bin/env python3

from flask import Flask, request, abort, Response, send_file, send_from_directory, url_for, redirect
from werkzeug.utils import secure_filename
import boltons.fileutils
import os, random, pathlib, subprocess, json


app = Flask(__name__)
app.config['UPLOAD_DIR'] = '/tmp/livepuzzle-uploads'
app.config['TRIMMED_DIR'] = '/tmp/livepuzzle-trimmed'
app.config['SERVE_DIR'] = '/var/www/html/live/'
app.config['MAX_CONTENT_LENGTH'] = 100*1024*1024  # 100MB max upload

secret_password = pathlib.Path('secret.txt').read_text().strip()

def get_free_space():
    statvfs = os.statvfs(app.config['UPLOAD_DIR'])
    return statvfs.f_frsize * statvfs.f_bavail

@app.route('/')
def homepage():
    return send_file(pathlib.Path().absolute().parent / 'client' / 'index.html')

@app.route('/<path:path>')
def serve_client_path(path):
    return send_from_directory(pathlib.Path().absolute().parent / 'client', path)

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
        boltons.fileutils.mkdir_p(app.config['UPLOAD_DIR'])
        while os.path.exists(os.path.join(app.config['UPLOAD_DIR'], filename)): filename += random.choice('123456789')
        while os.path.exists(os.path.join(app.config['TRIMMED_DIR'], filename)): filename += random.choice('123456789')
        while os.path.exists(os.path.join(app.config['SERVE_DIR'], filename)): filename += random.choice('123456789')
        file.save(os.path.join(app.config['UPLOAD_DIR'], filename))

        boltons.fileutils.mkdir_p(app.config['UPLOAD_DIR'])
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

        max_filenum = max(int(fname.split('.')[0]) for fname in os.listdir(os.path.join(app.config['SERVE_DIR'], filename)))
        with open(os.path.join(app.config['SERVE_DIR'], filename, 'info.json'), 'w') as f: json.dump({'max_filenum':max_filenum}, f)

        return f'Saved as {filename}'
