# RaspberryPi: Vytvářej chytrá zařízení

Tento projekt ukazuje, jak z Raspberry Pi 5 udělat chytré zařízení s měřením, vizualizací dat a bezpečným vzdáleným přístupem přes **Cloudflare Tunnel**.  
Cílem je mít aplikaci, která se sama udržuje, loguje a spouští po restartu díky **systemd uživatelským službám**.

## 📖 Popis projektu
Aplikace běží na Raspberry Pi 5 a skládá se ze tří spustitelných skriptů:
- `./measure/run.sh` – zajišťuje měření a ukládání dat  
- `./web/start.sh` – spouští webový server pro vizualizaci dat  
- `./CloudFlared/run_cloudflared.sh` – spouští Cloudflare Tunnel pro bezpečný vzdálený přístup

Měřicí skript i web (Python skripty) si při prvním spuštění sami vytvoří virtuální prostředí (`venv`) a nainstalují potřebné závislosti.  
Logování výstupů probíhá do adresáře `./log` (s vyjimkou uživatelského):  
- `./log/measure.log` – měření  
- `./log/cf.log` – Cloudflare Tunnel  
- `./log/web.log` – standardní a chybový výstup webu  
- `./web/app.log` – uživatelské logy webové aplikace (zobrazitelné přímo ve webu)

## 🚀 Quickstart
```bash
# spuštění měření
./measure/run.sh

# spuštění webového serveru
./web/start.sh

# kontrola logů
tail -f ./log/<log-name>.log
```

## 🔧 Konfigurace Cloudflare Tunnel (vlastní doména)
Aplikace je zpřístupněna přes Cloudflare Tunnel s vlastní doménou `chaloupek.uk`. Tunel zajišťuje HTTPS přístup, automatické certifikáty a směrování na jednotlivé webové instance běžící na Raspberry Pi.  
Je potřeba mít doménu v Cloudflare (zakoupit nebo převést).

### 1. Přihlášení do Cloudflare
```bash
cloudflared login
```
Po přihlášení se vytvoří soubor s autentifikací `~/.cloudflared/cert.pem`.

### 2. Vytvoření tunelu
```bash
cloudflared tunnel create <tunnel-name>
```
V adresáři `~/.cloudflared/` vznikne JSON soubor s credentials.

### 3. Konfigurační soubor
`~/.cloudflared/config.yml`:
```yaml
tunnel: <tunnel-name>
credentials-file: /home/pi/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: rb5.chaloupek.uk
    service: http://localhost:5000

  - hostname: www.chaloupek.uk
    service: http://localhost:5000

  - service: http_status:404
```

### 4. Nastavení DNS
```bash
cloudflared tunnel route dns <tunnel-name> rb5.chaloupek.uk
```

### 5. Spuštění tunelu
```bash
cloudflared tunnel run <tunnel-name>
```

### 6. HTTPS a bezpečnost
- V Cloudflare dashboardu nastavte **Always Use HTTPS** a minimální verzi **TLS 1.2**  
- Přesměrování `chaloupek.uk` → `www.chaloupek.uk` je řešeno přes Page Rules  
- Certifikáty spravuje automaticky Cloudflare

## 💻 Instalace
1. Naklonujte repozitář:
   ```bash
   git clone https://github.com/JanChaloupek/RaspberryPi_VytvarejChytraZarizeni_2stream.git
   cd RaspberryPi_VytvarejChytraZarizeni_2stream
   ```
2. Ujistěte se, že máte nainstalovaný Python 3.11+ (Raspberry Pi 5 jej podporuje).  
3. Není nutné ručně vytvářet `venv` – oba skripty to provedou samy při prvním spuštění.  

## ⚙️ Konfigurace
- Nastavení aplikace: `config.yaml` (nastavení tunelu)  
- Logy: `./log/<log-name>.log`  

## 🚀 Spuštění
### Ruční spuštění
```bash
./measure/run.sh
./web/start.sh
./CloudFlared/run_cloudflared.sh
```

### Automatické spuštění po startu (systemd uživatelské služby)
#### 1. Povolení uživatelských služeb
```bash
sudo loginctl enable-linger <user-name>
```

#### 2. Service soubory
Adresář: `~/.config/systemd/user`

##### measure.service
```ini
[Unit]
Description=Measure Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/USER/PROJECT/measure
ExecStart=/home/USER/PROJECT/measure/run.sh
Restart=always
StandardOutput=append:/home/USER/PROJECT/log/measure.log
StandardError=append:/home/USER/PROJECT/log/measure.log

[Install]
WantedBy=default.target
```

##### web.service
```ini
[Unit]
Description=Web Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/USER/PROJECT/web
ExecStart=/home/USER/PROJECT/web/start.sh
Restart=always
StandardOutput=append:/home/USER/PROJECT/log/web.log
StandardError=append:/home/USER/PROJECT/log/web.log

[Install]
WantedBy=default.target
```

##### cloudflared.service
```ini
[Unit]
Description=Cloudflare Tunnel Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/USER/PROJECT/CloudFlared
ExecStart=/home/USER/PROJECT/CloudFlared/run_cloudflared.sh
Restart=always
StandardOutput=append:/home/USER/PROJECT/log/cf.log
StandardError=append:/home/USER/PROJECT/log/cf.log

[Install]
WantedBy=default.target
```

#### 3. Aktivace služeb
```bash
systemctl --user daemon-reload
systemctl --user enable measure.service
systemctl --user start measure.service
systemctl --user enable web.service
systemctl --user start web.service
systemctl --user enable cloudflared.service
systemctl --user start cloudflared.service
```

#### 4. Kontrola stavu
```bash
systemctl --user status measure.service
systemctl --user status web.service
systemctl --user status cloudflared.service
```

#### 5. Logy
- `./log/cf.log`  
- `./log/measure.log`  
- `./log/web.log`  
- `./web/app.log` (uživatelské logy webu)

Pro sledování v reálném čase:
```bash
tail -f ./log/<log-name>.log
```
nebo přes journal:
```bash
journalctl --user -u measure.service -f
journalctl --user -u web.service -f
journalctl --user -u cloudflared.service -f
```
nebo přímo ve webové aplikaci (Dashboard → Prohlížeč logů).

## 📂 Závislosti
- Python 3.11+ (instalace probíhá automaticky při prvním spuštění skriptů)  
- Knihovny: instalují se automaticky (`venv + pip install`)  

## 🏗️ Architektura
- **Backend (Python skripty)** – `measure/run.sh` pro měření, `web/start.sh` pro webový server  
- **Konfigurační vrstva** – `config.yaml`  
- **Logování** – `./log/<log-name>.log`  
- **Systemd uživatelské služby** – automatické spuštění po nabootování Raspberry Pi 5  
- **Cloudflare Tunnel (`run_cloudflared.sh`)** – bezpečný HTTPS přístup přes doménu `chaloupek.uk`

## 📎 Další zdroje
- [Cloudflare Tunnel dokumentace](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)  
- [systemd uživatelské služby](https://www.freedesktop.org/software/systemd/man/systemd.service.html)  
- [Plotly.js](https://plotly.com/javascript/)  
