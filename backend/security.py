import bcrypt


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def verify_password(password: str, stored_password: str) -> bool:
    if not stored_password:
        return False
    if stored_password.startswith("$2a$") or stored_password.startswith("$2b$") or stored_password.startswith("$2y$"):
        try:
            return bcrypt.checkpw(password.encode("utf-8"), stored_password.encode("utf-8"))
        except (ValueError, TypeError):
            return False
    # Backward compatibility for existing plaintext accounts; successful login
    # should immediately replace this legacy value with a secure hash.
    return password == stored_password
