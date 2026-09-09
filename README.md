
cd /home/c837269833/UI
sudo docker build -t xqpi-ui .

sudo docker rm -f xqpi-frontend-instance 2>/dev/null || true

sudo docker run -d \
  --name xqpi-frontend-instance \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e NEXTAUTH_SECRET=a_super_secure_random_string_here_2026 \
  -e NEXTAUTH_URL=https://xqpi.engr.colostate.edu \
  -v /net/trinity/projects:/net/trinity/projects \
  -v /net/trinity/projects/xqpi/PRODUCT_IMAGES/composite_ref:/app/public/products/composite_ref:ro \
  -v /net/trinity/projects/xqpi/PRODUCT_IMAGES/qpe_1hr:/app/public/products/qpe_1hr:ro \
  -v /net/trinity/projects/xqpi/PRODUCT_IMAGES/qpe_15min:/app/public/products/qpe_15min:ro \
  -v /net/trinity/projects/xqpi/PRODUCT_IMAGES/radar_precip_rate:/app/public/products/radar_precip_rate:ro \
  --restart always \
  xqpi-ui
