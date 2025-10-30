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

# See if we can even reach the master server
TEST_URL="${BASE_URL}/api/app/ping"
RC=0
TEST_OUT=$($CURL "$TEST_URL" 2>&1) || RC=$?
if [ $RC != 0 ]; then
	echo "Error: The installer cannot reach $BASE_URL"
	echo "Please make sure this machine has network access."
	echo "Test output:"
	echo $TEST_OUT
	exit 1;
fi

echo "Upgrading xyOps Satellite for ${OS}/${ARCH}..."

# Create directories
cd $INSTALL_DIR

# Download satellite package
$CURL "${BASE_URL}/api/app/satellite/core?s=${SERVER_ID}&t=${AUTH_TOKEN}&os=${OS}&arch=${ARCH}" | tar zxf -

# Set some permissions
chmod 775 *.sh bin/*

# Stop running service
./bin/node main.js stop

# start satellite in background
if [ -z "${SATELLITE_foreground+x}" ]; then
	./bin/node main.js start
fi

# And we're done
echo "Upgrade complete."
