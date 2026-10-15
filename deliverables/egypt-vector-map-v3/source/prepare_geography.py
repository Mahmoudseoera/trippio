"""Prepare compact Egypt-region vector geography without third-party dependencies.

Source geometries are Natural Earth 1:10 million, downloaded 2026-10-15.
Coordinates remain longitude, latitude in degrees (EPSG:4326).
The script clips geometry to the requested map bounds and rounds to 6 decimals.
"""
import hashlib
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OLD = ROOT.parent.parent / 'egypt-vector-map'
BBOX = (24.0, 21.4, 36.8, 32.7)
STANDARD_PARALLEL = 27.0
WIDTH = 2400
HEIGHT = WIDTH * (BBOX[3]-BBOX[1]) / ((BBOX[2]-BBOX[0])*math.cos(math.radians(STANDARD_PARALLEL)))
BASE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'

def read(name):
    return json.loads((ROOT/name).read_text(encoding='utf-8'))

def points(coords):
    if not coords:
        return
    if isinstance(coords[0], (int, float)):
        yield coords
    else:
        for child in coords:
            yield from points(child)

def bounds(geom):
    pts = list(points(geom['coordinates']))
    if not pts:
        return None
    return [min(p[0] for p in pts),min(p[1] for p in pts),max(p[0] for p in pts),max(p[1] for p in pts)]

def overlaps(geom):
    b = bounds(geom)
    return b is not None and b[0] <= BBOX[2] and b[2] >= BBOX[0] and b[1] <= BBOX[3] and b[3] >= BBOX[1]

def clean(coords):
    out=[]
    for p in coords:
        p=[round(p[0],6),round(p[1],6)]
        if not out or p!=out[-1]:
            out.append(p)
    return out

def clip_ring(ring):
    # Sutherland-Hodgman clipping. Artificial connectors lie on the map frame.
    out=ring[:-1] if ring and ring[0]==ring[-1] else list(ring)
    for axis,edge,keep_greater in [(0,BBOX[0],True),(0,BBOX[2],False),(1,BBOX[1],True),(1,BBOX[3],False)]:
        inp=out
        out=[]
        if not inp:
            return []
        def inside(p):return p[axis]>=edge if keep_greater else p[axis]<=edge
        def intersection(a,b):
            t=(edge-a[axis])/(b[axis]-a[axis])
            return [a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]
        prev=inp[-1]
        for curr in inp:
            if inside(curr):
                if not inside(prev):out.append(intersection(prev,curr))
                out.append(curr)
            elif inside(prev):out.append(intersection(prev,curr))
            prev=curr
    out=clean(out)
    if len(out)<3:return []
    if out[0]!=out[-1]:out.append(out[0])
    return out

def clip_polygon(poly):
    if not poly:return []
    outer=clip_ring(poly[0])
    if not outer:return []
    holes=[clip_ring(r) for r in poly[1:]]
    return [outer]+[h for h in holes if h]

def clip_segment(a,b):
    # Liang-Barsky clipping for linework.
    dx,dy=b[0]-a[0],b[1]-a[1]
    lo,hi=0.,1.
    for p,q in [(-dx,a[0]-BBOX[0]),(dx,BBOX[2]-a[0]),(-dy,a[1]-BBOX[1]),(dy,BBOX[3]-a[1])]:
        if p==0:
            if q<0:return None
            continue
        t=q/p
        if p<0:lo=max(lo,t)
        else:hi=min(hi,t)
        if lo>hi:return None
    return [a[0]+lo*dx,a[1]+lo*dy],[a[0]+hi*dx,a[1]+hi*dy]

def clip_line(line):
    parts=[]
    current=[]
    for a,b in zip(line,line[1:]):
        pair=clip_segment(a,b)
        if pair is None:
            if len(current)>1:parts.append(clean(current))
            current=[]
            continue
        a,b=pair
        if current and (abs(current[-1][0]-a[0])>1e-7 or abs(current[-1][1]-a[1])>1e-7):
            if len(current)>1:parts.append(clean(current))
            current=[]
        if not current:current.append(a)
        current.append(b)
    if len(current)>1:parts.append(clean(current))
    return [p for p in parts if len(p)>1]

def clip_geometry(g):
    if not overlaps(g):return None
    kind,c=g['type'],g['coordinates']
    if kind in ('Polygon','MultiPolygon'):
        polys=[clip_polygon(p) for p in ([c] if kind=='Polygon' else c)]
        polys=[p for p in polys if p]
        if not polys:return None
        return {'type':'MultiPolygon','coordinates':polys}
    if kind in ('LineString','MultiLineString'):
        lines=[]
        for line in ([c] if kind=='LineString' else c):lines.extend(clip_line(line))
        if not lines:return None
        return {'type':'MultiLineString','coordinates':lines}
    raise ValueError(kind)

features=[]
source_records=[]
for name,layer in [('ne_10m_land.geojson','land'),('ne_10m_admin_0_countries.geojson','egypt'),('ne_10m_rivers_lake_centerlines.geojson','rivers'),('ne_10m_lakes.geojson','lakes')]:
    source_records.append({'filename':name,'url':BASE+name,'sha256':hashlib.sha256((ROOT/name).read_bytes()).hexdigest()})
    for idx,f in enumerate(read(name)['features']):
        p=f['properties']
        if layer=='egypt' and p.get('ADMIN')!='Egypt':continue
        if layer=='rivers' and p.get('name') not in ('Nile','Rosetta Branch','Damietta Branch','Suez Canal','Ismailiya Canal'):continue
        clipped=clip_geometry(f['geometry'])
        if clipped is None:continue
        props={'layer':layer,'name':p.get('name') or p.get('NAME') or 'Land','source':name,'source_feature_index':idx}
        for key in ['featurecla','scalerank','min_zoom']:
            if key in p:props[key]=p[key]
        features.append({'type':'Feature','properties':props,'geometry':clipped})

