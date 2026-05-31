import os

# Analiz edilmesine gerek olmayan büyük klasörler ve kilit dosyaları
EXCLUDE_DIRS = {'node_modules', '.git', '.next', 'dist', 'build', '.vercel'}
EXCLUDE_FILES = {'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', '.DS_Store'}
VALID_EXTENSIONS = {'.js', '.jsx', '.ts', '.tsx', '.css', '.html', '.json'}

output_filename = "tum_proje_kodlari.txt"

with open(output_filename, "w", encoding="utf-8") as outfile:
    for root, dirs, files in os.walk("."):
        # Dışlanacak klasörleri atla
        dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
        
        for file in files:
            if file in EXCLUDE_FILES:
                continue
            
            ext = os.path.splitext(file)[1]
            if ext in VALID_EXTENSIONS:
                file_path = os.path.join(root, file)
                outfile.write(f"\n\n{'='*60}\n")
                outfile.write(f"DOSYA YOLU: {file_path}\n")
                outfile.write(f"{'='*60}\n\n")
                try:
                    with open(file_path, "r", encoding="utf-8") as infile:
                        outfile.write(infile.read())
                except Exception as e:
                    outfile.write(f"[Dosya okunamadi: {e}]\n")

print(f"Başarılı! Tüm kodlar '{output_filename}' dosyasında birleştirildi.")