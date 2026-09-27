import pytest
from fastapi import HTTPException


from auth import (
    create_token,
    get_current_user,
    hash_password,
    require_admin,
    require_logistics,
    require_warehouse,
    verify_password,
)


def test_password_hash_verifies_only_the_original_password():
    password_hash = hash_password("correct horse battery staple")

    assert password_hash != "correct horse battery staple"
    assert verify_password("correct horse battery staple", password_hash)
    assert not verify_password("wrong password", password_hash)


def test_token_round_trip_returns_user_claims():
    token = create_token(
        {"user_id": 42, "username": "alex", "role": "Administrator"}
    )

    assert get_current_user(token=token) == {
        "user_id": 42,
        "username": "alex",
        "role": "Administrator",
    }


def test_invalid_token_is_rejected():
    with pytest.raises(HTTPException) as error:
        get_current_user(token="not-a-jwt")

    assert error.value.status_code == 403
    assert error.value.detail == "Invalid or Expired Token"


def test_token_without_user_id_is_rejected():
    token = create_token({"username": "alex", "role": "Administrator"})

    with pytest.raises(HTTPException) as error:
        get_current_user(token=token)

    assert error.value.status_code == 401
    assert error.value.detail == "Invalid Token"


@pytest.mark.parametrize("role", ["Administrator", "Warehouse Staff", "Logistics Staff"])
def test_only_administrators_pass_admin_gate(role):
    user = {"user_id": 1, "role": role}

    if role == "Administrator":
        assert require_admin(current_user=user) is user
    else:
        with pytest.raises(HTTPException) as error:
            require_admin(current_user=user)
        assert error.value.status_code == 403


@pytest.mark.parametrize("role", ["Administrator", "Warehouse Staff"])
def test_admin_and_warehouse_roles_pass_warehouse_gate(role):
    user = {"user_id": 1, "role": role}

    assert require_warehouse(current_user=user) is user


def test_logistics_role_is_denied_warehouse_gate():
    with pytest.raises(HTTPException, match="Warehouse access required"):
        require_warehouse(current_user={"user_id": 1, "role": "Logistics Staff"})


@pytest.mark.parametrize("role", ["Administrator", "Logistics Staff"])
def test_admin_and_logistics_roles_pass_logistics_gate(role):
    user = {"user_id": 1, "role": role}

    assert require_logistics(current_user=user) is user


def test_warehouse_role_is_denied_logistics_gate():
    with pytest.raises(HTTPException, match="Logistics access required"):
        require_logistics(current_user={"user_id": 1, "role": "Warehouse Staff"})