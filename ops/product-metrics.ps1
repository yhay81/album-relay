[CmdletBinding()]
param(
    [switch]$Local
)

$ErrorActionPreference = "Stop"
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$SqlPath = Join-Path $PSScriptRoot "product-metrics.sql"
$Wrangler = Join-Path $RepoRoot "node_modules\.bin\wrangler.cmd"
$Target = if ($Local) { "--local" } else { "--remote" }
$Sql = (Get-Content $SqlPath) -join " "

$Output = & $Wrangler d1 execute album-relay $Target --json --command $Sql
if ($LASTEXITCODE -ne 0) {
    throw "D1 metrics query failed with exit code $LASTEXITCODE"
}

$Payload = ($Output -join [Environment]::NewLine) | ConvertFrom-Json
$Row = $Payload[0].results[0]
if (-not $Row) {
    throw "D1 metrics query returned no result"
}

function Get-Percent {
    param(
        [int]$Numerator,
        [int]$Denominator
    )

    if ($Denominator -eq 0) { return 0.0 }
    return [Math]::Round(($Numerator / $Denominator) * 100, 1)
}

$Users = [int]$Row.users
$ActivatedOwners = [int]$Row.activated_owners
$AlbumsWithPhoto = [int]$Row.albums_with_photo
$SharedAlbums = [int]$Row.shared_albums
$SuccessfulAlbums = [int]$Row.successful_albums

[ordered]@{
    generated_at = (Get-Date).ToUniversalTime().ToString("o")
    service = "album-relay"
    environment = if ($Local) { "local" } else { "production" }
    funnel = [ordered]@{
        users = $Users
        activated_owners = $ActivatedOwners
        albums = [int]$Row.albums
        albums_with_photo = $AlbumsWithPhoto
        shared_albums = $SharedAlbums
        viewed_albums = [int]$Row.viewed_albums
        successful_albums = $SuccessfulAlbums
        repeat_owners = [int]$Row.repeat_owners
        signups_7d = [int]$Row.signups_7d
    }
    rates = [ordered]@{
        signup_to_album_percent = Get-Percent $ActivatedOwners $Users
        photo_to_share_percent = Get-Percent $SharedAlbums $AlbumsWithPhoto
        share_to_download_percent = Get-Percent $SuccessfulAlbums $SharedAlbums
    }
} | ConvertTo-Json -Depth 4
