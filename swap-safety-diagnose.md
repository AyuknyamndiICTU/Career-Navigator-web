# Swap Safety Diagnose (Milestone 0.4)

Run these on your VPS (`root@38.242.246.126`) and paste the output here.

## A) Confirm swapfile exists + size
```bash
ls -lah /swapfile || echo "NO /swapfile"
```

## B) Confirm swap is registered
```bash
cat /proc/swaps
swapon --show || true
```

## C) If /swapfile exists: confirm it's a valid swap device
```bash
file /swapfile || true
```

## D) Recreate/initialize swap (ONLY if /swapfile exists OR you are okay overwriting)
> This will overwrite swapfile metadata; keep if you’re sure you want swap enabled.
```bash
mkswap /swapfile
swapon /swapfile
swapon --show
free -h
```

## E) Check permissions
```bash
stat /swapfile || true
```

## F) Check fstab for persistence
```bash
grep -n '/swapfile' /etc/fstab || true
