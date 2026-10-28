#!/bin/zsh
set -eu
cd /home/ubuntu/OMplayground
voxel_check_prefix=/tmp/voxel-input-backlog-
runstep() {
  local voxel_step_name=$1
  shift
  print -r -- "START $voxel_step_name" >> "${voxel_check_prefix}qualification-progress.log"
  local voxel_step_exit=0
  "$@" > "${voxel_check_prefix}${voxel_step_name}.log" 2>&1 || voxel_step_exit=$?
  print -r -- "$voxel_step_exit" > "${voxel_check_prefix}${voxel_step_name}.exit"
  print -r -- "END $voxel_step_name $voxel_step_exit" >> "${voxel_check_prefix}qualification-progress.log"
  return "$voxel_step_exit"
}
runstep service-tests npm test --workspace @playground/voxel-server &
voxel_service_pid=$!
runstep web-tests npm test --workspace @playground/web &
voxel_web_pid=$!
wait "$voxel_service_pid"
wait "$voxel_web_pid"
runstep types node games/voxel/node_modules/typescript/bin/tsc --noEmit -p games/voxel/tsconfig.json &
voxel_types_pid=$!
runstep service-types node_modules/.bin/tsc --noEmit -p apps/voxel-server/tsconfig.json &
voxel_service_types_pid=$!
runstep web-types node_modules/.bin/tsc --noEmit -p apps/web/tsconfig.json &
voxel_web_types_pid=$!
wait "$voxel_types_pid"
wait "$voxel_service_types_pid"
wait "$voxel_web_types_pid"
runstep web-build npm run build --workspace @playground/web
runstep startup node --env-file=apps/minecraft-server/.env --env-file=apps/voxel-server/.env /tmp/voxel-snapshot-startup.mjs
cp /tmp/voxel-snapshot-startup.json "${voxel_check_prefix}startup.json"
runstep release-verify node games/voxel/tools/verify-release.mjs
/tmp/voxel-postgres-runtime/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/voxel-postgres-data -l /tmp/voxel-input-backlog-postgres.log -o '-p 55439 -h 127.0.0.1 -c unix_socket_directories=/tmp/voxel-postgres-socket' start > /tmp/voxel-input-backlog-postgres-start.log 2>&1
trap '/tmp/voxel-postgres-runtime/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/voxel-postgres-data stop -m fast > /tmp/voxel-input-backlog-postgres-stop.log 2>&1' EXIT
runstep react-browser env LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu:/tmp/voxel-postgres-runtime/usr/lib/aarch64-linux-gnu FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf VOXEL_TEST_LIVEKIT=0 VOXEL_REACT_MOUNT_CYCLES=6 VOXEL_TEST_POSTGRES=1 VOXEL_PG_BIN=/tmp/voxel-postgres-runtime/usr/lib/postgresql/16/bin PGHOST=127.0.0.1 PGPORT=55439 PGUSER=ubuntu node apps/web/tools/voxel-react-browser.ts
/tmp/voxel-postgres-runtime/usr/lib/postgresql/16/bin/pg_ctl -D /tmp/voxel-postgres-data stop -m fast > /tmp/voxel-input-backlog-postgres-stop.log 2>&1
trap - EXIT
runstep presentation env LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf node games/voxel/tools/browser-presentation.ts
runstep sockets env VOXEL_BENCH_LAYOUTS=1x16,1x32,1x64,1x128,2x32,4x16 VOXEL_BENCH_SECONDS=25 node games/voxel/tools/benchmark-sockets.mjs
runstep survival env VOXEL_SURVIVAL_SECONDS=180 VOXEL_SURVIVAL_ROOMS=2 VOXEL_SURVIVAL_PLAYERS=8 VOXEL_SURVIVAL_IO_MS=5 node games/voxel/tools/benchmark-survival-workers.ts
runstep survival-audit node games/voxel/tools/check-survival-workers.ts
print -r -- 'Local functional, workload and recovery commands completed.'
