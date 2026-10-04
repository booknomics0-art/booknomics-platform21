$ErrorActionPreference = "Stop"

Write-Host "Booknomics Audio Engine - Windows setup" -ForegroundColor Cyan

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python 3.11+ is required. Install Python first, then run this script again."
}
if (-not (Get-Command winget -ErrorAction SilentlyContinue)) {
  throw "Windows Package Manager (winget) is required for the one-click setup."
}

# IndicVoice uses eSpeak-NG as the fallback phonemizer for words its native G2P
# cannot resolve. Install the official WinGet package when it is missing.
if (-not (Get-Command espeak-ng -ErrorAction SilentlyContinue)) {
  Write-Host "Installing eSpeak-NG..." -ForegroundColor Yellow
  winget install --id eSpeak-NG.eSpeak-NG -e --accept-package-agreements --accept-source-agreements
}

python -m pip install --upgrade pip
python -m pip install numpy soundfile torch boto3
python -m pip install "git+https://github.com/Bindkushal/indic-g2p.git"
python -m pip install "git+https://github.com/Bindkushal/indic-voice.git"

$ollamaExe = $null
$ollamaCommand = Get-Command ollama -ErrorAction SilentlyContinue
if ($ollamaCommand) {
  $ollamaExe = $ollamaCommand.Source
} else {
  Write-Host "Installing Ollama..." -ForegroundColor Yellow
  winget install --id Ollama.Ollama -e --accept-package-agreements --accept-source-agreements
  $candidate = Join-Path $env:LOCALAPPDATA "Programs\Ollama\ollama.exe"
  if (Test-Path $candidate) { $ollamaExe = $candidate }
}

if ($ollamaExe) {
  & $ollamaExe pull qwen3.5:4b
} else {
  Write-Host "Ollama installed but this PowerShell session cannot see it yet. Reopen PowerShell, then run: ollama pull qwen3.5:4b" -ForegroundColor Yellow
}

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "Installing FFmpeg..." -ForegroundColor Yellow
  winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements
  Write-Host "If ffmpeg is still not found in this window, reopen PowerShell before generation." -ForegroundColor Yellow
} else {
  Write-Host "FFmpeg found." -ForegroundColor Green
}

Write-Host "Setup complete. The first TTS run will download the public IndicVoice model." -ForegroundColor Green
