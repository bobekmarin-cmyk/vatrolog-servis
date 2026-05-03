$ErrorActionPreference = "Stop"

$base = if ($args.Count -ge 1 -and $args[0]) { $args[0] } else { "http://localhost:3000" }
$uri = "$base/api/platform/auth/login"

$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{
  username = "owner"
  password = "owner123"
}

try {
  $resp = Invoke-WebRequest -Uri $uri -Method Post -Body $body -WebSession $session -MaximumRedirection 0
  Write-Host "StatusCode:" $resp.StatusCode
  Write-Host "Location:" $resp.Headers["Location"]
  Write-Host "Set-Cookie:" $resp.Headers["Set-Cookie"]
} catch {
  if ($_.Exception -and $_.Exception.Response) {
    $r = $_.Exception.Response
    Write-Host "StatusCode:" ([int]$r.StatusCode)
    Write-Host "Location:" $r.Headers["Location"]
    Write-Host "Set-Cookie:" $r.Headers["Set-Cookie"]

    try {
      $stream = $r.GetResponseStream()
      if ($stream) {
        $reader = New-Object System.IO.StreamReader($stream)
        $text = $reader.ReadToEnd()
        if ($text) {
          Write-Host "Body:"
          Write-Host $text
        }
      }
    } catch { }
  } else {
    throw
  }
}

Write-Host ""
Write-Host "Cookies in session:"
$session.Cookies.GetCookies($base) | Format-Table Name, Value, Path, Domain -AutoSize

