#!/usr/bin/env python3

if __name__ == '__main__':
    import kpa.dev_utils; kpa.dev_utils.run(__file__)


import subprocess, json, shutil

from config import upload_dir_path, serve_dir_path, hosting_base_url
from make_shared_info_json import make_shared_info_json


def encode_video(filename):
    upload_filepath = upload_dir_path / filename
    assert upload_filepath.is_file()
    upload_info = json.loads((upload_dir_path / f'{filename}.json').read_text())
    start_seconds = upload_info['start_seconds']
    end_seconds = upload_info['end_seconds']
    bounce = bool(upload_info.get('bounce', True))
    puzzlename = upload_info['puzzlename'] if 'puzzlename' in upload_info else filename.replace('-', ' ').title()
    list_publicly = bool(upload_info.get('list_publicly', True))
    serve_subdir_path = (serve_dir_path / filename)  # TODO: name better
    if serve_subdir_path.exists():
        print(f'Deleting existing directory {serve_subdir_path}', flush=True)
        shutil.rmtree(serve_subdir_path)
    serve_subdir_path.mkdir()

    def run_ffmpeg(args):
        args = ['/usr/bin/ffmpeg', '-hide_banner'] + args
        print(f'ffmpeg_argv = {args}', flush=True)
        ffmpeg_proc = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, encoding='utf-8')
        if ffmpeg_proc.returncode == 0:
            print('ffmpeg_output =', repr(ffmpeg_proc.stdout), flush=True)
        else:
            print('FFMPEG OUTPUT:')
            print(ffmpeg_proc.stdout)
            print('===', flush=True)
            ffmpeg_proc.check_returncode()

    # Make jpgs
    # TODO: Use 1 million pixels or less
    run_ffmpeg([
        '-i', str(upload_filepath),
        '-an',  # remove audio
        '-ss', str(start_seconds), '-to', str(end_seconds),
        '-vf', 'fps=fps=30',
        '-qscale:v', '2',  # quality scales from 1=best to 31=worst
        str(serve_subdir_path / '%d.jpg')
    ])
    max_filenum = max(int(prefix) for img_path in serve_subdir_path.iterdir() if (prefix := img_path.name.split('.')[0]).isdigit())

    # Make thumbnail 320px jpg
    run_ffmpeg([
        '-i', str(upload_filepath),
        '-an',  # remove audio
        '-ss', str(start_seconds),
        '-vframes', '1',  # only 1 frame
        '-vf', 'scale=320:-1',  # 320px wide
        str(serve_subdir_path / '320px.jpg')
    ])

    # Make thumbnail 320px mp4
    run_ffmpeg([
        '-i', str(upload_filepath),
        '-an',  # remove audio
        '-ss', str(start_seconds), '-to', str(end_seconds),
        '-vf','fps=10,scale=320:-2',  # 10fps, 320px wide (the `-2` makes height an even number, which mp4 needs)
        '-loop', '0',  # loop forever
        str(serve_subdir_path / '320px-forward.mp4')
    ])
    if bounce:
        run_ffmpeg([
            '-i', str(serve_subdir_path / '320px-forward.mp4'),
            '-filter_complex', '[0:v]reverse,fifo[r];[0:v][r] concat=n=2:v=1 [v]', '-map', '[v]',  # bounce (concatenate a forwards copy to a backwards copy)
            '-loop', '0',  # loop forever
            str(serve_subdir_path / '320px.mp4')
        ])
    else:
        (serve_subdir_path / '320px.mp4').symlink_to(serve_subdir_path / '320px-forward.mp4')

    # Make thumbnail 320px webm
    run_ffmpeg([
        '-i', str(upload_filepath),
        '-an',  # remove audio
        '-ss', str(start_seconds), '-to', str(end_seconds),
        '-vf','fps=10,scale=320:-2',  # 10fps, 320px wide (the `-2` makes height an even number)
        '-loop', '0',  # loop forever
        str(serve_subdir_path / '320px-forward.webm')
    ])
    if bounce:
        run_ffmpeg([
            '-i', str(serve_subdir_path / '320px-forward.webm'),
            '-filter_complex', '[0:v]reverse,fifo[r];[0:v][r] concat=n=2:v=1 [v]', '-map', '[v]',  # bounce (concatenate a forwards copy to a backwards copy)
            '-loop', '0',  # loop forever
            str(serve_subdir_path / '320px.webm')
        ])
    else:
        (serve_subdir_path / '320px.webm').symlink_to(serve_subdir_path / '320px-forward.webm')

    (serve_subdir_path / 'info.json').write_text(json.dumps({
        'max_filenum': max_filenum,
        'puzzlename': puzzlename,
        'bounce': bounce,
        'list_publicly': list_publicly,
        '320px_jpg': f'{hosting_base_url}/{filename}/320px.jpg',
        '320px_mp4': f'{hosting_base_url}/{filename}/320px.mp4',
        '320px_webm': f'{hosting_base_url}/{filename}/320px.webm',
    }, indent=1))

    make_shared_info_json()


if __name__ == '__main__':
    import sys
    if sys.argv[1:]:
        for filename in sys.argv[1:]:
            encode_video(filename)
    else:
        for path in upload_dir_path.iterdir():
            if path.name.endswith('.json'):
                filename = path.name[:-5]
                if path.with_name(filename).is_file():
                    print(filename)
                    encode_video(filename)
                    print()
