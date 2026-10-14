#!/usr/bin/env python3
"""Check the deployed edge functions actually work, end to end.

    python3 supabase/verify_functions.py            # delete-account, free
    python3 supabase/verify_functions.py --with-ai  # also ai-expert (spends credit)

Creates a throwaway account, signs in as it, calls the functions with that
account's own token, and deletes it afterwards. Nothing here touches a real
account.

The service-role key is fetched at run time from the Management API with the
access token in supabase/.env, and kept in memory only: it is never written to
disk, because a key on disk is a key in a backup.
"""
import json
import pathlib
import secrets
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent


def read_env() -> dict[str, str]:
    env: dict[str, str] = {}
    for line in (ROOT / "supabase/.env").read_text(encoding="utf-8").splitlines():
        if line.strip() == "" or line.lstrip().startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        env[key.strip()] = value.strip()
    return env


def request(url: str, *, method: str = "GET", headers: dict[str, str],
            body: dict | None = None) -> tuple[int, str]:
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return response.status, response.read().decode()
    except urllib.error.HTTPError as error:
        return error.code, error.read().decode()


def main() -> None:
    env = read_env()
    ref = env["SUPABASE_PROJECT_REF"]
    token = env["SUPABASE_ACCESS_TOKEN"]
    base = f"https://{ref}.supabase.co"
    failures: list[str] = []

    def check(label: str, condition: bool, detail: str = "") -> None:
        print(f"  {'ok  ' if condition else 'FAIL'}  {label}{f'  {detail}' if detail else ''}")
        if not condition:
            failures.append(label)

    status, body = request(
        f"https://api.supabase.com/v1/projects/{ref}/api-keys",
        headers={"Authorization": f"Bearer {token}"},
    )
    if status != 200:
        raise SystemExit(f"could not read the project keys: {status} {body[:200]}")
    keys = {k["name"]: k["api_key"] for k in json.loads(body)}
    anon, service = keys["anon"], keys["service_role"]

    email = f"verify-{secrets.token_hex(4)}@example.invalid"
    password = secrets.token_urlsafe(18)
    admin_headers = {
        "apikey": service,
        "Authorization": f"Bearer {service}",
        "Content-Type": "application/json",
    }

    print(f"\nthrowaway account {email}\n")
    status, body = request(f"{base}/auth/v1/admin/users", method="POST",
                           headers=admin_headers,
                           body={"email": email, "password": password,
                                 "email_confirm": True})
    if status not in (200, 201):
        raise SystemExit(f"could not create the test account: {status} {body[:300]}")
    user_id = json.loads(body)["id"]

    status, body = request(f"{base}/auth/v1/token?grant_type=password", method="POST",
                           headers={"apikey": anon, "Content-Type": "application/json"},
                           body={"email": email, "password": password})
    if status != 200:
        request(f"{base}/auth/v1/admin/users/{user_id}", method="DELETE",
                headers=admin_headers)
        raise SystemExit(f"could not sign in as the test account: {status} {body[:300]}")
    jwt = json.loads(body)["access_token"]
    user_headers = {"apikey": anon, "Authorization": f"Bearer {jwt}",
                    "Content-Type": "application/json"}

    print("ai-expert")
    status, body = request(f"{base}/functions/v1/ai-expert", method="POST",
                           headers={"apikey": anon, "Content-Type": "application/json"},
                           body={"mode": "explain", "gameSlug": "brisca"})
    check("refuses a caller with no session", status == 401, f"{status} {body[:60]}")

    status, body = request(f"{base}/functions/v1/ai-expert", method="POST",
                           headers=user_headers, body={"mode": "nonsense"})
    check("refuses a mode it does not know", status == 400, f"{status} {body[:60]}")

    if "--with-ai" in sys.argv:
        status, body = request(f"{base}/functions/v1/ai-expert", method="POST",
                               headers=user_headers,
                               body={"mode": "explain", "gameSlug": "brisca",
                                     "register": "quick"})
        answered = status == 200 and len(body) > 80
        check("explains a game", answered, f"{status} {body[:160]}")
    else:
        print("  skip  explains a game (spends Anthropic credit; pass --with-ai)")

    print("\ndelete-account")
    status, body = request(f"{base}/functions/v1/delete-account", method="POST",
                           headers={"apikey": anon, "Content-Type": "application/json"})
    check("refuses a caller with no session", status == 401, f"{status} {body[:60]}")

    status, body = request(f"{base}/functions/v1/delete-account", method="POST",
                           headers=user_headers)
    check("deletes the caller's own account", status == 200, f"{status} {body[:80]}")

    status, body = request(f"{base}/auth/v1/admin/users/{user_id}", headers=admin_headers)
    check("the account is really gone", status == 404, f"{status} {body[:80]}")

    status, body = request(f"{base}/rest/v1/profiles?select=id&id=eq.{user_id}",
                           headers={"apikey": service, "Authorization": f"Bearer {service}"})
    check("and so is its profile", body.strip() == "[]", body[:80])

    if failures:
        # only reached when the account survived; otherwise it is already gone
        request(f"{base}/auth/v1/admin/users/{user_id}", method="DELETE",
                headers=admin_headers)

    print("\nall checks passed\n" if not failures else f"\n{len(failures)} failed\n")
    sys.exit(0 if not failures else 1)


if __name__ == "__main__":
    main()
