# Dummy file to prevent import errors after webhook removal

from fastapi import APIRouter

router = APIRouter(prefix="/webhooks", tags=["Webhooks"])