"""Add system_settings table for company/team branding and global configs

Revision ID: 20261021_system_settings
Revises: 20261020_email_tokens
Create Date: 2026-10-21 11:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from datetime import datetime, timezone


# revision identifiers, used by Alembic.
revision = '20261021_system_settings'
down_revision = '20261020_email_tokens'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    tables = inspector.get_table_names()

    if 'system_settings' not in tables:
        op.create_table(
            'system_settings',
            sa.Column('key', sa.String(length=100), primary_key=True, nullable=False),
            sa.Column('value', sa.Text(), nullable=True),
            sa.Column('description', sa.String(length=255), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        )
        op.create_index('ix_system_settings_key', 'system_settings', ['key'], unique=False)

        # Seed initial default branding
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        system_settings = sa.table(
            'system_settings',
            sa.column('key', sa.String),
            sa.column('value', sa.Text),
            sa.column('description', sa.String),
            sa.column('created_at', sa.DateTime),
            sa.column('updated_at', sa.DateTime),
        )
        op.bulk_insert(
            system_settings,
            [
                {
                    'key': 'company_name',
                    'value': 'ART Workspace',
                    'description': 'ชื่อทีม บริษัท หรือองค์กร',
                    'created_at': now,
                    'updated_at': now,
                },
                {
                    'key': 'company_tagline',
                    'value': 'จัดการวันทำงานของคุณให้ง่ายขึ้น',
                    'description': 'สโลแกนหรือคำโปรยสำหรับทีม',
                    'created_at': now,
                    'updated_at': now,
                },
                {
                    'key': 'brand_logo_url',
                    'value': '',
                    'description': 'URL โลโก้หรือสัญลักษณ์ของแบรนด์ (ว่าง = ใช้โลโก้เริ่มต้น)',
                    'created_at': now,
                    'updated_at': now,
                },
                {
                    'key': 'registration_mode',
                    'value': 'approval',
                    'description': 'โหมดการรับสมัครสมาชิก (closed, approval, open)',
                    'created_at': now,
                    'updated_at': now,
                },
            ],
        )


def downgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'system_settings' in inspector.get_table_names():
        op.drop_index('ix_system_settings_key', table_name='system_settings')
        op.drop_table('system_settings')
