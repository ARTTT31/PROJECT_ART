from logging.config import fileConfig
from sqlalchemy import engine_from_config, make_url
from sqlalchemy import pool
from sqlalchemy.exc import OperationalError
from alembic import context
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from app.core.config import settings

try:
    from app.core.database import build_sync_connect_args, to_sync_database_url
except RuntimeError as exc:
    # Importing app.core.database builds the async engine at module load time,
    # which enforces the same TLS policy; print the operator-facing reason
    # without a Python traceback in the deploy log.
    print(str(exc), file=sys.stderr)
    sys.exit(1)

from app.models.base import Base
from app.models import ai_usage, audit_log, session, user, user_camera, weather_cache  # Import all models

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set sqlalchemy.url from settings.
#
# ``set_main_option`` hands the value to configparser, which treats ``%`` as an
# interpolation marker: a percent-encoded password (``Nantanat%40Art31`` for
# ``Nantanat@Art31``) aborted every deploy with "invalid interpolation syntax ...
# at position 59". Doubling the sign is configparser's escape; the online path
# below overwrites the option through a plain dict, where no escaping is needed.
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("%", "%%"))

# add your model's MetaData object here for 'autogenerate' support
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def _explain_connection_failure(url: str, exc: Exception) -> str:
    """Turn a driver connection error into one operator-facing paragraph.

    ``preDeployCommand: alembic upgrade head`` runs on every Render deploy, so a
    dead database used to greet the operator with sixty lines of SQLAlchemy
    internals and no statement of what to change. The host is printed because a
    recreated managed service comes back under a new hostname, and the common
    causes are named explicitly so nobody debugs the Python stack instead.
    """
    try:
        parsed = make_url(url)
        host = parsed.host or "<none>"
        database = parsed.database or "<none>"
    except Exception:  # pragma: no cover - unparsable URL is itself the problem
        host = database = "<unparsable DATABASE_URL>"

    detail = (str(exc).strip().splitlines() or [""])[0]
    lowered = str(exc).lower()
    lines = [
        "",
        "=" * 72,
        "alembic upgrade head could not connect to the database.",
        f"  host     : {host}",
        f"  database : {database}",
    ]
    if (
        "translate host name" in lowered
        or "name or service not known" in lowered
        or "nodename nor servname" in lowered
        or "temporary failure in name resolution" in lowered
    ):
        lines += [
            "  cause    : DNS lookup failed - that hostname does not exist.",
            "  fix      : the managed database was deleted or renamed. Restore or",
            "             create it, then set DATABASE_URL (and SSL_CA_CERT_PATH",
            "             when the provider uses its own CA) to the new values in",
            "             the Render dashboard and redeploy. A stale hostname is",
            "             an environment fix, not a code fix.",
        ]
    elif "password authentication failed" in lowered or "invalidpassword" in lowered:
        lines += [
            "  cause    : the server rejected the credentials.",
            "  fix      : copy the connection URI again from the provider console",
            "             (use the pooled URI when going through a pooler) and",
            "             update DATABASE_URL in the Render dashboard.",
        ]
    elif "timed out" in lowered or "timeout" in lowered:
        lines += [
            "  cause    : the TCP/TLS handshake timed out.",
            "  fix      : check the port, the provider's allowed IPs/firewall and",
            "             that DATABASE_URL points at the primary (not a pooler)",
            "             endpoint, then redeploy.",
        ]
    elif "certificate" in lowered or "ssl" in lowered:
        lines += [
            "  cause    : TLS setup or certificate verification failed.",
            "  fix      : download the provider CA onto the host, point",
            "             SSL_CA_CERT_PATH at that file, and keep sslmode=require",
            "             out of DATABASE_URL (the engine adds TLS itself).",
        ]
    else:
        lines.append(f"  driver   : {detail}")
    lines += ["=" * 72, ""]
    return "\n".join(lines)


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    # Convert async driver string to sync for Alembic
    sync_url = to_sync_database_url(settings.DATABASE_URL)

    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = sync_url

    try:
        connect_args = build_sync_connect_args(sync_url)
    except RuntimeError as exc:
        # The TLS policy is a deliberate refusal, not a driver failure: print the
        # operator-facing reason without a Python traceback in the deploy log.
        print(str(exc), file=sys.stderr)
        sys.exit(1)

    connectable = engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    try:
        with connectable.connect() as connection:
            context.configure(
                connection=connection,
                target_metadata=target_metadata,
                render_as_batch=True,
            )

            with context.begin_transaction():
                context.run_migrations()
    except OperationalError as exc:
        # Still a failed deploy - just with a cause and a fix instead of a stack.
        print(_explain_connection_failure(sync_url, exc), file=sys.stderr)
        sys.exit(1)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
