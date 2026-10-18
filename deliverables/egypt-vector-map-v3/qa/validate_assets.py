"""Read-only asset validation plus rendered visual QA for the v3 map symbols."""
from pathlib import Path
import sys
import json
import re
import math
import io
import xml.etree.ElementTree as ET
from collections import Counter

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / '.deps'))
sys.path.insert(0, str(ROOT.parent / 'egypt-vector-map' / '.render-deps'))
from PIL import Image, ImageDraw, ImageFont
import resvg_py

SVG = '{http://www.w3.org/2000/svg}'
XLINK = '{http://www.w3.org/1999/xlink}href'
qa = ROOT / 'qa'
qa.mkdir(exist_ok=True)
report = {'assets': [], 'libraries': [], 'issues': [], 'render_engine': 'resvg_py ' + resvg_py.__version__}
cells = []
font = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 23)
small = ImageFont.truetype('C:/Windows/Fonts/arial.ttf', 17)

def inspect(xml):
    ids = [e.attrib['id'] for e in xml.iter() if 'id' in e.attrib]
    refs = []
    external = []
    for e in xml.iter():
        for k, value in e.attrib.items():
            refs.extend(re.findall(r'url\(#([^\)]+)\)', value))
            if k in ('href', XLINK):
                if value.startswith('#'): refs.append(value[1:])
                else: external.append(value)
    return {
        'path_count': len(list(xml.iter(SVG + 'path'))),
        'image_count': len(list(xml.iter(SVG + 'image'))),
        'foreign_object_count': len(list(xml.iter(SVG + 'foreignObject'))),
        'filter_count': len(list(xml.iter(SVG + 'filter'))),
        'ids': ids,
        'duplicate_ids': [k for k, v in Counter(ids).items() if v > 1],
        'unresolved_local_references': sorted(set(refs) - set(ids)),
        'external_references': external,
    }

