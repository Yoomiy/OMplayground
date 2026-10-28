#!/bin/zsh
set -eu
cd /home/ubuntu/OMplayground
export LD_LIBRARY_PATH=/tmp/playground-browser-libs/root/usr/lib/aarch64-linux-gnu:/tmp/voxel-postgres-runtime/usr/lib/aarch64-linux-gnu
export FONTCONFIG_FILE=/tmp/playground-browser-libs/fonts.conf
export VOXEL_TEST_POSTGRES=1 VOXEL_PG_BIN=/tmp/voxel-postgres-runtime/usr/lib/postgresql/16/bin
export PGHOST=127.0.0.1 PGPORT=55439 PGUSER=ubuntu
if "$VOXEL_PG_BIN/pg_ctl" -D /tmp/voxel-postgres-data status > /tmp/voxel-legacy-assets-postgres-before.log 2>&1; then
  print -u2 'Existing local Postgres process found; refusing to own or stop it.'
  exit 3
fi
"$VOXEL_PG_BIN/pg_ctl" -D /tmp/voxel-postgres-data -l /tmp/voxel-legacy-assets-postgres.log -o '-p 55439 -h 127.0.0.1 -c unix_socket_directories=/tmp/voxel-postgres-socket' start > /tmp/voxel-legacy-assets-postgres-start.log 2>&1
trap '"$VOXEL_PG_BIN/pg_ctl" -D /tmp/voxel-postgres-data -m fast stop > /tmp/voxel-legacy-assets-postgres-stop.log 2>&1' EXIT
set +e
node --test apps/voxel-server/tests/postgres/service.test.ts > /tmp/voxel-legacy-assets-postgres-service.log 2>&1
sql_code=$?
set -e
print "$sql_code" > /tmp/voxel-legacy-assets-postgres-service.exit
(( sql_code == 0 )) || exit "$sql_code"
export VOXEL_TEST_LIVEKIT=0 VOXEL_REACT_MOUNT_CYCLES=2
set +e
node apps/web/tools/voxel-react-browser.ts > /tmp/voxel-legacy-assets-react.log 2>&1
react_code=$?
set -e
print "$react_code" > /tmp/voxel-legacy-assets-react.exit
exit "$react_code"
