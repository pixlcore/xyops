#!/bin/sh

# Upgrade xyOps Satellite in /opt/xyops/satellite/
# Copyright (c) 2026 PixlCore LLC.  BSD 3-Clause License.

set -eu

SERVER_ID="[server_id]"
AUTH_TOKEN="[auth_token]"
BASE_URL="[base_url]"
INSTALL_DIR="/opt/xyops/satellite"

# Check if satellite is installed (required for upgrade)
if [ ! -f "$INSTALL_DIR/package.json" ]; then
    echo "Error: xyOps Satellite is not installed in $INSTALL_DIR/"
    echo "Cannot upgrade because no existing installation was found."
    exit 1
fi

# unset daemon flag (pixl-server)
unset __daemon

# Make sure we're logging everything
LOG_DIR="$INSTALL_DIR/logs"
LOG_FILE="$LOG_DIR/background.log"
mkdir -p $LOG_DIR
exec >>"$LOG_FILE" 2>&1

echo "Detecting OS and architecture..."

# Detect OS and architecture
OS="$(uname -s)"
ARCH="$(uname -m)"

# Normalize OS name
case "$OS" in
	Darwin) OS="darwin" ;;
	Linux) OS="linux" ;;
	*) echo "Error: Unsupported OS: $OS" >&2; exit 1 ;;
esac

# Normalize architecture name
case "$ARCH" in
	arm64) ARCH="arm64" ;;
	aarch64) ARCH="arm64" ;;
	x86_64) ARCH="x64" ;;
	amd64) ARCH="x64" ;;
	*) echo "Error: Unsupported architecture: $ARCH" >&2; exit 1 ;;
esac

# Use curl or wget to download files
CURL=
if type curl >/dev/null; then
	CURL="curl -fsSL --connect-timeout 10"
elif type wget >/dev/null; then
	CURL="wget -q -O- --connect-timeout 10"
fi
if [ -z "$CURL" ]; then
	echo "Error: The installer needs either 'curl' or 'wget' to download files." >&2;
	echo "Please install either utility to proceed." >&2;
	exit 1;
fi

# Download large files to disk before decomp
download_file() {
	URL="$1"
	OUT_FILE="$2"
	ATTEMPT=1
	MAX_ATTEMPTS=5
	
	while [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; do
		rm -f "$OUT_FILE"
		echo "Download attempt $ATTEMPT of $MAX_ATTEMPTS..."
		
		if type curl >/dev/null 2>&1; then
			curl -fsSL --connect-timeout 10 -o "$OUT_FILE" "$URL" && return 0
		else
			wget -q -O "$OUT_FILE" --connect-timeout 10 "$URL" && return 0
		fi
		
		ATTEMPT=$((ATTEMPT + 1))
		if [ "$ATTEMPT" -le "$MAX_ATTEMPTS" ]; then
			echo "Download failed, retrying in 5 seconds..."
			sleep 5
		fi
	done
	
	echo "Error: Download failed after $MAX_ATTEMPTS attempts." >&2
	return 1
}

# See if we can even reach the master server
TEST_URL="${BASE_URL}/api/app/ping"
echo "Pinging server: $TEST_URL ..."
RC=0
TEST_OUT=$($CURL "$TEST_URL" 2>&1) || RC=$?
if [ $RC != 0 ]; then
	echo "Error: The installer cannot reach $BASE_URL"
	echo "Please make sure this machine has network access."
	echo "Test output:"
	echo $TEST_OUT
	exit 1;
fi
echo "Ping successful."

echo "Upgrading xyOps Satellite for ${OS}/${ARCH}..."

# Create directories
cd $INSTALL_DIR

# Download satellite package
echo "Fetching package from $BASE_URL..."
CORE_TGZ="./.satellite-core.tgz.$$"
download_file "${BASE_URL}/api/app/satellite/core?s=${SERVER_ID}&t=${AUTH_TOKEN}&os=${OS}&arch=${ARCH}" "$CORE_TGZ"

echo "Decompressing archive..."
tar zxf "$CORE_TGZ"
rm -f "$CORE_TGZ"

# Set some permissions
chmod 775 *.sh bin/*

echo "Upgrade complete."
echo "Restarting service."

# If running in a container / foreground mode, stop ONLY and exit.
if [ -n "${SATELLITE_foreground+x}" ]; then
	echo "SATELLITE_foreground is set -- stopping service only."
	./bin/node main.js stop
	exit 0
fi

# Prefer systemd when present so systemctl keeps accurate state.
USE_SYSTEMD=0
if command -v systemctl >/dev/null 2>&1 && command -v systemd-run >/dev/null 2>&1; then
	# Avoid false-positives (e.g. systemctl installed but systemd isn't PID 1)
	if [ -d /run/systemd/system ]; then
		# Ask systemd first; fall back to unit-file existence checks.
		if systemctl list-unit-files 2>/dev/null | grep -q '^xysat\.service'; then
			USE_SYSTEMD=1
		elif [ -f /etc/systemd/system/xysat.service ] || [ -f /lib/systemd/system/xysat.service ] || [ -f /usr/lib/systemd/system/xysat.service ]; then
			USE_SYSTEMD=1
		fi
	fi
fi

if [ "$USE_SYSTEMD" -eq 1 ]; then
	echo "Linux systemd detected -- restarting via systemctl."
	if systemctl is-active --quiet xysat.service 2>/dev/null; then
		echo "xySat is active under systemd -- restarting via systemd-run handoff."
		systemd-run --quiet --collect --unit=xysat-upgrade-restart /bin/sh -c "/bin/systemctl restart xysat.service >>$LOG_FILE 2>&1"
		exit 0;
	fi
	echo "xySat is NOT active under systemd -- stopping manually, then starting under systemd."
	./bin/node main.js stop
	systemctl start xysat.service
else
	echo "Linux systemd not detected -- restarting via direct commands."
	./bin/node main.js stop
	./bin/node main.js start
fi
