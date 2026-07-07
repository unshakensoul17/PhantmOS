"""
core/logger.py — PhantmOS v2.0
Centralised structured logger. All modules get a named child logger
from get_logger() instead of using bare print() statements.
"""
import logging
import sys
from typing import Optional


def get_logger(name: str, level: Optional[int] = None) -> logging.Logger:
    """
    Return a named logger with a consistent format.
    Call once per module:  logger = get_logger(__name__)
    """
    logger = logging.getLogger(name)

    # Avoid adding duplicate handlers if called multiple times
    if logger.handlers:
        return logger

    effective_level = level if level is not None else logging.INFO
    logger.setLevel(effective_level)

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(effective_level)

    formatter = logging.Formatter(
        fmt="[%(asctime)s] [%(levelname)s] [%(name)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    handler.setFormatter(formatter)
    logger.addHandler(handler)

    # Prevent log messages from propagating to the root logger
    logger.propagate = False

    return logger


# ── module-level root logger for quick one-liners ──────────────────────────
_root = get_logger("phantmos")


def info(msg: str) -> None:
    _root.info(msg)


def warning(msg: str) -> None:
    _root.warning(msg)


def error(msg: str) -> None:
    _root.error(msg)


def debug(msg: str) -> None:
    _root.debug(msg)
