server {
  server_name motionpuzzle.com;

  location / {
    include proxy_params;
    proxy_pass http://localhost:8003;
    client_max_body_size 100M;
  }

  access_log /var/log/nginx/motionpuzzle.com.access;
  error_log /var/log/nginx/motionpuzzle.com.error error;

  listen 443 ssl; # managed by Certbot
  ssl_certificate /etc/letsencrypt/live/motionpuzzle.com/fullchain.pem; # managed by Certbot
  ssl_certificate_key /etc/letsencrypt/live/motionpuzzle.com/privkey.pem; # managed by Certbot
  include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
  ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}
server {
  server_name motionpuzzle.com;
  listen 80;

  if ($host = motionpuzzle.com) {
      return 301 https://$host$request_uri;
  } # managed by Certbot
  return 404; # managed by Certbot
}
