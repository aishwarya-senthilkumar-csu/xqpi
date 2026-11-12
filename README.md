# Deploy XQPI frontend changes

Run these steps on the XQPI server after saving your code changes.

## 1. Build the new image

```bash
cd /home/c837269833/UI && sudo docker build -t xqpi-ui .
```

## 2. Deploy the new container

After the build succeeds, paste the entire block. It reuses the production settings, attaches all five Trinity mounts, and keeps the old container available for rollback.

```bash
(
set -euo pipefail

current=xqpi-frontend-instance
previous=xqpi-frontend-rollback

xqpi_env=$(
  sudo docker inspect --format '{{range .Config.Env}}{{println .}}{{end}}' "$current" |
    grep -E '^(NEXTAUTH_SECRET|NEXTAUTH_URL|NODE_ENV)='
)
printf '%s\n' "$xqpi_env" | grep -q '^NEXTAUTH_SECRET=.'

sudo docker rename "$current" "$previous"

if ! printf '%s\n' "$xqpi_env" | sudo docker create \
  --name "$current" \
  --env-file /dev/stdin \
  --mount type=bind,src=/net/trinity/projects,dst=/net/trinity/projects \
  --mount type=bind,src=/net/trinity/projects/xqpi/PRODUCT_IMAGES/composite_ref,dst=/app/public/products/composite_ref,readonly \
  --mount type=bind,src=/net/trinity/projects/xqpi/PRODUCT_IMAGES/qpe_1hr,dst=/app/public/products/qpe_1hr,readonly \
  --mount type=bind,src=/net/trinity/projects/xqpi/PRODUCT_IMAGES/qpe_15min,dst=/app/public/products/qpe_15min,readonly \
  --mount type=bind,src=/net/trinity/projects/xqpi/PRODUCT_IMAGES/radar_precip_rate,dst=/app/public/products/radar_precip_rate,readonly \
  -p 3000:3000 \
  --restart always \
  xqpi-ui; then
  sudo docker rename "$previous" "$current"
  exit 1
fi
unset xqpi_env

sudo docker stop "$previous"
if ! sudo docker start "$current"; then
  sudo docker rm "$current"
  sudo docker rename "$previous" "$current"
  sudo docker start "$current"
  exit 1
fi

sudo docker logs --tail=40 "$current"
)
```

## 3. Verify the website and finish

Open [XQPI production](https://xqpi.engr.colostate.edu) and test the feature you changed. Once it works, remove the old container.

```bash
sudo docker rm xqpi-frontend-rollback
```

## If something goes wrong

### Issue 1: The build fails

Fix the error shown by Docker and repeat Step 1. Continue to Step 2 after the build succeeds.

### Issue 2: Docker says the rollback name is already in use

If the current website is working and you no longer need the old rollback container, run the cleanup command in Step 3 and retry Step 2.

### Issue 3: Radar data is missing or Docker reports a mount error

Check the mounts on the frontend container.

```bash
sudo docker inspect --format \
  '{{range .Mounts}}{{printf "%s -> %s (rw=%t)\n" .Source .Destination .RW}}{{end}}' \
  xqpi-frontend-instance
```

If Docker reports a missing source path, check that the Trinity directories listed in Step 2 exist and contain data on the host. If a container mapping is missing, Step 2 recreates the container with all five mounts. You can skip Step 1 if you want to reuse the existing image. If the failed deployment left a rollback container, restore it first using the commands below.

### Issue 4: The website or updated feature fails after deployment

If Step 2 already restored the previous frontend, check the site. If the new container is still in place and the stopped rollback container is available, restore it.

```bash
sudo docker container inspect xqpi-frontend-rollback >/dev/null &&
sudo docker rm -f xqpi-frontend-instance &&
sudo docker rename xqpi-frontend-rollback xqpi-frontend-instance &&
sudo docker start xqpi-frontend-instance
```
