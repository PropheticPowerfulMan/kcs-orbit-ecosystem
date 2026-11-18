"""Add application-local EduSync password recovery without modifying users."""
from alembic import op
from app.models.password_reset import PasswordResetToken
revision = "20261118030000"
down_revision = "20260823030000"
branch_labels = None
depends_on = None
def upgrade():
    PasswordResetToken.__table__.create(bind=op.get_bind(), checkfirst=True)
def downgrade():
    pass
