#!/usr/bin/env python3
"""Exact, backed-up five-service Jury lot rollout; production operator invocation only."""
from pathlib import Path
import argparse,base64,datetime,fcntl,hashlib,json,os,re,secrets,shlex,shutil,subprocess,sys,urllib.request
ap=argparse.ArgumentParser();ap.add_argument('--release',required=True);ap.add_argument('--confirmation',required=True);ap.add_argument('--preflight',required=True);a=ap.parse_args()
assert os.geteuid()==0,'Run with the authorized production administrator'
assert re.fullmatch('[0-9a-f]{40}',a.release)and a.confirmation=='DEPLOY_JURY_TARGETED','Explicit exact release confirmation required'
root=Path(__file__).resolve().parents[3];backup=Path(a.preflight).resolve();assert backup.parent==Path('/opt/kcs-orbit/production-backups')and backup.name.startswith('jury-')
assert backup.stat().st_uid==0 and backup.stat().st_mode&0o077==0,'Protected preflight required'
os.umask(0o077);lock=open('/var/lock/kcs-orbit-deploy.lock','a');fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
def run(args,**kw):return subprocess.run(args,check=True,**kw)
def output(args,**kw):return subprocess.check_output(args,**kw)
assert output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()==a.release
assert not output(['git','status','--porcelain','--untracked-files=no'],cwd=root).strip(),'Tracked production source must be clean'
assert json.loads((backup/'full-backup-status.json').read_text())['exitCode']==0,'Existing full pre-deploy backup must pass first'
assert (backup/'compose.rollback.json').exists()and(backup/'domains.before.env').exists()
old=json.loads((backup/'containers.before.json').read_text());previous=json.loads((backup/'compose.before.json').read_text());allowed={'nexus_api','nexus_web','edupay_web','kitchen_web','proxy'};new_name='kcs-orbit-production-jury_web-1';services=['nexus_api','nexus_web','jury_web','edupay_web','kitchen_web']
def inspect(names):return json.loads(output(['docker','inspect',*names]))
for c in inspect(list(old)):
 name=c['Name'].lstrip('/');assert c['Id']==old[name]['id']and c['Image']==old[name]['image'],'Production changed since preflight: '+name
for name in ['nexus-api','nexus-web','jury-web','edupay-web','kitchen-web']:run(['docker','image','inspect','kcs/'+name+':'+a.release],stdout=subprocess.DEVNULL)
env=Path('/etc/kcs-orbit/domains.env');jury=Path('/etc/kcs-orbit/jury.env');backup_env=Path('/etc/kcs-orbit/backup.env');assert env.read_bytes()==(backup/'domains.before.env').read_bytes(),'Production environment changed after preflight';compose=['docker','compose','--env-file',str(env),'-f',str(root/'ops/production/compose.yml')]
def atomic(path,data):
 tmp=path.with_name(path.name+'.jury-release.tmp');tmp.write_bytes(data if isinstance(data,bytes)else data.encode());os.chmod(tmp,0o600);os.replace(tmp,path)
def values(path):
 result={}
 for line in path.read_text().splitlines():
  m=re.match(r'^([A-Z][A-Z0-9_]*)=(.*)$',line)
  if m:
   v=m[2].strip();parts=shlex.split(v);result[m[1]]=parts[0]if len(parts)==1 else v
 return result
def set_keys(path,changes):
 lines=path.read_text().splitlines()if path.exists()else[];out=[];remaining=dict(changes)
 for line in lines:
  key=line.split('=',1)[0]
  if key in changes:out.append(key+'='+changes[key]);remaining.pop(key,None)
  else:out.append(line)
 out.extend(k+'='+v for k,v in remaining.items());atomic(path,'\n'.join(out)+'\n')
def canonical_fingerprints():
 result={}
 for table,key in [('TeacherWorkspace','userId'),('Grade','id')]:
  sql='COPY (SELECT row_to_json(t)::text FROM "'+table+'" t ORDER BY "'+key+'") TO STDOUT'
  data=output(['docker','exec','kcs-orbit-nexus-db','sh','-c','exec psql -X -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"','sh',sql]);result[table]={'rows':len(data.splitlines()),'sha256':hashlib.sha256(data).hexdigest()}
 return result
