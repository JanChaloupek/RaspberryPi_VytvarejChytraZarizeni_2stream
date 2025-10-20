#!/bin/bash

# Cesta k virtuálnímu prostředí
VENV_DIR=".venv"
MAIN_SCRIPT="main.py"
REQUIREMENTS="requirements.txt"

# Vytvoření virtuálního prostředí, pokud neexistuje
if [ ! -d "$VENV_DIR" ]; then
    echo "Virtuální prostředí nenalezeno. Vytvářím..."
    python3 -m venv "$VENV_DIR"
    echo "Virtuální prostředí vytvořeno."

    # Aktivace prostředí pro instalaci balíčků
    source "$VENV_DIR/bin/activate"

    # Instalace závislostí
    if [ -f "$REQUIREMENTS" ]; then
        echo "Instaluji balíčky z $REQUIREMENTS..."
        pip install --upgrade pip
        pip install -r "$REQUIREMENTS"
    else
        echo "Soubor $REQUIREMENTS nebyl nalezen. Přeskakuji instalaci balíčků."
    fi
else
    # Aktivace prostředí
    source "$VENV_DIR/bin/activate"
fi

# Spuštění hlavního skriptu
echo "Spouštím $MAIN_SCRIPT..."
python "$MAIN_SCRIPT"
