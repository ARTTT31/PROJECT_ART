"""The email-based password reset is deliberately gone.

Recovery now goes through an admin (``PUT /api/v1/users/{id}`` with a ``password``)
because this deployment does not deliver the mail a self-service link needs.
These tests keep the old routes from quietly reappearing without that delivery
story.
"""

from app.services import email_service


async def test_forgot_password_route_is_gone(client):
    r = await client.post(
        "/api/v1/auth/forgot-password", json={"email": "someone@example.com"}
    )

    assert r.status_code in (404, 405), r.text


async def test_reset_password_route_is_gone(client):
    r = await client.post(
        "/api/v1/auth/reset-password",
        json={"token": "x" * 32, "new_password": "BrandNewPass1"},
    )

    assert r.status_code in (404, 405), r.text


def test_the_reset_email_template_is_gone():
    assert not hasattr(email_service, "password_reset_email")
