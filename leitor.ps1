# Garante que o PowerShell entenda e processe o script com a codificação correta.
# Lembre-se de salvar este arquivo .ps1 como "UTF-8 with BOM".

$scriptRoot = $PSScriptRoot
$srcPath = Join-Path -Path $scriptRoot -ChildPath "src"
$reportPath = Join-Path -Path $scriptRoot -ChildPath "relatorio_codigo_completo.txt"

# Define os tipos de arquivo a serem incluídos no relatório.
$fileTypes = @("*.jsx", "*.js", "*.css")

# Cria o cabeçalho do relatório.
$header = @"
Data de Geração: $(Get-Date)
Este arquivo contém uma cópia completa de todo o código-fonte
da pasta /src do projeto.
----------------------------------------------------------------------

"@
# Usa -Encoding UTF8 para garantir que os acentos sejam salvos corretamente.
Set-Content -Path $reportPath -Value $header -Encoding UTF8

# Tenta encontrar os arquivos na pasta de origem.
try {
    $files = Get-ChildItem -Path $srcPath -Recurse -Include $fileTypes -ErrorAction Stop
    if ($null -eq $files) {
        throw "Nenhum arquivo com as extensões especificadas foi encontrado em '$srcPath'."
    }
}
catch {
    # Mensagem de erro com acentuação.
    Write-Host "ERRO: A pasta 'src' não foi encontrada, está vazia ou não contém os tipos de arquivo especificados." -ForegroundColor Red
    Read-Host "Pressione Enter para sair"
    exit
}

# Itera sobre cada arquivo encontrado e adiciona seu conteúdo ao relatório.
foreach ($file in $files) {
    # Corrige o caminho relativo para garantir que comece após a pasta do script.
    $relativePath = $file.FullName.Substring($scriptRoot.Length).TrimStart('\/')
    
    $fileSeparator = @"

######################################################################
# ARQUIVO: $($relativePath)
######################################################################

"@
    
    # Adiciona o separador ao relatório.
    Add-Content -Path $reportPath -Value $fileSeparator -Encoding UTF8
    
    # Lê o conteúdo bruto do arquivo e o adiciona ao relatório.
    $fileContent = Get-Content -Path $file.FullName -Raw
    Add-Content -Path $reportPath -Value $fileContent -Encoding UTF8
}

# Cria o rodapé do relatório.
$footer = @"

----------------------------------------------------------------------
                      FIM DO RELATÓRIO DE CÓDIGO
----------------------------------------------------------------------
"@
# Adiciona o rodapé ao relatório.
Add-Content -Path $reportPath -Value $footer -Encoding UTF8


# Mensagens de sucesso com acentuação.
Write-Host "Dossiê de código gerado com sucesso!" -ForegroundColor Green
Write-Host "Local do arquivo: $reportPath"