from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

_fernet = Fernet(settings.model_registry_encryption_key.encode())


def encrypt_api_key(plaintext: str) -> str:
    return _fernet.encrypt(plaintext.encode()).decode()


def decrypt_api_key(ciphertext: str) -> str:
    try:
        return _fernet.decrypt(ciphertext.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Stored API key cannot be decrypted — MODEL_REGISTRY_ENCRYPTION_KEY may have changed") from exc
