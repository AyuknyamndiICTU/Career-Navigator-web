#!/bin/sh
# Copies every object from the old MinIO bucket to the new S3 bucket (Cloudflare R2 or Garage), then verifies
# object counts and checksums. Object keys are kept, so stored references stay valid. Run it BEFORE deploying the
# release that removes MinIO (deploy.sh's --remove-orphans stops the minio container; its volume is kept).
#
#   OLD_ENDPOINT=http://minio:9000 OLD_ACCESS_KEY=... OLD_SECRET_KEY=... OLD_BUCKET=resumes \
#   NEW_ENDPOINT=https://<account>.r2.cloudflarestorage.com NEW_ACCESS_KEY=... NEW_SECRET_KEY=... \
#   NEW_BUCKET=career-navigator NEW_REGION=auto NETWORK=<compose project>_default sh migrate-storage.sh
#
# Re-running is safe (copy only transfers what changed and never deletes from the destination, so objects uploaded
# to the new bucket in the meantime survive). Add DRY_RUN=1 to see what would be copied.
set -eu

: "${OLD_ENDPOINT:?}" "${OLD_ACCESS_KEY:?}" "${OLD_SECRET_KEY:?}" "${OLD_BUCKET:=resumes}"
: "${NEW_ENDPOINT:?}" "${NEW_ACCESS_KEY:?}" "${NEW_SECRET_KEY:?}" "${NEW_BUCKET:=career-navigator}" "${NEW_REGION:=auto}"
: "${NEW_PROVIDER:=Other}" # Cloudflare for R2
: "${NETWORK:=bridge}"

rclone() {
  docker run --rm --network "$NETWORK" \
    -e RCLONE_CONFIG_OLD_TYPE=s3 -e RCLONE_CONFIG_OLD_PROVIDER=Minio \
    -e RCLONE_CONFIG_OLD_ENDPOINT="$OLD_ENDPOINT" \
    -e RCLONE_CONFIG_OLD_ACCESS_KEY_ID="$OLD_ACCESS_KEY" -e RCLONE_CONFIG_OLD_SECRET_ACCESS_KEY="$OLD_SECRET_KEY" \
    -e RCLONE_CONFIG_NEW_TYPE=s3 -e RCLONE_CONFIG_NEW_PROVIDER="$NEW_PROVIDER" \
    -e RCLONE_CONFIG_NEW_ENDPOINT="$NEW_ENDPOINT" -e RCLONE_CONFIG_NEW_REGION="$NEW_REGION" \
    -e RCLONE_CONFIG_NEW_FORCE_PATH_STYLE=true \
    -e RCLONE_CONFIG_NEW_ACCESS_KEY_ID="$NEW_ACCESS_KEY" -e RCLONE_CONFIG_NEW_SECRET_ACCESS_KEY="$NEW_SECRET_KEY" \
    -e RCLONE_S3_NO_CHECK_BUCKET=true \
    rclone/rclone:1.75.2 "$@"
}

echo "Source:      $(rclone size "old:$OLD_BUCKET" --json)"
if [ "${DRY_RUN:-}" = "1" ]; then
  rclone copy "old:$OLD_BUCKET" "new:$NEW_BUCKET" --checksum --dry-run
  exit 0
fi
rclone copy "old:$OLD_BUCKET" "new:$NEW_BUCKET" --checksum --transfers 4 --stats-one-line --stats 10s
echo "Destination: $(rclone size "new:$NEW_BUCKET" --json)"
# Every source object must exist in the destination with the same size and MD5.
rclone check "old:$OLD_BUCKET" "new:$NEW_BUCKET" --one-way --checksum
echo "Copy verified. Set S3_* in .env and deploy; keep MINIO_* and the minio volume until the new storage is checked."
