$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$componentRoot = Join-Path $projectRoot 'custom_components\multi_location_energy'
$distRoot = Join-Path $projectRoot 'dist'
$stageRoot = Join-Path $distRoot ('stage-' + [Guid]::NewGuid().ToString('N'))
$stageComponent = Join-Path $stageRoot 'multi_location_energy'
New-Item -ItemType Directory -Path $stageComponent -Force | Out-Null

foreach ($componentFile in Get-ChildItem -LiteralPath $componentRoot -Recurse -File) {
    if ($componentFile.FullName -match '[\\/]__pycache__[\\/]' -or $componentFile.Extension -eq '.pyc') { continue }
    $relativeFile = [IO.Path]::GetRelativePath($componentRoot, $componentFile.FullName)
    $destinationFile = Join-Path $stageComponent $relativeFile
    New-Item -ItemType Directory -Path (Split-Path -Parent $destinationFile) -Force | Out-Null
    Copy-Item -LiteralPath $componentFile.FullName -Destination $destinationFile
}
$componentVersion = (Get-Content -LiteralPath (Join-Path $componentRoot 'manifest.json') -Raw | ConvertFrom-Json).version
$archivePath = Join-Path $distRoot "multi_location_energy-$componentVersion.zip"
Compress-Archive -LiteralPath $stageComponent -DestinationPath $archivePath -Force
Get-FileHash -LiteralPath $archivePath -Algorithm SHA256 | Format-List
