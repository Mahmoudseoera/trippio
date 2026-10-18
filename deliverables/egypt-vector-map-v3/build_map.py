"""Compose geographically anchored, raster-free Egypt illustrated SVG.

Run: python deliverables/egypt-vector-map-v3/build_map.py
No network or renderer required to build. PNG QA uses separately installed resvg.
Illustration source images were traced to editable paths before composition.
"""
from pathlib import Path
import copy
import gzip
import html
import json
import math
import random
import re
import sys
import time
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
NS = 'http://www.w3.org/2000/svg'
ET.register_namespace('', NS)
W,H = 2400,2378
WEST,EAST,SOUTH,NORTH = 24.0,36.8,21.4,32.7
SCALE = W/(EAST-WEST)
YSCALE = SCALE/math.cos(math.radians(27))
RNG = random.Random(18102026)
GEO = json.loads((ROOT/'source/geography.json').read_text(encoding='utf-8'))
ANCHORS = json.loads((ROOT/'source/anchors.json').read_text(encoding='utf-8'))['anchors']

def project(lon,lat): return ((lon-WEST)*SCALE,(NORTH-lat)*YSCALE)
def unproject(x,y): return WEST+x/SCALE,NORTH-y/YSCALE
def line(points,close=False):
    return 'M'+'L'.join(f'{a:.2f},{b:.2f}' for a,b in points)+('Z' if close else '')
def geo_path(geometry):
    kind=geometry['type'];c=geometry['coordinates']
    if kind=='MultiPolygon': return ' '.join(line([project(*p[:2]) for p in ring],True) for poly in c for ring in poly)
    if kind=='Polygon': return ' '.join(line([project(*p[:2]) for p in ring],True) for ring in c)
    if kind=='MultiLineString': return ' '.join(line([project(*p[:2]) for p in part]) for part in c)
    if kind=='LineString': return line([project(*p[:2]) for p in c])
    raise ValueError(kind)
def contains(point,ring):
    x,y=point;result=False
    for (a,b),(c,d) in zip(ring,ring[1:]+ring[:1]):
        if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a:result=not result
    return result
def polygons(layer):
    for f in GEO['features']:
        if f['properties']['layer']!=layer:continue
        c=f['geometry']['coordinates']
        for poly in (c if f['geometry']['type']=='MultiPolygon' else [c]):
            yield [[project(*p[:2]) for p in ring] for ring in poly]
LAND=list(polygons('land'));EGYPT=list(polygons('egypt'));LAKES=list(polygons('lakes'))
def on_land(x,y):return any(contains((x,y),poly[0]) and not any(contains((x,y),hole) for hole in poly[1:]) for poly in LAND)
def in_egypt(x,y):return any(contains((x,y),poly[0]) and not any(contains((x,y),hole) for hole in poly[1:]) for poly in EGYPT)
def in_lake(x,y):return any(contains((x,y),p[0]) for p in LAKES)
land_d=' '.join(geo_path(f['geometry']) for f in GEO['features'] if f['properties']['layer']=='land')
egypt_d=' '.join(geo_path(f['geometry']) for f in GEO['features'] if f['properties']['layer']=='egypt')
rivers=[f for f in GEO['features'] if f['properties']['layer']=='rivers']
nile=[f for f in rivers if f['properties']['name']=='Nile' and f['properties']['featurecla']=='River']
nile_d=' '.join(geo_path(f['geometry']) for f in nile)
nile_points=[]
for f in nile:
    for part in f['geometry']['coordinates']:nile_points.extend(project(*p) for p in part)

s=[]
def add(value):s.append(value)
def start(id,attrs=''):add(f'<g id="{id}" {attrs}>')
def end():add('</g>')
def drawpath(d,fill='none',attrs=''):add(f'<path d="{d}" fill="{fill}" {attrs}/>')
def geo_shape(coords,fill,attrs=''):drawpath(line([project(*p) for p in coords],True),fill,attrs)

