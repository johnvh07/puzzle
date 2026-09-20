#!/usr/bin/env python3

import os, sys, json, boto3, functools
from botocore.config import Config
from pathlib import Path
from collections.abc import Iterator

class NoSuchKey(Exception): pass


CREDS_PATH = Path('b2-secrets.json')

@functools.cache
def get_b2_client():
    creds = json.loads(CREDS_PATH.read_text())
    return boto3.client(
        's3',
        endpoint_url=creds['url'],
        aws_access_key_id=creds['key_id'],
        aws_secret_access_key=creds['application_key'],
        config=Config(signature_version='s3v4')
    )

@functools.cache
def get_default_bucket() -> str:
    creds = json.loads(CREDS_PATH.read_text())
    return creds['default_bucket']


def get_file_content(bkt:str|None, key:str) -> bytes:
    s3 = get_b2_client()
    if not bkt: bkt = get_default_bucket()
    try:
        res = s3.get_object(Bucket=bkt, Key=key)
        return res['Body'].read()
    except s3.exceptions.NoSuchKey:
        raise NoSuchKey()

def list_files(bkt:str, prefix:str, recursive:bool=False, max_keys:int|None=None) -> Iterator[str]:
    if recursive:
        for page in get_b2_client().get_paginator('list_objects_v2').paginate(Bucket=bkt, Prefix=prefix, MaxKeys=(max_keys if max_keys and max_keys<1000 else 1000), PaginationConfig={'MaxItems':max_keys}):
            for obj in page.get('Contents',[]):
                yield f"{bkt}/{obj['Key']}"
    else:
        for page in get_b2_client().get_paginator('list_objects_v2').paginate(Bucket=bkt, Prefix=prefix, Delimiter='/', MaxKeys=(max_keys if max_keys and max_keys<1000 else 1000), PaginationConfig={'MaxItems':max_keys}):
            for obj in page.get('CommonPrefixes',[]):
                yield f"{bkt}/{obj['Prefix']}"
            for obj in page.get('Contents',[]):
                yield f"{bkt}/{obj['Key']}"

