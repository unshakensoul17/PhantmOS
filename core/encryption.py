"""
core/encryption.py — PhantmOS v3.0
Symmetric credential encryption for user BYOK keys.
"""
import os
import base64
import hashlib
from cryptography.fernet import Fernet
from core.config import SUPABASE_KEY

# Derive key from SUPABASE_KEY to ensure it's persistent and consistent across deploys
_raw_key = os.getenv("ENCRYPTION_KEY", SUPABASE_KEY)
_hasher = hashlib.sha256(_raw_key.encode()).digest()
_fernet_key = base64.urlsafe_b64encode(_hasher)
_fernet = Fernet(_fernet_key)

def encrypt_key(value: str) -> str:
    """Encrypt a plaintext API key for DB storage."""
    if not value:
        return ""
    return _fernet.encrypt(value.encode()).decode()

def decrypt_key(value: str) -> str:
    """Decrypt an API key from DB storage."""
    if not value:
        return ""
    try:
        return _fernet.decrypt(value.encode()).decode()
    except Exception:
        return ""
