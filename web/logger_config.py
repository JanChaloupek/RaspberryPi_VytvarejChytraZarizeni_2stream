# logger_config.py
"""
Logger configuration module
---------------------------

Účel:
- Centralizuje konfiguraci Python loggeru pro aplikaci.
- Poskytuje idempotentní nastavení loggeru (nepřidává duplicitní handlery).
- Umožňuje rotující souborové logování a volitelný konzolový výstup.
- Zajišťuje jednotný formát log řádků napříč aplikací.

Kdy použít:
- Při startu aplikace (např. v main.py) pro nastavení root loggeru.
- V samostatných modulech/knihovnách, pokud potřebují vlastní logger (pojmenovaný).

Klíčové vlastnosti:
- RotatingFileHandler s maxBytes a backupCount pro řízenou velikost logů.
- StreamHandler volitelně pro psaní do konzole.
- Bezpečné opakované volání bez duplicit (idempotence).
- Graceful handling: při nemožnosti vytvoření file handleru běží dál s konzolí.

Příklad použití:
    from logger_config import configure_logging
    import logging

    # Root logger na startu aplikace
    logger = configure_logging(level=logging.INFO)
    logger.info("Aplikace startuje")

    # Specifický logger pro modul
    api_logger = configure_logging(
        logger_name="api",
        log_file="./logs/api.log",
        level=logging.DEBUG,
        max_bytes=2_000_000,
        backup_count=10,
        console=True
    )
    api_logger.debug("Inicializace API klienta")
"""

import logging
from logging.handlers import RotatingFileHandler
from typing import Optional

DEFAULT_LOG_FILE = "./app.log"
DEFAULT_MAX_BYTES = 1_000_000
DEFAULT_BACKUP_COUNT = 5
DEFAULT_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"


def configure_logging(
    *,
    logger_name: Optional[str] = None,
    log_file: Optional[str] = None,
    level: int = logging.INFO,
    max_bytes: int = DEFAULT_MAX_BYTES,
    backup_count: int = DEFAULT_BACKUP_COUNT,
    console: bool = True,
    fmt: str = DEFAULT_FORMAT
) -> logging.Logger:
    """
    Konfiguruje a vrací logger. Volání je idempotentní (nepřidává duplicitní handlery).

    Parametry:
    - logger_name: Optional[str]
      Název loggeru. Pokud je None, konfiguruje root logger.
      Doporučení: v modulech používej __name__ pro hierarchické logování.
    - log_file: Optional[str]
      Cesta k log souboru. Pokud je None, použije DEFAULT_LOG_FILE.
      Tip: pro modulární logování použij vlastní sub-logy (např. ./logs/api.log).
    - level: int
      Logging level (např. logging.DEBUG, logging.INFO, ...).
      Nastaví úroveň pro logger i jeho handlery.
    - max_bytes: int
      Max. velikost jednoho log souboru před rotací (RotatingFileHandler.maxBytes).
    - backup_count: int
      Počet rotačních záloh souboru (RotatingFileHandler.backupCount).
    - console: bool
      Přidat konzolový StreamHandler. Pokud už existuje, další se nepřidá.
    - fmt: str
      Formát log řádku. Výchozí je "%(asctime)s [%(levelname)s] %(name)s: %(message)s".

    Návratová hodnota:
    - logging.Logger: Konfigurovaný logger (root nebo pojmenovaný).

    Idempotence a bezpečnost:
    - RotatingFileHandler přidá pouze, pokud pro daný soubor ještě neexistuje.
    - StreamHandler přidá pouze, pokud žádný konzolový handler není.
    - Pokud nelze vytvořit file handler (např. kvůli právům nebo neexistující cestě),
      výjimka se nezvedá a konfigurace pokračuje (konzolové logování zůstává).
    """
    if log_file is None:
        log_file = DEFAULT_LOG_FILE

    # Získání cílového loggeru: root nebo pojmenovaný
    target = logging.getLogger(logger_name) if logger_name else logging.getLogger()
    target.setLevel(level)

    formatter = logging.Formatter(fmt)

    # Přidej file handler jen pokud ještě neexistuje handler pro daný soubor
    existing_filepaths = {
        getattr(h, "baseFilename", None)
        for h in target.handlers
        if isinstance(h, RotatingFileHandler)
    }
    if log_file not in existing_filepaths:
        try:
            fh = RotatingFileHandler(
                log_file,
                maxBytes=max_bytes,
                backupCount=backup_count
            )
            fh.setLevel(level)
            fh.setFormatter(formatter)
            target.addHandler(fh)
        except Exception:
            # Pokud nelze vytvořit file handler (práva, cesta),
            # ignoruj a pokračuj; console handler může pomoci při ladění.
            pass

    # Přidej console handler pokud žádný neexistuje a console=True
    if console:
        has_console = any(isinstance(h, logging.StreamHandler) for h in target.handlers)
        if not has_console:
            ch = logging.StreamHandler()
            ch.setLevel(level)
            ch.setFormatter(formatter)
            target.addHandler(ch)

    return target
