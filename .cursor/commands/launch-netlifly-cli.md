netlify dev --framework="#static" --port 8888
Start-Sleep -Seconds 3
Invoke-WebRequest -Uri "http://localhost:8888" -UseBasicParsing | Select-Object StatusCode