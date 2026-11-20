"""
Unit tests for core.encryption (Fernet symmetric credential vault).
"""

from core.encryption import decrypt_key, encrypt_key


def test_encryption_roundtrip():
    original_secret = "gsk_prod_apiKey_998877665544332211"
    encrypted = encrypt_key(original_secret)
    assert encrypted != original_secret
    assert isinstance(encrypted, str)

    decrypted = decrypt_key(encrypted)
    assert decrypted == original_secret


def test_encryption_empty_and_none():
    assert encrypt_key("") == ""
    assert decrypt_key("") == ""


def test_decryption_invalid_ciphertext():
    assert decrypt_key("invalid-ciphertext-string") == ""
