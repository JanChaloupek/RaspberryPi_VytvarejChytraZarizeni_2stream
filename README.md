# RaspberryPi: Vytvářej chytrá zařízení

Tento projekt ukazuje, jak z Raspberry Pi 5 udělat chytré zařízení s měřením, vizualizací dat a bezpečným vzdáleným přístupem přes Cloudflare Tunnel.  
Cílem je mít aplikaci, která se sama udržuje, loguje a spouští po restartu díky systemd uživatelským službám.

## 📖 Popis projektu
Aplikace běží na Raspberry Pi 5 a skládá se ze tří spustitelných skriptů:
- `./measure/run.sh` – zajišťuje měření a ukládání dat  
- `./web/start.sh` – spouští webový server pro vizualizaci dat  
- `./CloudFlared/run_cloudflared.sh` – spouští Cloudflare Tunnel pro bezpečný vzdálený přístup

Každý skript si při prvním spuštění sám vytvoří virtuální prostředí (`venv`) a nainstaluje potřebné závislosti.  
Logování probíhá do souboru `./log/app.log`.  

## 🚀 Quickstart
```bash
# spuštění měření
./measure/run.sh

# spuštění webového serveru
./web/start.sh

# kontrola logů
tail -f ./log/app.log
```

## 🔧 Konfigurace Cloudflare tunelu (vlastní doména)
Aplikace je zpřístupněna přes Cloudflare Tunnel s vlastní doménou chaloupek.uk. Tunel zajišťuje HTTPS přístup, automatické certifikáty a směrování na jednotlivé webové instance běžící na Raspberry Pi.
Je potřebné v cloudflare zakoupit vlastní doménu (nebo nějakou svou doménu přenést do clouflare).

### 1. Přihlášení do Cloudflare
Na Raspberry Pi se přihlaste ke svému účtu Cloudflare:
```bash
cloudflared login
```
Po přihlášení se vytvoří soubor s autentifikací ~/.cloudflared/cert.pem.

### 2. Vytvoření tunelu
```bash
cloudflared tunnel create rb5
```
V adresáři ~/.cloudflared/ vznikne JSON soubor s credentials.

### 3. Konfigurační soubor
Vytvořte soubor ~/.cloudflared/config.yml s následujícím obsahem:
```yaml
tunnel: rb5
credentials-file: /home/pi/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: rb5.chaloupek.uk
    service: http://localhost:5000

  - hostname: www.chaloupek.uk
    service: http://localhost:5000

  - service: http_status:404
```
### 4. Nastavení DNS
Propojte tunel s DNS záznamy:
```bash
cloudflared tunnel route dns rb5 rb5.chaloupek.uk
```
### 5. Spuštění tunelu
Tunel spustíte příkazem:
```bash
cloudflared tunnel run rb5
```
### 6. HTTPS a bezpečnost
V Cloudflare dashboardu nastavte **Always Use HTTPS** na minimální verzi **TLS 1.2**.

Přesměrování **chaloupek.uk** → **www.chaloupek.uk** je řešeno přes Page Rules.

Certifikáty jsou spravovány automaticky Cloudflare.

## 💻 Instalace
1. Naklonujte repozitář:
   ```bash
   git clone https://github.com/uzivatel/projekt.git
   cd projekt
   ```
2. Ujistěte se, že máte nainstalovaný Python 3.11+ (Raspberry Pi 5 jej podporuje).  
3. Není nutné ručně vytvářet venv – oba skripty to provedou samy při prvním spuštění.  

## ⚙️ Konfigurace
Nastavení aplikace se provádí v souboru config.yaml (např. časová zóna, databázové připojení).  
Logy se ukládají do ./log/app.log.  

## 🚀 Spuštění
### Ruční spuštění:
```bash
./measure/run.sh
./web/start.sh
./CloudFlared/run_cloudflared.sh
```
### Automatické spuštění po startu (uživatelské systemd služby)
Aby se skripty spustily automaticky po nabootování Raspberry Pi, je potřeba nastavit uživatelské služby (systemd --user).

#### 1. Povolení uživatelských služeb
```bash
sudo loginctl enable-linger pi
```
Tím zajistíš, že služby poběží i po rebootu, i když se uživatel pi nepřihlásí.

#### 2. Vytvoření service souborů
Vytvoř adresář:

```bash
mkdir -p ~/.config/systemd/user
```

~/.config/systemd/user/measure.service
```ini
[Unit]
Description=Measure Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pi/projekt/measure
ExecStart=/home/pi/projekt/measure/run.sh
Restart=always
StandardOutput=append:/home/pi/projekt/log/app.log
StandardError=append:/home/pi/projekt/log/app.log

[Install]
WantedBy=default.target
```

~/.config/systemd/user/web.service
```ini
[Unit]
Description=Web Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pi/projekt/web
ExecStart=/home/pi/projekt/web/start.sh
Restart=always
StandardOutput=append:/home/pi/projekt/log/app.log
StandardError=append:/home/pi/projekt/log/app.log

[Install]
WantedBy=default.target
```

~/.config/systemd/user/cloudflared.service
```ini
[Unit]
Description=Cloudflare Tunnel Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/pi/projekt/CloudFlared
ExecStart=/home/pi/projekt/CloudFlared/run_cloudflared.sh
Restart=always
StandardOutput=append:/home/pi/projekt/log/app.log
StandardError=append:/home/pi/projekt/log/app.log

[Install]
WantedBy=default.target
```

#### 3. Aktivace služeb
```bash
systemctl --user daemon-reload
systemctl --user enable measure.service
systemctl --user enable web.service
systemctl --user start measure.service
systemctl --user start web.service
systemctl --user enable cloudflared.service
systemctl --user start cloudflared.service
```

#### 4. Kontrola stavu
```bash
systemctl --user status measure.service
systemctl --user status web.service
```

#### 5. Logy
- Skripty `measure` a `web` zapisují do:
```
./log/app.log
```

- Cloudflare Tunnel (`cloudflared.service`) standardně loguje do systemd journalu:
```bash
journalctl --user -u cloudflared.service -f
```

Pro sledování v reálném čase:
```bash
tail -f ./log/app.log
```
nebo přes journal:
```bash
journalctl --user -u measure.service -f
journalctl --user -u web.service -f
```
nebo přes ve webové aplikaci po přihlášení účtem s právy správce
```
Dashbord -> Prohlížeč logů 
```

## 📂 Závislosti
Python: 3.11+ (instalace probíhá automaticky při prvním spuštění skriptů)  
Knihovny: instalují se automaticky (venv + pip install)  

## 🏗️ Architektura
- **Backend (Python skripty)** – `measure/run.sh` pro měření, `web/start.sh` pro webový server  
- **Konfigurační vrstva** – soubor `config.yaml`  
- **Logování** – `./log/app.log`  
- **Systemd uživatelské služby** – zajišťují automatické spuštění po nabootování Raspberry Pi 5  
- **Cloudflare Tunnel (run_cloudflared.sh)** – zajišťuje bezpečný HTTPS přístup přes vlastní doménu `chaloupek.uk`

## 📎 Další zdroje
- [Cloudflare Tunnel dokumentace](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [systemd uživatelské služby](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [Plotly.js](https://plotly.com/javascript/)
