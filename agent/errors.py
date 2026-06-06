"""Shared agent exceptions."""
from __future__ import annotations


class PlanForbiddenError(RuntimeError):
    """Raised when a Supabase proxy returns HTTP 403 (plan insufficient/expired).

    Carries the server's error code/message so the agent can tell the user what
    happened instead of crashing or looping on a generic error.
    """

    def __init__(
        self,
        message: str = "plano insuficiente ou expirado",
        code: str | None = None,
    ) -> None:
        super().__init__(message)
        self.code = code


class AuthExpiredError(RuntimeError):
    """Raised when the stored refresh_token is invalid/expired.

    Signals the startup flow to run the terminal pairing flow and retry, so the
    user never has to edit .env by hand to recover a dead session.
    """


def plan_forbidden_from_httpx(resp) -> PlanForbiddenError:
    """Build a PlanForbiddenError from an httpx 403 response.

    Proxy body shape: {"error": {"code": ..., "message": ...}}.
    """
    code = None
    msg = "plano insuficiente ou expirado"
    try:
        err = (resp.json() or {}).get("error", {})
        code = err.get("code")
        msg = err.get("message") or msg
    except Exception:
        pass
    return PlanForbiddenError(msg, code=code)
