"""
logging_config.py
─────────────────
Centralized rotating logging configuration for Ghost Protocol.
"""

from __future__ import annotations

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path(os.getenv("GHOST_LOG_DIR", "logs"))
GENERAL_LOG = LOG_DIR / "ghost_protocol.log"
ERROR_LOG = LOG_DIR / "stealth_exceptions.log"


def setup_logging(level: int = logging.INFO) -> None:
    """Initialize rotating handlers once for the root logger."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    root = logging.getLogger()
    if getattr(root, "_ghost_logging_configured", False):
        return

    root.setLevel(level)
    formatter = logging.Formatter(
        fmt="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )

    general_handler = RotatingFileHandler(
        GENERAL_LOG,
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    general_handler.setLevel(level)
    general_handler.setFormatter(formatter)

    error_handler = RotatingFileHandler(
        ERROR_LOG,
        maxBytes=5 * 1024 * 1024,
        backupCount=3,
        encoding="utf-8",
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(formatter)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(level)
    console_handler.setFormatter(formatter)

    root.addHandler(general_handler)
    root.addHandler(error_handler)
    root.addHandler(console_handler)
    root._ghost_logging_configured = True  # type: ignore[attr-defined]


def get_logger(name: str) -> logging.Logger:
    setup_logging()
    return logging.getLogger(name)
