#!/bin/bash
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


# Spuštění serveru
export FLASK_APP=app.py
export FLASK_ENV=development
flask run

# Čekání na stisk klávesy
read -n 1 -s -r -p "Stiskni libovolnou klávesu pro ukončení..."
echo

# run:
# chmod +x start.sh
# ./start.sh