add(f'<svg xmlns="{NS}" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 {W} {H}" width="{W}" height="{H}" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="map-title map-desc">')
add('<title id="map-title">Egypt — a geographic vector illustration</title>')
add('<desc id="map-desc">North-up illustrated Egypt with a geographically sourced coastline, Sinai, both gulfs, Nile Delta, Nile Valley and Lake Nasser. Enlarged architectural illustrations and vegetation are genuine editable vector paths. No embedded raster images. Geographic anchors are supplied separately.</desc>')
add('<defs>')
add('''
<linearGradient id="ocean" x1="0" y1="0" x2=".7" y2="1"><stop stop-color="#0874b2"/><stop offset=".44" stop-color="#079bc3"/><stop offset="1" stop-color="#045a96"/></linearGradient>
<radialGradient id="ocean-glow" cx=".7" cy=".4" r=".8"><stop stop-color="#25cddd" stop-opacity=".7"/><stop offset="1" stop-color="#0b81b6" stop-opacity="0"/></radialGradient>
<linearGradient id="sand" x1="0" y1="0" x2=".55" y2="1"><stop stop-color="#ffe4a0"/><stop offset=".42" stop-color="#fbd384"/><stop offset="1" stop-color="#f2bd68"/></linearGradient>
<radialGradient id="sand-shade"><stop stop-color="#cf9553" stop-opacity=".38"/><stop offset="1" stop-color="#dda25a" stop-opacity="0"/></radialGradient>
<linearGradient id="dune-face" x2=".3" y2="1"><stop stop-color="#fff0b9"/><stop offset="1" stop-color="#e9b45f" stop-opacity=".1"/></linearGradient>
<linearGradient id="dune-shadow" x2=".5" y2="1"><stop stop-color="#c98a44" stop-opacity=".55"/><stop offset="1" stop-color="#ecc06b" stop-opacity="0"/></linearGradient>
<linearGradient id="fertile" x2="1" y2="1"><stop stop-color="#b8c36d"/><stop offset=".5" stop-color="#739d4b"/><stop offset="1" stop-color="#4e924c"/></linearGradient>
<linearGradient id="river" x2="1" y2="0"><stop stop-color="#047bab"/><stop offset=".5" stop-color="#24c9d4"/><stop offset="1" stop-color="#0788b0"/></linearGradient>
<pattern id="agriculture" width="55" height="42" patternUnits="userSpaceOnUse" patternTransform="rotate(-13)"><path d="M0 0h55v42H0z" fill="#8dac58"/><path d="M1 1h24v21H1z" fill="#b6bc63"/><path d="M28 1h26v14H28z" fill="#639949"/><path d="M1 25h24v16H1z" fill="#559447"/><path d="M28 18h26v23H28z" fill="#9cac55"/><path d="M4 1v21m5-21v21m5-21v21m5-21v21M32 18v23m5-23v23m5-23v23m5-23v23" stroke="#e1cd7f" stroke-opacity=".3" stroke-width=".6"/><path d="M0 23h27V0m0 16h28" stroke="#ddce86" stroke-width="1.1" fill="none"/></pattern>
<g id="small-palm"><path d="M0 1q3-10 1-19" stroke="#976d31" stroke-width="1.7" fill="none"/><path d="M1-18Q-9-29-13-18Q-6-22 1-18M1-18Q-7-35 1-29L3-18M1-18Q10-31 13-21Q6-23 1-18M1-18Q15-20 13-10Q7-17 1-18M1-18Q-10-21-9-10Q-3-17 1-18" fill="#4b7d35"/><path d="M1-18l-10-3m10 3v-9m0 9l10-5m-10 5l9 4" stroke="#a1b251" stroke-width=".6" fill="none"/></g>
<g id="small-tree"><ellipse cx="2" cy="1" rx="5" ry="1.5" fill="#8d773f" opacity=".17"/><path d="M0 1v-5" stroke="#937143" stroke-width="1"/><path d="M-4-3q-4-5 0-8q4-5 7 0q6 6-2 9z" fill="#538f45"/><path d="M-3-5q-3-7 3-7" fill="#a7b74b"/></g>
<g id="small-house"><path d="M-5-1l7 3 7-3v-9l-7-3-7 3z" fill="#bd8a52"/><path d="M-5-10l7-3 7 3-7 3z" fill="#ffe6a9"/><path d="M-5-10l7 3V2l-7-3z" fill="#edc486"/><path d="M-2 0v-5h2v6m4-2v-4h2v3" fill="#8b603c"/></g>
''')
add(f'<clipPath id="land-clip"><path d="{land_d}" fill-rule="evenodd"/></clipPath>')
add(f'<clipPath id="egypt-clip"><path d="{egypt_d}" fill-rule="evenodd"/></clipPath>')

