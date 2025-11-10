#!/bin/bash
# nastavení title okna
printf '\033]0;%s\007' "web"

echo "=== Spouštím Flask server na Linux/macOS ==="

# Vytvoření virtuálního prostředí, pokud neexistuje
if [ ! -d ".venv" ]; then
    echo "[*] Vytvářím virtuální prostředí .venv..."
    python3 -m venv .venv
fi


# Aktivace virtuálního prostředí
source .venv/bin/activate


# Kontrola Flasku
if ! pip show flask > /dev/null 2>&1; then
    echo "[*] Flask není nainstalovaný. Instaluji..."
    pip install flask
fi

echo "Spouštím webovou aplikaci"
python3 app.py

# Čekání na stisk klávesy
read -n 1 -s -r -p "Stiskni libovolnou klávesu pro ukončení..."
echo

# run:
# chmod +x start.sh
# ./start.sh
