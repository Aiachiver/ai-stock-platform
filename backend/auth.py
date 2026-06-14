from jose import jwt
from datetime import datetime, timedelta

SECRET = "mysecretkey"

def create_token(username):

    payload = {

        "sub": username,

        "exp": datetime.utcnow() + timedelta(hours=5)

    }

    token = jwt.encode(
        payload,
        SECRET,
        algorithm="HS256"
    )

    return token