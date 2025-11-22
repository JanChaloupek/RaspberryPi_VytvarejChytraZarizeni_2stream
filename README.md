# RaspberryPi: Vytvářej chytrá zařízení

Tento projekt ukazuje, jak z Raspberry Pi 5 udělat chytré zařízení s měřením, vizualizací dat a bezpečným vzdáleným přístupem přes Cloudflare Tunnel.  
Cílem je mít aplikaci, která se sama udržuje, loguje a spouští po restartu díky systemd uživatelským službám.

## 📖 Popis projektu
Aplikace běží na Raspberry Pi 5 a skládá se ze tří spustitelných skriptů:
- `./measure/run.sh` – zajišťuje měření a ukládání dat  
- `./web/start.sh` – spouští webový server pro vizualizaci dat  
- `./CloudFlared/run_cloudflared.sh` – spouští Cloudflare Tunnel pro bezpečný vzdálený přístup

Měříci skript i web (python scripty) si při prvním spuštění sami vytvoří virtuální prostředí (`venv`) a nainstalují potřebné závislosti.  
Logování výstupů probíhá do adresáře `./log`. Měřící script loguje do souboru measure.log, cloudflared tunel do souboru cf.log. U webu je to složitější. Standartní a chzbový výstup je logován do souboru web.log. Ale běžné logování je přímo v aplikaci do souboru ./web/app.log odkud funguje i zobrazování logů přímo ve webové aplikaci.

## 🚀 Quickstart
```bash
# spuštění měření
./measure/run.sh

# spuštění webového serveru
./web/start.sh

# kontrola logů
tail -f ./log/<log-name>.log
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
cloudflared tunnel create <tunnel-name>
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
cloudflared tunnel route dns <tunnel-name> rb5.chaloupek.uk
```
### 5. Spuštění tunelu
Tunel spustíte příkazem:
```bash
cloudflared tunnel run <tunnel-name>
```
### 6. HTTPS a bezpečnost
V Cloudflare dashboardu nastavte **Always Use HTTPS** na minimální verzi **TLS 1.2**.

Přesměrování **chaloupek.uk** → **www.chaloupek.uk** je řešeno přes Page Rules.

Certifikáty jsou spravovány automaticky Cloudflare.

## 💻 Instalace
1. Naklonujte repozitář:
   ```bash
   git clone https://github.com/JanChaloupek/RaspberryPi_VytvarejChytraZarizeni_2stream.git
   cd RaspberryPi_VytvarejChytraZarizeni_2stream
   ```
2. Ujistěte se, že máte nainstalovaný Python 3.11+ (Raspberry Pi 5 jej podporuje).  
3. Není nutné ručně vytvářet venv – oba skripty to provedou samy při prvním spuštění.  

## ⚙️ Konfigurace
Nastavení aplikace se provádí v souboru config.yaml (např. časová zóna, databázové připojení).  
Logy se ukládají do ./log/<log-name>.log.  

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
sudo loginctl enable-linger <user-name>
```
Tím zajistíš, že služby poběží i po rebootu, i když se uživatel nepřihlásí. V mém prostředí ale je nastaveno automatické přihlášení uživatele až do grafického prostředí (proto toto nastavení nepoužívám).

#### 2. Vytvoření service souborů
Vytvoř adresář:

```bash
mkdir -p ~/.config/systemd/user
```

V tomto adresáři založ níže popsané soubory. V mém prostředí místo <user-name> používám **honza** a místo <projekt-name> používám **RB**.
~/.config/systemd/user/measure.service
```ini
[Unit]
Description=Measure Service
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/<user-name>/<projekt-name>/measure
ExecStart=/home/<user-name>/<projekt-name>/measure/run.sh
Restart=always
StandardOutput=append:/home/<user-name>/<projekt-name>/log/measure.log
StandardError=append:/home/<user-name>/<projekt-name>/log/measure.log

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
WorkingDirectory=/home/<user-name>/<projekt-name>/web
ExecStart=/home/<user-name>/<projekt-name>/web/start.sh
Restart=always
StandardOutput=append:/home/<user-name>/<projekt-name>/log/web.log
StandardError=append:/home/<user-name>/<projekt-name>/log/web.log

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
WorkingDirectory=/home/<user-name>/<projekt-name>/CloudFlared
ExecStart=/home/<user-name>/<projekt-name>/CloudFlared/run_cloudflared.sh
Restart=always
StandardOutput=append:/home/<user-name>/<projekt-name>/log/cf.log
StandardError=append:/home/<user-name>/<projekt-name>/log/cf.log

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
- Skripty zapisují logy do:
```
./log/cf.log
./log/measure.log
./log/web.log
```
Web ještě své uživatelské logy (zobrazované ve webové aplikaci) ukládají do ./web/app.log.

Pro sledování v reálném čase:
```bash
tail -f ./log/<log-name>.log
```
nebo přes journal:
```bash
journalctl --user -u measure.service -f
journalctl --user -u web.service -f
journalctl --user -u cloadflared.service -f
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
- **Logování** – `./log/<log-name>.log`  
- **Systemd uživatelské služby** – zajišťují automatické spuštění po nabootování Raspberry Pi 5  
- **Cloudflare Tunnel (run_cloudflared.sh)** – zajišťuje bezpečný HTTPS přístup přes vlastní doménu `chaloupek.uk`

## 📎 Další zdroje
- [Cloudflare Tunnel dokumentace](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)
- [systemd uživatelské služby](https://www.freedesktop.org/software/systemd/man/systemd.service.html)
- [Plotly.js](https://plotly.com/javascript/)
