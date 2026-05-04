$ErrorActionPreference = "Stop"

$files = @(
  "src\app\api\work-orders\[id]\items\[itemId]\fill\route.ts",
  "src\app\api\platform\companies\[companyId]\impersonate\route.ts",
  "src\app\api\work-orders\[id]\unlock\route.ts",
  "src\app\api\platform\companies\[companyId]\accounts\[accountUserId]\toggle-active\route.ts",
  "src\app\api\platform\companies\[companyId]\accounts\[accountUserId]\force-logout\route.ts",
  "src\app\api\work-orders\create\route.ts",
  "src\app\api\platform\gmail\connect\route.ts",
  "src\app\api\platform\gmail\callback\route.ts",
  "src\app\api\platform\manufacturers\create\route.ts",
  "src\app\api\platform\companies\[companyId]\update\route.ts",
  "src\app\api\platform\companies\create\route.ts",
  "src\app\api\platform\impersonation\stop\route.ts",
  "src\app\api\work-orders\[id]\items\[itemId]\service\route.ts",
  "src\app\api\platform\companies\[companyId]\accounts\[accountUserId]\send-setup\route.ts",
  "src\app\api\platform\companies\[companyId]\accounts\[accountUserId]\send-invite\route.ts",
  "src\app\api\platform\companies\[companyId]\accounts\create\route.ts",
  "src\app\api\platform\companies\[companyId]\accounts\[accountUserId]\send-reset\route.ts",
  "src\app\api\work-orders\[id]\lock\route.ts",
  "src\app\api\auth\verify-email\route.ts",
  "src\app\api\admin\servicers\create\route.ts",
  "src\app\api\platform\companies\[companyId]\accounts\[accountUserId]\reset-password\route.ts",
  "src\app\api\work-orders\[id]\items\[itemId]\delete\route.ts",
  "src\app\api\gmail\callback\route.ts",
  "src\app\api\work-orders\[id]\update-date\route.ts",
  "src\app\api\reports\monthly\snooze\route.ts",
  "src\app\api\customers\[customerId]\departments\[departmentId]\update\route.ts",
  "src\app\api\customers\[customerId]\departments\create\route.ts",
  "src\app\api\platform\manufacturers\[manufacturerId]\delete\route.ts",
  "src\app\api\work-orders\[id]\items\[itemId]\update-extinguisher\route.ts",
  "src\app\api\admin\servicers\[userId]\toggle\route.ts",
  "src\app\api\platform\companies\[companyId]\features\delete\route.ts",
  "src\app\api\platform\companies\[companyId]\features\upsert\route.ts",
  "src\app\api\platform\gmail\disconnect\route.ts",
  "src\app\api\platform\manufacturers\[manufacturerId]\update\route.ts",
  "src\app\api\platform\manufacturers\[manufacturerId]\types\remove\route.ts"
)

# Inner of new URL(...): we want a balanced single argument before ", req.url".
# Using lazy match because targets are simple template strings or string literals.
$rxStatusNumber = [regex]'(?s)NextResponse\.redirect\(\s*new URL\(\s*(?<target>.+?)\s*,\s*req\.url\s*,?\s*\)\s*,\s*(?<status>\d+)\s*,?\s*\)'
$rxStatusObject = [regex]'(?s)NextResponse\.redirect\(\s*new URL\(\s*(?<target>.+?)\s*,\s*req\.url\s*,?\s*\)\s*,\s*\{\s*status\s*:\s*(?<status>\d+)\s*\}\s*,?\s*\)'
$rxNoStatus    = [regex]'(?s)NextResponse\.redirect\(\s*new URL\(\s*(?<target>.+?)\s*,\s*req\.url\s*,?\s*\)\s*,?\s*\)'

foreach ($rel in $files) {
  $abs = Join-Path (Get-Location) $rel
  if (-not (Test-Path -LiteralPath $abs)) {
    Write-Host "SKIP missing: $rel" -ForegroundColor Yellow
    continue
  }

  $orig = Get-Content -LiteralPath $abs -Raw
  $new = $orig

  $new = $rxStatusObject.Replace($new, { param($m) "redirectRelative(" + $m.Groups['target'].Value + ", " + $m.Groups['status'].Value + ")" })
  $new = $rxStatusNumber.Replace($new, { param($m) "redirectRelative(" + $m.Groups['target'].Value + ", " + $m.Groups['status'].Value + ")" })
  $new = $rxNoStatus.Replace($new,    { param($m) "redirectRelative(" + $m.Groups['target'].Value + ", 307)" })

  if ($new -ne $orig) {
    if ($new -notmatch 'from\s+"@/lib/httpRedirect"') {
      $importLine = 'import { redirectRelative } from "@/lib/httpRedirect";'
      $importRx = [regex]'(?ms)^(import .+?;\s*\r?\n)+'
      $m = $importRx.Match($new)
      if ($m.Success) {
        $new = $new.Substring(0, $m.Index + $m.Length) + $importLine + "`r`n" + $new.Substring($m.Index + $m.Length)
      } else {
        $new = $importLine + "`r`n" + $new
      }
    }
    Set-Content -LiteralPath $abs -Value $new -NoNewline
    Write-Host "PATCHED: $rel" -ForegroundColor Green
  } else {
    Write-Host "NO-CHANGE: $rel" -ForegroundColor DarkGray
  }
}
