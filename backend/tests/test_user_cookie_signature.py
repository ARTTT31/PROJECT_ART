"""The readable ``user`` cookie is signed, not merely encoded.

Encoding alone meant a tampered cookie was accepted by any reader: the browser
could rewrite it and the backend had no way to tell its own value from a forged
one. These tests pin the HMAC contract, including the deliberate refusal of
unsigned legacy values (accepting them would let anyone strip the signature).
"""

from urllib.parse import quote

from app.core.utils import decode_user_cookie, encode_user_cookie, user_cookie_payload

PAYLOAD = {"id": 7, "email": "user@example.com", "name": "สมชาย", "role": "admin"}


class TestSignedUserCookie:
    def test_round_trips(self):
        assert decode_user_cookie(encode_user_cookie(PAYLOAD)) == PAYLOAD

    def test_payload_is_percent_encoded_before_the_signature(self):
        encoded = encode_user_cookie(PAYLOAD)

        body, separator, signature = encoded.rpartition(".")
        assert separator == "."
        assert len(signature) == 64
        assert all(c in "0123456789abcdef" for c in signature)
        # Commas and Thai text must never reach the cookie raw.
        assert "," not in body
        assert body.isascii()

    def test_tampering_with_the_payload_is_rejected(self):
        encoded = encode_user_cookie(PAYLOAD)
        body, _, signature = encoded.rpartition(".")
        forged = f"{body.replace('%22', '%22%20')}.{signature}"

        assert decode_user_cookie(forged) is None

    def test_an_unsigned_value_is_rejected(self):
        unsigned = quote('{"id": 1, "role": "admin"}', safe="")
        assert decode_user_cookie(unsigned) is None

    def test_a_dot_inside_the_payload_does_not_confuse_the_parser(self):
        with_dot = {"id": 2, "email": "first.last@example.com", "name": "A.B", "role": "user"}
        assert decode_user_cookie(encode_user_cookie(with_dot)) == with_dot

    def test_garbage_reads_as_none(self):
        assert decode_user_cookie("") is None
        assert decode_user_cookie("not-json") is None
        assert decode_user_cookie(".") is None
        assert decode_user_cookie("abc.def") is None

    def test_payload_keeps_only_the_display_fields(self):
        assert user_cookie_payload({**PAYLOAD, "avatar": "data:..."}) == PAYLOAD
