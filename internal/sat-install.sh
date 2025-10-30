#!/bin/sh

# Install the latest xyOps Satellite to /opt/xyops/satellite/
# Copyright (c) 2026 PixlCore LLC.  BSD 3-Clause License.

set -eu

AUTH_TOKEN="[auth_token]"
BASE_URL="[base_url]"
INSTALL_DIR="/opt/xyops/satellite"

# Check if satellite is already installed
if [ -f "$INSTALL_DIR/package.json" ]; then
    echo "Error: xyOps Satellite appears to be already installed in $INSTALL_DIR/"
    echo "If you wish to reinstall, please remove the existing installation first."
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

echo ""
echo "Installing xyOps Satellite for ${OS}/${ARCH}..."

# Create directories
mkdir -p $INSTALL_DIR
cd $INSTALL_DIR

# Download satellite package
$CURL "${BASE_URL}/api/app/satellite/core?t=${AUTH_TOKEN}&os=${OS}&arch=${ARCH}" | tar zxf -

# Fetch custom config for satellite
$CURL "${BASE_URL}/api/app/satellite/config?t=${AUTH_TOKEN}" > config.json
chmod 600 config.json

# Set some permissions
chmod 775 *.sh bin/*

# install boot service
./bin/node main.js install

# start satellite in background
./bin/node main.js start
