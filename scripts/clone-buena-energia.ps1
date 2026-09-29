[CmdletBinding(SupportsShouldProcess)]
param(
    [string]$Destination = (Join-Path (Get-Location).Path 'Buena-Energia')
)

$ErrorActionPreference = 'Stop'

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    throw 'Git no está instalado o no está disponible en PATH.'
}

$repositories = @(
    @{
        Name = 'buena-energia-frontend'
        Url = 'https://github.com/leonelalex2014-byte/buena-energia-frontend.git'
    },
    @{
        Name = 'buena-energia-backend'
        Url = 'https://github.com/leonelalex2014-byte/buena-energia-backend.git'
    }
)

$destinationPath = [System.IO.Path]::GetFullPath($Destination)

if (-not (Test-Path -LiteralPath $destinationPath -PathType Container)) {
    if ($PSCmdlet.ShouldProcess($destinationPath, 'Crear carpeta destino')) {
        New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
    }
}

foreach ($repository in $repositories) {
    $repositoryPath = Join-Path $destinationPath $repository.Name

    if (Test-Path -LiteralPath $repositoryPath) {
        if (-not (Test-Path -LiteralPath (Join-Path $repositoryPath '.git'))) {
            throw "La ruta ya existe y no es un repositorio Git: $repositoryPath"
        }

        $originUrl = & git -C $repositoryPath remote get-url origin
        if ($LASTEXITCODE -ne 0 -or $originUrl.TrimEnd('/') -ne $repository.Url.TrimEnd('/')) {
            throw "La carpeta existe, pero origin no coincide con $($repository.Url): $repositoryPath"
        }

        Write-Host "Ya clonado: $repositoryPath"
        continue
    }

    if ($PSCmdlet.ShouldProcess($repositoryPath, "Clonar $($repository.Url)")) {
        & git clone $repository.Url $repositoryPath
        if ($LASTEXITCODE -ne 0) {
            throw "Falló el clon de $($repository.Url)."
        }

        Write-Host "Clonado: $repositoryPath"
    }
}