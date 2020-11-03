#!/usr/bin/env python3

import json
from pathlib import Path


def generate_shared_info_json(serve_dir):
    ret = []
    for dirpath in Path(serve_dir).iterdir():
        if dirpath.is_dir():
            j = json.loads((dirpath / 'info.json').read_text())
            j['name'] = dirpath.name
            j['thumbnail_url'] = f'https://petervh.com/live/{dirpath.name}/1.jpg'
            ret.append(j)
    shared_info_json_path = Path(serve_dir) / 'info.json'
    shared_info_json_path.write_text(json.dumps(ret))


if __name__ == '__main__':
    generate_shared_info_json('/var/www/html/live/')