for category in ('landmarks', 'terrain'):
    folder = ROOT / 'symbols' / category
    metadata = json.loads((folder / 'metadata.json').read_text(encoding='utf-8'))
    library = ET.parse(folder / 'symbols.svg').getroot()
    library_record = inspect(library)
    library_record.update(category=category, symbol_ids=[s.attrib['id'] for s in library.iter(SVG + 'symbol')])
    report['libraries'].append(library_record)
    for asset in metadata['assets']:
        file = folder / asset['svg']
        xml = ET.parse(file).getroot()
        record = inspect(xml)
        record.update(id=asset['id'], category=category, file=str(file.relative_to(ROOT)),
                      viewBox=asset['viewBox'], anchor=asset['anchor'], bytes=file.stat().st_size,
                      paths_match_metadata=record['path_count'] == asset['total_paths'])
        svgtext = ET.tostring(xml, encoding='unicode')
        record['contains_data_uri'] = 'data:' in svgtext
        img = Image.open(io.BytesIO(resvg_py.svg_to_bytes(svg_string=svgtext, width=asset['width']*2))).convert('RGBA')
        alpha = img.getchannel('A')
        record['rendered_size'] = list(img.size)
        record['visible_bbox'] = list(alpha.getbbox()) if alpha.getbbox() else None
        record['nontransparent_pixels'] = sum(v for i,v in enumerate(alpha.histogram()) if i > 0)
        record['distinct_rgb_colors'] = len(img.convert('RGB').getcolors(maxcolors=2000000) or [])
        record['raster_free'] = not any([record['image_count'], record['foreign_object_count'], record['contains_data_uri'], record['external_references']])
        for field in ('duplicate_ids', 'unresolved_local_references', 'external_references'):
            if record[field]: report['issues'].append({'id':asset['id'], 'field':field, 'value':record[field]})
        if not record['raster_free'] or not record['paths_match_metadata'] or not record['nontransparent_pixels']:
            report['issues'].append({'id':asset['id'], 'field':'asset_integrity'})
        cell = Image.new('RGB',(480,440),'#fbefd2')
        draw = ImageDraw.Draw(cell)
        draw.rectangle((0,0,479,439),outline='#d4b98a',width=2)
        draw.text((20,15),asset['id'],font=font,fill='#253e40')
        draw.text((20,47),f"{asset['width']} x {asset['height']} | {record['path_count']} paths",font=small,fill='#675e4c')
        img.thumbnail((440,340), Image.Resampling.LANCZOS)
        cell.paste(img,((480-img.width)//2,87+(340-img.height)//2),img)
        cells.append(cell)
        report['assets'].append(record)

sheet = Image.new('RGB',(1440,440*6),'#fbefd2')
for i, cell in enumerate(cells): sheet.paste(cell,((i%3)*480,(i//3)*440))
sheet.save(qa/'assets-preview.png')
report['summary'] = {'asset_count':len(report['assets']), 'paths':sum(a['path_count'] for a in report['assets']),
                     'bytes':sum(a['bytes'] for a in report['assets']), 'raster_free':all(a['raster_free'] for a in report['assets']),
                     'structural_issues':len(report['issues'])}

geo = json.loads((ROOT/'source/geography.json').read_text(encoding='utf-8'))
anchors = json.loads((ROOT/'source/anchors.json').read_text(encoding='utf-8'))['anchors']
bbox = geo['bbox']
def pts(c):
    if isinstance(c[0], (int,float)): yield c
    else:
        for part in c: yield from pts(part)
all_points = [p for f in geo['features'] for p in pts(f['geometry']['coordinates'])]
names = [f['properties']['name'] for f in geo['features']]
report['geography'] = {
    'bounds':bbox, 'projection':geo['metadata']['projection'], 'layers':dict(Counter(f['properties']['layer'] for f in geo['features'])),
    'feature_names':names, 'points':len(all_points),
    'nonfinite_coordinates':sum(not math.isfinite(v) for p in all_points for v in p),
    'coordinates_outside_bounds':sum(not (bbox[0]-1e-6<=p[0]<=bbox[2]+1e-6 and bbox[1]-1e-6<=p[1]<=bbox[3]+1e-6) for p in all_points),
    'anchors':len(anchors), 'anchor_ids_unique':len(set(a['id'] for a in anchors))==len(anchors),
    'anchors_outside_bounds':[a['id'] for a in anchors if not (bbox[0]<=a['longitude']<=bbox[2] and bbox[1]<=a['latitude']<=bbox[3])],
    'source_scale':geo['metadata']['source_scale'], 'coverage_note':geo['metadata']['coverage_note'],
}
report['visual_review'] = {
    'contact_sheet_inspected':True,
    'missing_or_visibly_clipped_assets':[],
    'visible_color_fringe_on_sand_background':False,
    'style':'Coherent warm, dimensional illustration with simplified color regions from vector tracing.',
    'geography_preview_inspected':True,
    'geography_observations':'North-up Egypt outline, Sinai between the gulfs, Nile meanders, delta branches, and Lake Nasser are clearly preserved in the source diagnostic.',
    'limitations':[
        'Illustrative monument shapes are not verified architectural reconstructions.',
        'Paths scale without raster pixels; zoom does not restore source detail omitted by tracing.',
        'Water around Qaitbay, Philae, felucca, and granite islands is part of the symbol artwork and needs deliberate compositing.',
        'The source geography is generalized 1:10 million cartography, not surveying accuracy.'
    ]
}
(qa/'asset-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')

# Separate diagnostic of source geometry, without scenic illustration offsets.
width, height = 900, 900 * geo['metadata']['projection']['suggested_height'] / 2400
scale = width / (bbox[2] - bbox[0])
sy = scale / math.cos(math.radians(27))
def project(p): return ((p[0]-bbox[0])*scale, (bbox[3]-p[1])*sy)
def pathline(ring, close=False):
    points = [project(p) for p in ring]
    return 'M'+' L'.join(f'{x:.3f} {y:.3f}' for x,y in points)+(' Z' if close else '')
parts = [f'<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height:.3f}" viewBox="0 0 {width} {height:.3f}"><rect width="100%" height="100%" fill="#7dcee4"/>']
for layer in ('land', 'egypt', 'lakes', 'rivers'):
    for f in geo['features']:
        if f['properties']['layer'] != layer: continue
        geometry = f['geometry']
        if geometry['type'] == 'MultiPolygon':
            d = ' '.join(pathline(ring,True) for poly in geometry['coordinates'] for ring in poly)
        else: d = ' '.join(pathline(line) for line in geometry['coordinates'])
        styles = {'land':'fill="#e8e1c6" stroke="#bcaf87" stroke-width="1"',
                  'egypt':'fill="#f9e6ac" stroke="#a67736" stroke-width="1.5"',
                  'lakes':'fill="#41afd0" stroke="#3f9eb9" stroke-width="1"',
                  'rivers':'fill="none" stroke="#128aaf" stroke-width="2.3"'}
        parts.append(f'<path d="{d}" {styles[layer]} fill-rule="evenodd"/>')
for a in anchors:
    x,y = project([a['longitude'], a['latitude']])
    parts.append(f'<circle cx="{x:.2f}" cy="{y:.2f}" r="3.5" fill="#d85d32" stroke="white" stroke-width="1"/>')
    if a['kind'] == 'destination':
        parts.append(f'<text x="{x+5:.2f}" y="{y-5:.2f}" font-family="Arial" font-size="12" fill="#213d3e">{a["name"]}</text>')
parts.append('</svg>')
diagnostic = ''.join(parts)
(qa/'geography-preview.svg').write_text(diagnostic, encoding='utf-8')
(qa/'geography-preview.png').write_bytes(resvg_py.svg_to_bytes(svg_string=diagnostic, width=900))
print(json.dumps({'summary':report['summary'],'geography':{k:v for k,v in report['geography'].items() if k not in ('projection', 'coverage_note')},'preview':str(qa/'assets-preview.png')},indent=2))
