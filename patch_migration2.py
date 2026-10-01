import re

file_path = 'backend/alembic/versions/20261001_1104_7b325f2deceb_add_accessible_pages.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement = """
    import sqlalchemy.exc
    try:
        with op.batch_alter_table('users', schema=None) as batch_op:
            batch_op.add_column(sa.Column('accessible_pages', sa.Text(), nullable=True))
    except (sqlalchemy.exc.ProgrammingError, sqlalchemy.exc.OperationalError):
        pass
"""

content = re.sub(r"    with op.batch_alter_table\('users', schema=None\) as batch_op:.*batch_op\.add_column\(sa\.Column\('accessible_pages', sa\.Text\(\), nullable=True\)\)", replacement.strip(), content, flags=re.DOTALL)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)
