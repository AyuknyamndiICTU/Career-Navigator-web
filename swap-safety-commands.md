# Swap Safety Commands (VPS Milestone 0.4)

These commands create and enable a swapfile to reduce OOM crashes on your **4 CPU / 8GB RAM** VPS.

## Assumptions
- You have root SSH access to `root@38.242.246.126`
- You want swap at `/swapfile`
- `/swapfile` may or may not already exist

---

## 1) SSH into your VPS
```bash
ssh root@38.242.246.126
```

---

## 2) Check current swap status
```bash
swapon --show
free -h
cat /proc/swaps
```

---

## 3) If `/swapfile` exists, remove it (optional safety)
Run this only if the file exists and you want to recreate swap cleanly:
```bash
ls -lh /swapfile || true
[ -e /swapfile ] && swapoff -a || true
[ -e /swapfile ] && rm -f /swapfile || true
```

---

## 4) Create swapfile (default 6GB)
> If you want a different size, change `6G` and `6144` accordingly.
- 4GB => `4G` and `count=4096`
- 8GB => `8G` and `count=8192`

### Option A (recommended): fallocate
```bash
fallocate -l 6G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=6144
```

### If `fallocate` is not available
The `dd` line above will be used automatically.

---

## 5) Secure permissions
```bash
chmod 600 /swapfile
```

---

## 6) Format the swapfile
```bash
mkswap /swapfile
```

---

## 7) Enable swap immediately
```bash
swapon /swapfile
```

---

## 8) Verify swap is active
Swap should show non-zero values in both checks:
```bash
swapon --show
free -h
cat /proc/swaps
```

---

## 9) Make swap persistent after reboot
### Check whether `/swapfile` is already in `/etc/fstab`
```bash
grep -n '/swapfile' /etc/fstab || true
```

### If missing, append it
```bash
grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

Optional:
```bash
tail -n 20 /etc/fstab
```

---

## After you run it
Paste the output of:
```bash
swapon --show
free -h
cat /proc/swaps
```
and we’ll mark Milestone 0.4 as completed in `improve-plan.md`.