# Each trace is a real reusable vector symbol. No raster input is read here.
assets={}
for category in ['landmarks','terrain']:
    meta=json.loads((ROOT/f'symbols/{category}/metadata.json').read_text())
    for item in meta['assets']:
        id=item['id'];assets[id]=item
        svg=ET.parse(ROOT/f'symbols/{category}/{id}.svg').getroot()
        add(f'<symbol id="art-{id}" viewBox="0 0 {item["width"]} {item["height"]}" overflow="visible">')
        for child in svg:
            if child.tag.endswith('title'):continue
            add(ET.tostring(child,encoding='unicode'))
        add('</symbol>')
add('</defs>')

uses=[]
def artwork(id,x,y,width,anchor=(.5,.82),opacity=1,rotation=0):
    meta=assets[id];height=width*meta['height']/meta['width']
    left=x-width*anchor[0];top=y-height*anchor[1]
    trans=f' transform="rotate({rotation:.2f} {x:.2f} {y:.2f})"' if rotation else ''
    # Bounds let the optional viewer cull off-screen complex art at high zoom.
    pad=max(width,height)*.2 if rotation else 0
    box=f'{left-pad:.2f},{top-pad:.2f},{width+pad*2:.2f},{height+pad*2:.2f}'
    add(f'<use xlink:href="#art-{id}" x="{left:.2f}" y="{top:.2f}" width="{width:.2f}" height="{height:.2f}" opacity="{opacity:.3f}" data-art-bounds="{box}"{trans}/>')
    uses.append({'id':id,'bounds':[round(left,2),round(top,2),round(width,2),round(height,2)]})
    return [round(left,2),round(top,2),round(width,2),round(height,2)]
def small(id,x,y,scale=1):add(f'<use xlink:href="#{id}" transform="translate({x:.2f} {y:.2f}) scale({scale:.2f})"/>')

start('seas')
drawpath(f'M0 0h{W}v{H}H0Z','url(#ocean)')
drawpath(f'M0 0h{W}v{H}H0Z','url(#ocean-glow)')
for i in range(1100):
    x,y=RNG.uniform(0,W),RNG.uniform(0,H)
    if not on_land(x,y):
        length=RNG.uniform(4,38)
        drawpath(f'M{x:.1f} {y:.1f}q{length/2:.1f} -2 {length:.1f} 0',attrs=f'stroke="#a5f1ea" stroke-width="{RNG.uniform(.5,1.3):.2f}" opacity="{RNG.uniform(.12,.38):.2f}"')
for stroke,width in [('#169fc0',36),('#35c6cd',21),('#7bdbd4',9)]:drawpath(land_d,attrs=f'stroke="{stroke}" stroke-width="{width}" stroke-linejoin="round"')
end()
start('geographic-land')
drawpath(land_d,'#dfcda5','fill-rule="evenodd" stroke="#fff0c7" stroke-width="2"')
drawpath(egypt_d,'url(#sand)','fill-rule="evenodd" stroke="#f9dc99" stroke-width="1.5"')
end()

