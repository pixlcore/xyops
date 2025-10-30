# Upgrade to the latest xyOps Satellite for Windows x64.
# Copyright (c) 2026 PixlCore LLC.  BSD 3-Clause License.

# Pre-populated variables (these values will be replaced server-side)
$server_id  = "[server_id]"
$auth_token = "[auth_token]"
$base_url   = "[base_url]"

# Construct URLs for the package and the configuration file.
$scriptUrl = "$base_url/api/app/satellite/upgrade?s=$server_id&t=$auth_token&os=windows&arch=x64"
$packageUrl = "$base_url/api/app/satellite/core?s=$server_id&t=$auth_token&os=windows&arch=x64"

# --- Auto-Elevation Block ---
$principal = New-Object Security.Principal.WindowsPrincipal([Security.Principal.WindowsIdentity]::GetCurrent())
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Output "Not running as Administrator. Attempting to re-launch as Administrator..."
    
    # Download the full script to a temporary file.
    $tempFile = Join-Path $env:TEMP "xyOpsSatellite_install_temp.ps1"
    try {
        Invoke-WebRequest -Uri $scriptUrl -OutFile $tempFile -UseBasicParsing
    } catch {
        Write-Error "Failed to download the script for elevation: $_"
        exit 1
    }
    
    # Relaunch the temporary file with elevated privileges.
    $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$tempFile`""
    try {
        Start-Process powershell -Verb RunAs -ArgumentList $arguments
    } catch {
        Write-Error "Failed to launch elevated process: $_"
        exit 1
    }
    exit
}
# --- End Auto-Elevation Block ---

# Make sure we have tar
try {
    $tarCmd = Get-Command tar -ErrorAction Stop
    $tarPath = $tarCmd.Source
}
catch {
    Write-Error "tar.exe not found in PATH. Cannot run upgrade script."
    exit 1
}

# Define the installation directory.
# Using Program Files is a standard location for system-wide applications.
$installDir = Join-Path $env:ProgramFiles "xyOps Satellite"
Write-Output "Upgrading xyOps Satellite to: $installDir"

# Check if the application is already installed
$packageJsonPath = Join-Path $installDir "package.json"
if (-Not (Test-Path $packageJsonPath)) {
    Write-Error "xyOps Satellite is not installed in $installDir. Upgrade cannot continue."
    exit 1
}

# Define paths to node.exe and main.js within the extracted package.
$nodePath = Join-Path $installDir "bin\node.exe"
$mainJs   = Join-Path $installDir "main.js"

# Verify that node.exe and main.js exist.
if (-Not (Test-Path $nodePath)) {
    Write-Error "Node executable not found at $nodePath. Installation cannot continue."
    exit 1
}

if (-Not (Test-Path $mainJs)) {
    Write-Error "Main script not found at $mainJs. Installation cannot continue."
    exit 1
}

# Stop running service
Write-Output "Stop existing service..."
& $nodePath $mainJs --stop

# Sanity sleep (because windows is windows)
Start-Sleep -Seconds 5

# Download the package tarball.
$tempPackageFile = Join-Path $env:TEMP "xyOpsSatellite.tar.gz"
Write-Output "Downloading package from $base_url ..."
try {
    Invoke-WebRequest -Uri $packageUrl -OutFile $tempPackageFile -UseBasicParsing
} catch {
    Write-Error "Failed to download package: $_"
    exit 1
}

Write-Output "Extracting package..."
try {
    # Windows 10 and later include a tar utility.
    & $tarPath -xf $tempPackageFile -C $installDir
} catch {
    Write-Error "Extraction failed: $_"
    exit 1
}

# Clean up the downloaded package file.
Remove-Item $tempPackageFile -Force

Write-Output "Package extracted to $installDir."

Write-Output "Running install/start command..."
& $nodePath $mainJs --install

Write-Output "xyOps Satellite upgrade complete."
