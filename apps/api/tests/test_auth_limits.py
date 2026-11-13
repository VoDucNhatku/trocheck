"""Login throttling uses both transport IP and verified account identifiers."""
import pytest

from app.core import registration_limit
from app.core.errors import ApiError
from app.core.registration_limit import RegistrationLimit


def test_password_login_locks_username_across_ips_and_expires(api, monkeypatch):
    client = api.client()
    now = [1000.0]
    monkeypatch.setattr(registration_limit, "monotonic", lambda: now[0])
    for number in range(5):
        # Spoofed forwarding headers cannot change the transport peer.
        response = client.post('/api/v1/auth/login', json={"username": "admin", "password": "wrong"},
                               headers={"X-Forwarded-For": f"192.0.2.{number}"})
        assert response.status_code == 401
    response = client.post('/api/v1/auth/login', json={"username": "admin", "password": "test-pass"})
    assert response.status_code == 429 and int(response.headers['Retry-After']) == 300
    now[0] += 301
    assert client.post('/api/v1/auth/login', json={"username": "admin", "password": "test-pass"}).status_code == 200


def test_password_ip_limit_catches_rotating_usernames(api):
    client = api.client()
    for number in range(30):
        assert client.post('/api/v1/auth/login', json={"username": f"absent{number}", "password": "wrong"}).status_code == 401
    assert client.post('/api/v1/auth/login', json={"username": "admin", "password": "test-pass"}).status_code == 429


def test_username_bucket_is_shared_between_transport_peers(api):
    from fastapi.testclient import TestClient
    from app.main import create_app
    app = create_app()
    for number in range(5):
        client = TestClient(app, client=(f"192.0.2.{number}", 50000))
        assert client.post('/api/v1/auth/login', json={"username": "admin", "password": "wrong"}).status_code == 401
    client = TestClient(app, client=("192.0.2.99", 50000))
    assert client.post('/api/v1/auth/login', json={"username": "admin", "password": "test-pass"}).status_code == 429


def test_limiter_bounds_unique_keys_and_recovers(monkeypatch):
    now = [0.0]
    monkeypatch.setattr(registration_limit, "monotonic", lambda: now[0])
    limiter = RegistrationLimit()
    for number in range(10000):
        limiter.check(str(number), 5, 300)
    with pytest.raises(ApiError) as error:
        limiter.check("overflow", 5, 300)
    assert error.value.status == 429
    now[0] = 301.0
    limiter.check("overflow", 5, 300)
    assert len(limiter._attempts) == 1
