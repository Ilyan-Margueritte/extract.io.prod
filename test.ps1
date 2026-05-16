$apiKey = "ek_8795f22e446f487eb7467f5e57e786ad"
$url = "https://uandglam.com"

$body = @{
    url = $url
} | ConvertTo-Json

$response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/api/v1/public/scrape" `
    -Method POST `
    -Headers @{
        "X-API-Key" = $apiKey
        "Content-Type" = "application/json"
    } `
    -Body $body `
    -UseBasicParsing

$response.Content | ConvertFrom-Json | ForEach-Object {
    $_.PSObject.Properties | ForEach-Object {
        if ($_.Name -eq "result") {
            Write-Host "$($_.Name): $($_.Value | ConvertTo-Json -Compress)"
        } else {
            Write-Host "$($_.Name): $($_.Value)"
        }
    }
}