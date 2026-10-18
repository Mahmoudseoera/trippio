"""Package final runtime assets separately from editable source and QA."""
from pathlib import Path
import hashlib
import json
import zipfile

root=Path(__file__).resolve().parent
runtime=['egypt-tourism-vector.svg','egypt-tourism-vector.svgz','viewer.html','viewer.js',
         'destinations.json','coordinates.js','preview.png','detail-giza-5x.png','README.md','validation.json']
excluded={'.deps','.browser-deps','__pycache__','trace-inputs'}

def package(name,files):
    destination=root.parent/name
    with zipfile.ZipFile(destination,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
        for f in files:z.write(f,str(Path(root.name)/f.relative_to(root)))
    with zipfile.ZipFile(destination) as z:
        assert z.testzip() is None
        assert not any('/.deps/' in p or '/.browser-deps/' in p for p in z.namelist())
    return {'file':destination.name,'files':len(files),'bytes':destination.stat().st_size,
            'sha256':hashlib.sha256(destination.read_bytes()).hexdigest()}

results=[package('egypt-vector-map-v3.zip',[root/name for name in runtime])]
source=[]
for f in root.rglob('*'):
    if not f.is_file() or any(part in excluded for part in f.relative_to(root).parts):continue
    if f.name.startswith('ne_10m_') and f.suffix=='.geojson':continue
    if f.name in runtime or f.name=='.gitignore':continue
    source.append(f)
results.append(package('egypt-vector-map-v3-editable-source.zip',source))
(root/'delivery-manifest.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
print(json.dumps(results,indent=2))
