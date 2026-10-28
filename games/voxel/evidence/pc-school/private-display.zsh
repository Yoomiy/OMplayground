#!/bin/zsh
set -eu
cd /home/ubuntu/OMplayground
: > /tmp/voxel-school-desktop-display
LD_LIBRARY_PATH=/tmp/voxel-x11-runtime/root/usr/lib/aarch64-linux-gnu:/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu /tmp/voxel-x11-runtime/Xvfb -displayfd 3 -screen 0 1280x900x24 -nolisten tcp -ac -xkbdir /tmp/voxel-x11-runtime/root/usr/share/X11/xkb 3>/tmp/voxel-school-desktop-display > /tmp/voxel-school-desktop-xvfb.log 2>&1 &
voxel_pc_xvfb_pid=$!
print -r -- "$voxel_pc_xvfb_pid" > /tmp/voxel-school-desktop-xvfb.pid
trap 'kill "$voxel_pc_xvfb_pid" 2>/dev/null || true' EXIT
for voxel_display_wait in {1..50}; do
  if [ -s /tmp/voxel-school-desktop-display ]; then break; fi
  if ! kill -0 "$voxel_pc_xvfb_pid" 2>/dev/null; then cat /tmp/voxel-school-desktop-xvfb.log; exit 1; fi
  sleep 0.1
done
read -r voxel_pc_display < /tmp/voxel-school-desktop-display
voxel_pc_exit=0
DISPLAY=":$voxel_pc_display" LD_LIBRARY_PATH=/tmp/voxel-x11-runtime/root/usr/lib/aarch64-linux-gnu:/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf VOXEL_XDOTOOL=/tmp/voxel-x11-runtime/root/usr/bin/xdotool VOXEL_SURVIVAL_DESKTOP=1 VOXEL_SURVIVAL_NETWORK=1 node games/voxel/tools/browser-survival.ts > /tmp/voxel-school-desktop-browser.log 2>&1 || voxel_pc_exit=$?
print -r -- "$voxel_pc_exit" > /tmp/voxel-school-desktop-browser.exit
exit "$voxel_pc_exit"
