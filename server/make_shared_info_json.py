#!/usr/bin/env python3

import json

from config import serve_dir_path

def make_shared_info_json():
    ret = []
    for dirpath in serve_dir_path.iterdir():
        if dirpath.is_dir():
            info_json_path = dirpath / 'info.json'
            if info_json_path.is_file():
                j = json.loads(info_json_path.read_text())
                j['name'] = dirpath.name
                ret.append(j)
    (serve_dir_path / 'info.json').write_text(json.dumps(ret))


if __name__ == '__main__':
    make_shared_info_json()