start('desert-surface','clip-path="url(#egypt-clip)"')
for i in range(45):
    x=RNG.uniform(0,W);y=RNG.uniform(350,H)
    add(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{RNG.uniform(80,350):.1f}" ry="{RNG.uniform(40,160):.1f}" fill="url(#sand-shade)"/>')
# Continuous flowing vector sand ridges prevent isolated scenery islands.
for i in range(150):
    x=RNG.uniform(0,1450);y=RNG.uniform(350,H)
    length=RNG.uniform(45,220);rise=RNG.uniform(8,24)
    d=f'M{x:.1f} {y:.1f}q{length*.3:.1f} 4 {length*.55:.1f} {-rise:.1f}q{length*.2:.1f} {-rise*.7:.1f} {length*.45:.1f} 0q{-length*.2:.1f} -3 {-length*.4:.1f} {rise*.7:.1f}q{-length*.25:.1f} {rise:.1f} {-length*.6:.1f} {-rise*.7:.1f}Z'
    drawpath(d,'url(#dune-face)')
    drawpath(f'M{x:.1f} {y:.1f}q{length*.3:.1f} 4 {length*.55:.1f} {-rise:.1f}q{length*.2:.1f} {-rise*.7:.1f} {length*.45:.1f} 0',attrs='stroke="#ffedb1" stroke-width="1" opacity=".7"')
for i in range(1300):
    x,y=RNG.uniform(0,W),RNG.uniform(300,H)
    drawpath(f'M{x:.1f} {y:.1f}q9 -2 {RNG.uniform(10,28):.1f} -1',attrs=f'stroke="{RNG.choice(["#fff0b9","#e3af60","#dca05c"])}" stroke-width=".7" opacity=".25"')
end()

start('western-desert-relief','clip-path="url(#egypt-clip)"')
for lon,lat,w in [(25.25,28.35,260),(25.75,27.65,240),(25.4,26.85,250),(25.85,25.9,270),(26.15,24.8,260),(25.2,24.2,230),(26.6,23.55,250),(27.65,24.9,200),(28.4,26.35,155),(27.1,28.7,150),(28.3,29.7,140)]:
    x,y=project(lon,lat);artwork('dunes',x,y,w,opacity=.72,rotation=RNG.uniform(-15,12))
for lon,lat,w in [(25.4,22.9,300),(25.7,23.3,200),(28.5,27.35,180),(27.2,29.25,185),(29.6,26.7,135),(28.25,25.9,160),(26.8,30.15,145)]:
    x,y=project(lon,lat);artwork('plateau',x,y,w,opacity=.82)
end()

start('eastern-desert-relief','clip-path="url(#land-clip)"')
relief=[]
for i in range(37):
    lat=29.48-i*.188;lon=32.15+(29.48-lat)*.43+RNG.uniform(-.08,.22)
    x,y=project(lon,lat)
    if on_land(x,y):relief.append((x,y,RNG.uniform(125,195),'eastern-ridge'))
for i in range(14):
    lat=29.5-i*.107;lon=33.5+RNG.uniform(-.12,.45)
    x,y=project(lon,lat)
    if on_land(x,y):relief.append((x,y,RNG.uniform(105,175),'sinai-ridge'))
# A few remote ridges on neighboring land establish context without competing.
for lat,lon in [(30.9,35.2),(30.3,35.35),(29.55,35.6),(28.8,35.8),(28.1,36.1),(27.4,36.5)]:
    x,y=project(lon,lat);artwork('sinai-ridge',x,y,190,opacity=.45)
for x,y,width,id in sorted(relief,key=lambda p:p[1]):artwork(id,x,y,width,opacity=.92)
end()

# Broad Delta merges with the geographic Nile branches. Field polygons are illustrative.
delta_geo=[(31.15,30.10),(30.7,30.41),(30.35,30.78),(30.02,31.08),(30.25,31.37),(30.42,31.51),(30.88,31.54),(31.3,31.54),(31.8,31.45),(32.12,31.22),(32.04,30.82),(31.65,30.4)]
delta_d=line([project(*p) for p in delta_geo],True)
fayoum_geo=[(30.32,29.5),(30.78,29.5),(31.0,29.28),(30.77,29.06),(30.42,29.15)]
start('nile-agriculture','clip-path="url(#egypt-clip)"')
drawpath(nile_d,attrs='stroke="#adba66" stroke-width="29" stroke-linecap="round" stroke-linejoin="round"')
drawpath(nile_d,attrs='stroke="url(#agriculture)" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"')
drawpath(delta_d,'url(#agriculture)','stroke="#b4c16e" stroke-width="2"')
geo_shape(fayoum_geo,'url(#agriculture)')
end()

start('hydrography')
for f in rivers:
    name=f['properties']['name'];d=geo_path(f['geometry'])
    width=6.3 if name=='Nile' else 4.1 if 'Branch' in name else 2.4
    drawpath(d,attrs=f'stroke="#528d65" stroke-width="{width+3}" stroke-linejoin="round" stroke-linecap="round"')
    drawpath(d,attrs=f'stroke="url(#river)" stroke-width="{width}" stroke-linejoin="round" stroke-linecap="round"')
for f in GEO['features']:
    if f['properties']['layer']!='lakes':continue
    d=geo_path(f['geometry']);id=re.sub('[^a-z0-9]+','-',f['properties']['name'].lower())
    drawpath(d,'url(#river)',f'stroke="#66c9c6" stroke-width="2" fill-rule="evenodd" data-feature="{id}"')
end()

start('riverbank-vegetation')
# Sample along the actual river, keep painted plants on its banks.
plant_points=[]
for f in nile:
    for segment in f['geometry']['coordinates']:
        pts=[project(*p) for p in segment]
        for a,b in zip(pts,pts[1:]):
            length=math.dist(a,b);steps=int(length/8)
            if steps==0:continue
            nx,ny=-(b[1]-a[1])/max(length,1),(b[0]-a[0])/max(length,1)
            for j in range(steps):
                x=a[0]+(b[0]-a[0])*j/steps;y=a[1]+(b[1]-a[1])*j/steps
                side=RNG.choice([-1,1]);off=RNG.uniform(8,15)
                xx,yy=x+nx*side*off,y+ny*side*off
                if not in_lake(xx,yy):plant_points.append((xx,yy,RNG.choice(['small-tree','small-tree','small-palm','small-house'])))
delta_poly=[project(*p) for p in delta_geo]
for i in range(430):
    x=RNG.uniform(1100,1540);y=RNG.uniform(200,550)
    if contains((x,y),delta_poly):plant_points.append((x,y,RNG.choice(['small-tree','small-house','small-palm'])))
for x,y,id in sorted(plant_points,key=lambda p:p[1]):small(id,x,y,RNG.uniform(.45,.9))
end()

destination_by_id={a['id']:copy.deepcopy(a) for a in ANCHORS}
for id,name,lon,lat in [('hatshepsut','Temple of Hatshepsut',32.6064,25.7383),('qaitbay','Citadel of Qaitbay',29.8856,31.2139)]:
    destination_by_id[id]={'id':id,'name':name,'kind':'attraction','longitude':lon,'latitude':lat,'status':'Approximate editorial reference point; not independently source-verified','source':None}

def place(id,art,width,offset=(0,0),anchor=(.5,.82)):
    d=destination_by_id[id];x,y=project(d['longitude'],d['latitude'])
    d['svg']={'x':round(x,3),'y':round(y,3)}
    d['groupId']='destination-'+id
    d['artwork']={'symbolId':'art-'+art,'offset':[offset[0],offset[1]],'note':'Architectural footprint is exaggerated. Use svg anchor for markers, not artwork center.'}
    start(d['groupId'],f'data-longitude="{d["longitude"]}" data-latitude="{d["latitude"]}"')
    d['artwork']['bounds']=artwork(art,x+offset[0],y+offset[1],width,anchor=anchor)
    end()

start('oases-and-settlements')
for id,width in [('siwa',150),('bahariya',132),('farafra',132),('dakhla',155),('kharga',135)]:place(id,'oasis',width)
place('aswan','nubian-village',82,offset=(-18,-3))
place('fayoum','oasis',68,offset=(-15,0))
# Nubian architecture belongs around Aswan, not every Egyptian city.
for id,width,count in [('cairo',75,65),('alexandria',70,40),('hurghada',48,22),('marsa-alam',36,15),('sharm-el-sheikh',40,18),('dahab',34,12),('suez',40,20),('saint-catherine',28,9)]:
    d=destination_by_id[id];x,y=project(d['longitude'],d['latitude'])
    d['svg']={'x':round(x,3),'y':round(y,3)};d['groupId']='destination-'+id
    start(d['groupId'])
    cluster=[]
    for i in range(count):
        xx=x+RNG.uniform(-width*.35,width*.35);yy=y+RNG.uniform(-width*.25,width*.15)
        cluster.append((xx,yy))
    for xx,yy in sorted(cluster,key=lambda p:p[1]):small('small-house',xx,yy,RNG.uniform(.5,.9))
    if id=='cairo':
        drawpath(f'M{x+12:.1f} {y-7:.1f}v-22m-3 4h6m-4-5l1-5 1 5',attrs='stroke="#c59961" stroke-width="2"')
        drawpath(f'M{x-4:.1f} {y-3:.1f}q0-16 9-16q9 0 9 16Z','#f6d99b')
    end()
end()

start('egypt-monuments')
place('qaitbay','qaitbay',133,offset=(-12,-4))
place('giza','giza',265,offset=(-80,10),anchor=(.62,.84))
# Opposite-bank vignettes separate monuments that are only kilometers apart.
place('hatshepsut','hatshepsut',155,offset=(-92,-42))
place('karnak','karnak',165,offset=(75,-55))
place('luxor','luxor',130,offset=(55,58))
place('edfu','edfu',138,offset=(-64,8))
place('kom-ombo','kom-ombo',125,offset=(55,-8))
place('philae','philae',130,offset=(38,45))
place('abu-simbel','abu-simbel',210,offset=(-95,-5))
# West-bank valley location uses a small eroded plateau, not another temple.
place('valley-of-the-kings','plateau',90,offset=(-145,33))
end()

start('nile-life')
for lon,lat in [(31.20,29.5),(30.8,28.6),(31.1,27.7),(31.7,26.65),(32.7,25.3),(32.89,24.6)]:
    target=project(lon,lat);x,y=min(nile_points,key=lambda p:math.dist(target,p))
    artwork('felucca',x+1,y,27,anchor=(.52,.80))
for lon,lat,w in [(32.91,24.12,58),(32.9,23.5,64),(32.1,22.78,60)]:
    x,y=project(lon,lat);artwork('granite-island',x,y,w)
for lon,lat in [(28.4,32.08),(30.2,32.1),(32.1,31.95),(34.8,27.1),(35.6,25.75),(36.45,24.0)]:
    x,y=project(lon,lat)
    if not on_land(x,y):artwork('felucca',x,y,39)
end()

start('country-outline')
# A quiet outline clarifies actual Egypt extent without labels/pins.
drawpath(egypt_d,attrs='stroke="#a97849" stroke-width="1.4" opacity=".48" fill-rule="evenodd"')
end()

add('</svg>')
svg='\n'.join(s)
out=ROOT/'egypt-tourism-vector.svg'
out.write_text(svg,encoding='utf-8',newline='\n')
# Deterministic gzip for servers configured to serve SVG with Content-Encoding:gzip.
(ROOT/'egypt-tourism-vector.svgz').write_bytes(gzip.compress(svg.encode(),compresslevel=9,mtime=0))
for d in destination_by_id.values():
    if 'svg' not in d:
        x,y=project(d['longitude'],d['latitude']);d['svg']={'x':round(x,3),'y':round(y,3)}
reference={'version':3,'viewBox':[0,0,W,H],'coordinateSystem':GEO['metadata']['projection'],
    'warning':'Actual anchor positions are distinct from enlarged illustrated footprints. No marker coordinates from v1/v2 are compatible. Unverified geographic anchors are explicitly flagged.',
    'destinations':list(destination_by_id.values())}
(ROOT/'destinations.json').write_text(json.dumps(reference,ensure_ascii=False,indent=2),encoding='utf-8')

# Structural checks prevent SVG wrappers, broken defs and disconnected anchors.
tree=ET.fromstring(svg)
ids=[e.get('id') for e in tree.iter() if e.get('id')]
assert len(ids)==len(set(ids)), 'Duplicate SVG IDs'
idset=set(ids)
for e in tree.iter():
    tag=e.tag.split('}')[-1]
    assert tag not in ['image','script','foreignObject','text'],tag
    for k,v in e.attrib.items():
        if k.endswith('href'):assert v.startswith('#') and v[1:] in idset, v
        for match in re.findall(r'url\(#([^\)]+)\)',v):assert match in idset,match
for d in destination_by_id.values():
    x,y=d['svg']['x'],d['svg']['y']
    assert 0<=x<=W and 0<=y<=H
    lon,lat=unproject(x,y)
    assert abs(lon-d['longitude'])<.00001 and abs(lat-d['latitude'])<.00001
    if d.get('groupId'):assert d['groupId'] in idset
report={'version':3,'svgBytes':out.stat().st_size,'svgGzipBytes':(ROOT/'egypt-tourism-vector.svgz').stat().st_size,
    'elements':sum(1 for e in tree.iter()),'paths':sum(e.tag.endswith('}path') for e in tree.iter()),
    'symbolDefinitions':len(assets),'illustrationInstances':len(uses),'destinations':len(destination_by_id),
    'embeddedRasterElements':0,'externalReferences':0,'filters':sum(e.tag.endswith('}filter') for e in tree.iter()),
    'passed':['XML parse','unique IDs','internal reference targets','no embedded images or scripts','anchor bounds','coordinate round trips','destination group references'],
    'limits':['Illustrated landmarks are enlarged and offset with metadata; geography follows generalized Natural Earth sources.','Tracing has finite artistic detail; smooth zoom does not create new source detail.','Browser interaction/performance require separate verification.']}
(ROOT/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
template=ROOT/'viewer.template.html'
if template.exists():
    page=template.read_text(encoding='utf-8')
    assert '<!-- MAP_SVG -->' in page
    (ROOT/'viewer.html').write_text(page.replace('<!-- MAP_SVG -->',svg),encoding='utf-8',newline='\n')
print(json.dumps(report))

if '--render' in sys.argv:
    sys.path.insert(0,str(ROOT.parent/'egypt-vector-map/.render-deps'))
    import resvg_py
    t=time.perf_counter()
    (ROOT/'preview.png').write_bytes(resvg_py.svg_to_bytes(svg_string=svg,width=1440,height=1427))
    # A high-zoom view of the Giza paths, rendered directly from SVG geometry.
    crop_tree=ET.fromstring(svg);gx,gy=project(31.1342,29.9792)
    crop_tree.set('viewBox',f'{gx-265:.2f} {gy-190:.2f} 340 270')
    crop_tree.set('width','1700');crop_tree.set('height','1350')
    # Culling is an optional display optimization only; all paths stay in SVG.
    for e in crop_tree.iter():
        if e.get('data-art-bounds'):
            x,y,w,h=map(float,e.get('data-art-bounds').split(','))
            if x+w<gx-265 or x>gx+75 or y+h<gy-190 or y>gy+80:e.set('display','none')
    (ROOT/'detail-giza-5x.png').write_bytes(resvg_py.svg_to_bytes(svg_string=ET.tostring(crop_tree,encoding='unicode'),width=1700,height=1350))
    print(f'Full composition and 5x detail rendered in {time.perf_counter()-t:.1f}s')