def preserve_others():
 now=inspect(list(old));bad=[]
 for c in now:
  name=c['Name'].lstrip('/');service=c['Config']['Labels'].get('com.docker.compose.service','')
  if service not in allowed and(c['Id']!=old[name]['id']or c['Image']!=old[name]['image']):bad.append(name)
 assert not bad,'Untargeted production service changed: '+','.join(bad)
 return len(now)-sum(c['Config']['Labels'].get('com.docker.compose.service','')in allowed for c in now)
started=datetime.datetime.now(datetime.timezone.utc).isoformat();before=canonical_fingerprints();(backup/'academic.before.json').write_text(json.dumps(before));changed=False;runtime_started=False
try:
 if jury.exists():
  key=values(jury).get('JURY_DRAFT_MASTER_KEY','');assert len(base64.b64decode(key,validate=True))==32,'Keep and validate the existing wrapping key'
 else:
  key=base64.b64encode(secrets.token_bytes(32)).decode()
 set_keys(jury,{'JURY_ENABLED':'true','JURY_ENVIRONMENT':'production','JURY_PUBLIC_URL':'https://kinshasachristianschool.org/jury/','JURY_NEXUS_URL':'https://kinshasachristianschool.org','JURY_STORAGE_DIR':'/jury-private','JURY_DRAFT_MASTER_KEY':key});shutil.copyfile(jury,backup/'jury.after.env');os.chmod(backup/'jury.after.env',0o600)
 changed=True
 updates={k:a.release for k in ['NEXUS_API_RELEASE','NEXUS_WEB_RELEASE','EDUPAY_WEB_RELEASE','KITCHEN_WEB_RELEASE','JURY_WEB_RELEASE']};updates.update({'JURY_ENABLED':'true','JURY_PUBLIC_URL':'https://kinshasachristianschool.org/jury/'})
 # A Nexus API release must not implicitly change the existing PDF renderer image.
 renderer=inspect(['kcs-orbit-production-nexus_report_renderer-1'])[0]['Config']['Image'];assert renderer.startswith('kcs/nexus-report-renderer:');updates['NEXUS_REPORT_RENDERER_RELEASE']=renderer.rsplit(':',1)[1]
 set_keys(env,updates)
 volume='kcs-orbit-production_jury_private_files';run(['docker','volume','create','--label','com.docker.compose.project=kcs-orbit-production','--label','com.docker.compose.volume=jury_private_files',volume],stdout=subprocess.DEVNULL)
 run(['docker','run','--rm','--network','none','--cap-drop','ALL','--security-opt','no-new-privileges','--label','kcs.scope=jury-production-release','-v',volume+':/files','node:20-alpine','node','-e',"require('node:fs').chmodSync('/files',0o700)"])
 mount=json.loads(output(['docker','volume','inspect',volume]))[0]['Mountpoint'];paths=values(backup_env).get('PERSISTENT_PATHS','').split();assert not any('$'in p or '`'in p for p in paths)
 for path in [mount,str(jury)]:
  if path not in paths:paths.append(path)
 set_keys(backup_env,{'PERSISTENT_PATHS':shlex.quote(' '.join(paths))})
 run(compose+['config','--quiet'])
 planned=json.loads(output(compose+['config','--format','json']));drift=[]
 for name,definition in previous['services'].items():
  if name=='nexus_report_renderer':
   expected=dict(definition);expected['image']=renderer
   if planned['services'].get(name)!=expected:drift.append(name)
  elif name not in allowed and planned['services'].get(name)!=definition:drift.append(name)
 assert not drift,'Untargeted Compose definitions changed: '+','.join(drift)
 # All schema additions must be exactly the two reviewed Jury migrations.
 sql='SELECT migration_name FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name'
 applied=set(output(['docker','exec','kcs-orbit-nexus-db','sh','-c','exec psql -X -At -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "$1"','sh',sql],text=True).splitlines());known={p.name for p in(root/'KCS Nexus/backend/prisma/migrations').iterdir()if p.is_dir()};pending=known-applied
 assert pending<={'20261125083000_add_nexus_jury','20261125130000_add_jury_dashboard_indexes'},'Unexpected pending migrations: '+str(sorted(pending))
 print('TARGETS=nexus_api,nexus_web,jury_web,edupay_web,kitchen_web,proxy',flush=True);print('PENDING_JURY_MIGRATIONS='+str(len(pending)),flush=True)
 run(compose+['run','--rm','--no-deps','--entrypoint','node','nexus_api','node_modules/prisma/build/index.js','migrate','deploy'])
 runtime_started=True
 run(compose+['up','-d','--no-build','--no-deps','--wait','--wait-timeout','300',*services])
 # Force only the changed proxy binding: Git replaces the host configuration inode.
 run(compose+['up','-d','--no-build','--no-deps','--force-recreate','proxy'])
 preserved=preserve_others();checks=[]
 for url in ['https://kinshasachristianschool.org/','https://kinshasachristianschool.org/jury/','https://kinshasachristianschool.org/jury/api/health','https://kinshasachristianschool.org/kitchen/','https://kinshasachristianschool.org/sentinel/','https://edupay.kinshasachristianschool.org/','https://academy.kinshasachristianschool.org/','https://kcsparentelection.kinshasachristianschool.org/']:
  with urllib.request.urlopen(url,timeout=20)as response:
   assert response.status==200;checks.append({'url':url,'status':200})
 after=canonical_fingerprints();(backup/'academic.after.json').write_text(json.dumps(after));same=before==after
 # Concurrent genuine teacher edits are reported for review, never overwritten.
 assert all(after[t]['rows']>=before[t]['rows']for t in before),'An existing academic table lost rows'
 report={'status':'PASS','release':a.release,'startedAtUtc':started,'finishedAtUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'services':services+['proxy'],'untargetedContainersPreserved':preserved,'academicSnapshotUnchanged':same,'academicSnapshots':{'before':before,'after':after},'http':checks,'backupDirectory':str(backup),'juryWrappingKeyBackedUp':True,'juryPrivateVolumeIncludedInPeriodicBackup':True,'offserverBackupConfigured':bool(values(backup_env).get('BACKUP_RCLONE_DESTINATION'))}
 (backup/'deployment-result.json').write_text(json.dumps(report,indent=2));print('TARGETED_DEPLOYMENT_EXIT=0',flush=True);print('ACADEMIC_SNAPSHOT_UNCHANGED='+str(same),flush=True)
except BaseException:
 if changed:
  print('Targeted rollout failed; restoring only the previous target application images and proxy.',file=sys.stderr,flush=True)
  atomic(env,(backup/'domains.before.env').read_bytes());atomic(backup_env,(backup/'backup.before.env').read_bytes())
  rollback=['docker','compose','-p','kcs-orbit-production','-f',str(backup/'compose.rollback.json')]
  try:
   if runtime_started:run(rollback+['up','-d','--no-build','--no-deps','--wait','--wait-timeout','300','nexus_api','nexus_web','edupay_web','kitchen_web']);run(rollback+['up','-d','--no-build','--no-deps','--force-recreate','proxy'])
  except Exception as error:print('Rollback requires operator attention: '+type(error).__name__,file=sys.stderr)
  exists=subprocess.run(['docker','inspect',new_name],capture_output=True)
  if exists.returncode==0:
   c=json.loads(exists.stdout)[0]
   if c['Config']['Labels'].get('com.docker.compose.service')=='jury_web'and c['Config']['Labels'].get('com.docker.compose.project')=='kcs-orbit-production':subprocess.run(['docker','stop',new_name],check=False,stdout=subprocess.DEVNULL)
  preserve_others()
 raise