metadata={
    'prepared':'2026-10-15',
    'coordinate_system':'EPSG:4326; longitude,latitude degrees',
    'projection':{'name':'Equirectangular with standard parallel 27 degrees north','orientation':'north-up','standard_parallel':STANDARD_PARALLEL,'bbox':list(BBOX),'suggested_width':WIDTH,'suggested_height':HEIGHT,'suggested_viewBox':[0,0,WIDTH,round(HEIGHT)],'forward_x':'(longitude - 24) * 2400 / 12.8','forward_y':'(32.7 - latitude) * 2400 / (12.8 * cos(27 degrees))','note':'Uniform local geographic scale at 27N; north-south distances are not squeezed into a panorama. Longitude distortion varies modestly with latitude.'},
    'source_scale':'1:10,000,000 generalized cartography; 10m means ten million scale, not ten-meter accuracy',
    'sources':source_records,
    'license':{'name':'Natural Earth public domain','url':'https://www.naturalearthdata.com/about/terms-of-use/'},
    'geometry_processing':'Clipped to map bounds; no additional simplification; rounded to 6 decimal places. Land clipping connectors coincide with the frame.',
    'boundary_note':'Egypt outline is supplied by Natural Earth without alteration; political boundary representation is not a survey or an official legal determination.',
    'coverage_note':'Both Nile delta branches, Nile river plus Lake Nasser centerline, Suez and Ismailiya canals, and Lake Nasser are included. The source omits several smaller Egyptian lakes including Lake Qarun; no invented lake geometry is added.'
}
fc={'type':'FeatureCollection','bbox':list(BBOX),'metadata':metadata,'features':features}
(ROOT/'geography.json').write_text(json.dumps(fc,separators=(',',':'),ensure_ascii=False),encoding='utf-8')

# Retain the established 23 ids, improve city anchors from checked source records,
# and clearly distinguish unsurveyed monument/oasis reference points.
old=json.loads((OLD/'destinations.json').read_text(encoding='utf-8'))['destinations']
towns=json.loads((OLD/'source/ne_10m_populated_places.geojson').read_text(encoding='utf-8'))['features']
towns={f['properties']['NAME']:f for f in towns if f['properties'].get('ADM0NAME')=='Egypt'}
city_names={'siwa':'Siwa','farafra':'Qasr Farafra','kharga':'El Kharga','fayoum':'El Faiyum','alexandria':'Alexandria','cairo':'Cairo','luxor':'Luxor','aswan':'Aswan','hurghada':'Hurghada','suez':'Suez'}
display_names={'siwa':'Siwa','bahariya':'Bahariya','farafra':'Farafra','dakhla':'Dakhla','kharga':'Kharga','fayoum':'Fayoum','alexandria':'Alexandria','cairo':'Cairo','giza':'Giza Pyramids','luxor':'Luxor','karnak':'Karnak','valley-of-the-kings':'Valley of the Kings','edfu':'Edfu','kom-ombo':'Kom Ombo','aswan':'Aswan','philae':'Philae','abu-simbel':'Abu Simbel','hurghada':'Hurghada','marsa-alam':'Marsa Alam','sharm-el-sheikh':'Sharm el-Sheikh','dahab':'Dahab','suez':'Suez','saint-catherine':'Saint Catherine'}
anchors=[]
for f in old:
    id=f['id'];g=f['geographic']
    a={'id':id,'name':display_names[id],'kind':f['kind'],'longitude':g['longitude'],'latitude':g['latitude'],'status':'Approximate editorial reference point; not surveyed or independently source-verified in this revision','source':None,'illustration_note':'Illustration may be enlarged and displaced for legibility; the geographic anchor must remain fixed.'}
    if id in city_names:
        src=towns[city_names[id]]
        a.update(longitude=src['geometry']['coordinates'][0],latitude=src['geometry']['coordinates'][1],status='Verified against local Natural Earth 10m populated places source; generalized city center, not monument footprint',source=BASE+'ne_10m_populated_places.geojson',source_name=city_names[id])
    anchors.append(a)
(ROOT/'anchors.json').write_text(json.dumps({'coordinate_system':'EPSG:4326','anchors':anchors},indent=2,ensure_ascii=False),encoding='utf-8')

nasser=[f for f in features if f['properties']['name']=='Lake Nasser']
assert len(anchors)==23
assert len(nasser)==1
assert all(BBOX[0]<=a['longitude']<=BBOX[2] and BBOX[1]<=a['latitude']<=BBOX[3] for a in anchors)
assert {'Rosetta Branch','Damietta Branch','Nile'}.issubset({f['properties']['name'] for f in features})
counts={layer:sum(f['properties']['layer']==layer for f in features) for layer in ['land','egypt','rivers','lakes']}
report={'features':counts,'total_features':len(features),'coordinate_points':sum(len(list(points(f['geometry']['coordinates']))) for f in features),'lake_nasser_bounds':bounds(nasser[0]['geometry']),'lake_nasser_vertices':len(list(points(nasser[0]['geometry']['coordinates']))),'anchors':len(anchors),'verified_city_anchors':len(city_names),'illustrative_approximate_anchors':len(anchors)-len(city_names),'projection_height':HEIGHT,'output_bytes':(ROOT/'geography.json').stat().st_size}
(ROOT/'geography-validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report,indent=2))
