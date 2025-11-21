#!/bin/bash

# Spustí tunel s názvem "rb5"
cloudflared tunnel run rb5

# Spustí quick tunnel na lokální Flask aplikaci běžící na portu 5000
# cloudflared tunnel --url http://localhost:5000

# run:
# chmod +x run_cloudflard.sh
# ./run_cloudflard.sh