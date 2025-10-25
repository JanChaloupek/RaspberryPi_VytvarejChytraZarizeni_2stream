# Prihlaseni uctu cloudflare
cloudflared login
# Otevře prohlížeč, kde autorizuješ přístup ke svému účtu

# Vytvoreni tunelu s nazvem rb5
cloudflared tunnel create rb5
# Vytvoří tunel a uloží credentials soubor do ~/.cloudflared/

# Zkopirovani pripraveneho konfiguračního souboru config.yml
cp ./config.yml ~/.cloudflared/config.yml
# Ujisti se, že v config.yml je správné tunnel: jméno (rb5) 
# a správná cesta k credentials-file: (např. ~/.cloudflared/<tunel-id>.json)

# Prirazeni domeny k tunelu
cloudflared tunnel route dns rb5 rb5.chaloupek.uk
# Vytvoří CNAME záznam v DNS, který směřuje na tunel

# Spusteni tunelu
cloudflared tunnel run rb5
# Tunel je aktivní a přesměrovává provoz na službu definovanou v config.yml

sudo cloudflared service install
# Nainstaluje cloudflared jako službu, která se spustí při startu systému