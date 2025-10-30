# Install the latest xyOps Satellite for Windows x64.
# Copyright (c) 2026 PixlCore LLC.  BSD 3-Clause License.

# Pre-populated variables (these values will be replaced server-side)
$auth_token = "[auth_token]"
$base_url   = "[base_url]"

# Construct URLs for the package and the configuration file.
$scriptUrl = "$base_url/api/app/satellite/install?t=$auth_token&os=windows&arch=x64"
$packageUrl = "$base_url/api/app/satellite/core?t=$auth_token&os=windows&arch=x64"
$configUrl  = "$base_url/api/app/satellite/config?t=$auth_token"

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

# Define the installation directory.
# Using Program Files is a standard location for system-wide applications.
$installDir = Join-Path $env:ProgramFiles "xyOps Satellite"
Write-Output "Installing xyOps Satellite to: $installDir"

# Check if the application is already installed
$packageJsonPath = Join-Path $installDir "package.json"
if (Test-Path $packageJsonPath) {
    Write-Error "xyOps Satellite is already installed in $installDir. Please uninstall the existing version first."
    exit 1
}

# Create the installation directory if it doesn't exist.
if (-Not (Test-Path $installDir)) {
    New-Item -Path $installDir -ItemType Directory | Out-Null
}

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
    tar -xf $tempPackageFile -C $installDir
} catch {
    Write-Error "Extraction failed: $_"
    exit 1
}

# Clean up the downloaded package file.
Remove-Item $tempPackageFile -Force

Write-Output "Package extracted to $installDir."

# Download the configuration file and save it as config.json.
$configFilePath = Join-Path $installDir "config.json"
Write-Output "Downloading configuration from $base_url ..."
try {
    Invoke-WebRequest -Uri $configUrl -OutFile $configFilePath -UseBasicParsing
} catch {
    Write-Error "Failed to download configuration file: $_"
    exit 1
}

Write-Output "Configuration file saved to $configFilePath."

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

Write-Output "Running installation command..."
# Execute the final installation command.
& $nodePath $mainJs --install

Write-Output "xyOps Satellite installation complete."
