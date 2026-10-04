$ErrorActionPreference = "Stop"

Write-Host "Booknomics Audio Engine - Windows setup" -ForegroundColor Cyan

if (-not (Get-Command python -ErrorAction SilentlyContinue)) {
  throw "Python 3.11+ is required. Install Python first, then run this script again."
}

python -m pip install --upgrade pip
python -m pip install numpy soundfile torch boto3
python -m pip install "git+https://github.com/Bindkushal/indic-g2p.git"
python -m pip install "git+https://github.com/Bindkushal/indic-voice.git"

if (-not (Get-Command ollama -ErrorAction SilentlyContinue)) {
  Write-Host "Installing Ollama..." -ForegroundColor Yellow
  irm https://ollama.com/install.ps1 | iex
}
ollama pull qwen3.5:4b

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host "FFmpeg is not in PATH." -ForegroundColor Yellow
  Write-Host "Install with: winget install --id Gyan.FFmpeg -e"
} else {
  Write-Host "FFmpeg found." -ForegroundColor Green
}

Write-Host "Setup complete. The first TTS run will download the public IndicVoice model." -ForegroundColor Green
