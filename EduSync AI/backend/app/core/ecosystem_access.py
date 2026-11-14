import hashlib,json,time,threading,unicodedata
from urllib.request import Request,urlopen
from urllib.parse import urlencode
from fastapi import HTTPException
from app.core.config import settings
_lock=threading.Lock()
_snapshot=set()
_expires=0.0
def ensure_ecosystem_access(identifiers):
    global _snapshot,_expires
    config=(settings.kcs_orbit_api_url,settings.kcs_orbit_api_key,settings.kcs_orbit_organization_id)
    if not any(config):
        return
    if not all(config):
        raise HTTPException(status_code=503,detail='Institutional access verification is not configured.')
    with _lock:
        if time.monotonic()>=_expires:
            try:
                url=config[0].rstrip('/')+'/api/integration/read/account-access/snapshot?'+urlencode({'organizationId':config[2]})
                request=Request(url,headers={'x-api-key':config[1],'x-app-slug':'EDUSYNCAI'})
                with urlopen(request,timeout=4) as response:
                    body=json.load(response)
                hashes=body.get('blockedHashes')
                if not isinstance(hashes,list) or any(not isinstance(v,str) or len(v)!=64 or any(c not in '0123456789abcdef' for c in v) for v in hashes):
                    raise ValueError('Invalid access registry response')
                _snapshot=set(hashes)
                _expires=time.monotonic()+5
            except Exception as error:
                raise HTTPException(status_code=503,detail='Institutional verification is temporarily unavailable. Your data is retained.') from error
        denied=any(hashlib.sha256(unicodedata.normalize('NFKC',str(v)).strip().lower().encode()).hexdigest() in _snapshot for v in identifiers if v)
    if denied:
        raise HTTPException(status_code=403,detail='This account was blocked by Super Administration. / Ce compte a été bloqué par la Superadministration.')
