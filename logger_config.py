# logger_config.py
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
):
    """
    Konfiguruje a vrací logger. Volání je idempotentní (nepřidává duplicitní handlery).
    - logger_name: pokud None, konfiguruje root logger
    - log_file: cesta k souboru; pokud None použije DEFAULT_LOG_FILE
    - level: logging level
    - max_bytes, backup_count: parametry RotatingFileHandler
    - console: přidat StreamHandler (True/False)
    - fmt: formát log řádku
    """
    if log_file is None:
        log_file = DEFAULT_LOG_FILE

    target = logging.getLogger(logger_name) if logger_name else logging.getLogger()
    target.setLevel(level)

    formatter = logging.Formatter(fmt)

    # Přidej file handler jen pokud už neexistuje handler pro daný soubor
    existing_filepaths = {
        getattr(h, "baseFilename", None)
        for h in target.handlers
        if isinstance(h, RotatingFileHandler)
    }
    if log_file not in existing_filepaths:
        try:
            fh = RotatingFileHandler(log_file, maxBytes=max_bytes, backupCount=backup_count)
            fh.setLevel(level)
            fh.setFormatter(formatter)
            target.addHandler(fh)
        except Exception:
            # Pokud nelze vytvořit file handler (práva, cesta), ignoruj a pokračuj; console handler může pomoci při ladění.
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
