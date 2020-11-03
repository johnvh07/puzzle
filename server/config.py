
from pathlib import Path


upload_dir_path = Path(__file__).with_name('livepuzzle-uploads')
upload_dir_path.mkdir(parents=True, exist_ok=True)
if upload_dir_path.stat().st_mode & 0o777 != 0o777: upload_dir_path.chmod(0o777)

serve_dir_path = Path('/var/www/html/live')
serve_dir_path.mkdir(parents=True, exist_ok=True)
if serve_dir_path.stat().st_mode & 0o777 != 0o777: serve_dir_path.chmod(0o777)

hosting_base_url = 'https://petervh.com/live'
