import re

file_path = 'backend/alembic/versions/004_add_dashboard_layout_and_camera_config.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
    import sqlalchemy.exc
    try:
        with op.batch_alter_table('users') as batch_op:
            batch_op.add_column(sa.Column('dashboard_layout', sa.Text(), nullable=True))
    except (sqlalchemy.exc.ProgrammingError, sqlalchemy.exc.OperationalError):
        pass
        
    try:
        with op.batch_alter_table('users') as batch_op:
            batch_op.add_column(sa.Column('camera_config', sa.Text(), nullable=True))
    except (sqlalchemy.exc.ProgrammingError, sqlalchemy.exc.OperationalError):
        pass
"""

content = re.sub(r"    with op.batch_alter_table\('users'\) as batch_op:.*batch_op\.add_column\(sa\.Column\('camera_config', sa\.Text\(\), nullable=True\)\)", replacement.strip(), content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
