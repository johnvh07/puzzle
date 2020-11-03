#!/usr/bin/env python3

import json

from config import serve_dir_path

def make_shared_info_json():
    ret = []
    for dirpath in serve_dir_path.iterdir():
        if dirpath.is_dir():
            j = json.loads((dirpath / 'info.json').read_text())
            j['name'] = dirpath.name
            if '320px_mp4' in j: j['320px_mp4'] = f"https://petervh.com/live/{dirpath.name}/{j['320px_mp4']}"
            if '320px_jpg' in j: j['320px_jpg'] = f"https://petervh.com/live/{dirpath.name}/{j['320px_jpg']}"
            ret.append(j)
    (serve_dir_path / 'info.json').write_text(json.dumps(ret))


if __name__ == '__main__':
    make_shared_info_json()
