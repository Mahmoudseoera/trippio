"""Deterministic, editable Egypt illustration. Python standard library only.
Source geometry: Natural Earth public-domain 1:50m physical / 1:10m places.
Rendering is optional: pip install resvg-py (see README).
"""
from pathlib import Path
import json, math, random, sys, xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
random.seed(241015)
W,H=1920,1120
WEST,EAST,SOUTH,NORTH=24.0,36.8,21.7,32.8
def xy(lon,lat): return ((lon-WEST)/(EAST-WEST)*W,(NORTH-lat)/(NORTH-SOUTH)*H)
def read(name): return json.loads((ROOT/'source'/f'{name}.geojson').read_text(encoding='utf-8'))['features']
def path(points,close=False):
    return 'M'+' L'.join(f'{x:.2f},{y:.2f}' for x,y in points)+(' Z' if close else '')
def project(points): return [xy(*p[:2]) for p in points]
def crop(poly):
    for axis,bound,sign in [(0,0,1),(0,W,-1),(1,0,1),(1,H,-1)]:
        result=[]
        if not poly: break
        for a,b in zip(poly,poly[1:]+poly[:1]):
            ai=(a[axis]-bound)*sign>=0; bi=(b[axis]-bound)*sign>=0
            if ai: result.append(a)
            if ai!=bi:
                t=(bound-a[axis])/(b[axis]-a[axis]); result.append((a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])))
        poly=result
    return poly
def inside(x,y,poly):
    hit=False
    for (a,b),(c,d) in zip(poly,poly[1:]+poly[:1]):
        if (b>y)!=(d>y) and x<(c-a)*(y-b)/(d-b)+a: hit=not hit
    return hit

lands=[]
for f in read('ne_50m_land'):
    polys=f['geometry']['coordinates']
    if f['geometry']['type']=='Polygon': polys=[polys]
    for p in polys:
        exterior=crop(project(p[0]))
        if len(exterior)>2: lands.append(exterior)
land_d=' '.join(path(p,True) for p in lands)
def is_land(x,y): return any(inside(x,y,p) for p in lands)
nile=[]
for f in read('ne_50m_rivers_lake_centerlines'):
    if f['properties'].get('name')!='Nile': continue
    lines=f['geometry']['coordinates']
    if f['geometry']['type']=='LineString': lines=[lines]
    for line in lines:
        pts=[xy(*p) for p in line if 21.4<p[1]<32.3 and 28<p[0]<34]
        if len(pts)>1: nile.append(pts)
nile_d=' '.join(path(p) for p in nile)
lakes=[]
for f in read('ne_50m_lakes'):
    polys=f['geometry']['coordinates']
    if f['geometry']['type']=='Polygon': polys=[polys]
    for p in polys:
        ext=project(p[0])
        if any(0<x<W and 0<y<H for x,y in ext):
            ext=crop(ext)
            if len(ext)>2: lakes.append((f['properties'].get('name') or 'Lake',ext))

s=['<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 1920 1120" width="1920" height="1120" preserveAspectRatio="xMidYMid meet" role="img" aria-labelledby="map-title map-desc">',
   '<title id="map-title">Egypt — illustrated Nile, deserts and coasts</title>',
   '<desc id="map-desc">An unlabelled vector landscape of Egypt. North is up. Mediterranean coast and fertile Delta above a winding Nile, western oases, Eastern Desert mountains, Red Sea and Sinai. Monument illustrations are enlarged; geographic anchors are supplied separately.</desc>']
def add(t): s.append(t)
def use(name,x,y,scale=1,extra=''):
    add(f'<use xlink:href="#{name}" transform="translate({x:.2f} {y:.2f}) scale({scale:.3f})" {extra}/>')
def begin(id,extra=''): add(f'<g id="{id}" {extra}>')
def end(): add('</g>')
add('''<defs>
<linearGradient id="sea" x2="0.4" y2="1"><stop stop-color="#0878ad"/><stop offset=".45" stop-color="#13b5c8"/><stop offset="1" stop-color="#006c9b"/></linearGradient>
<linearGradient id="sand" x2=".3" y2="1"><stop stop-color="#ffe5a1"/><stop offset=".5" stop-color="#f9d07a"/><stop offset="1" stop-color="#eeb35f"/></linearGradient>
<linearGradient id="dune-light" x2=".4" y2="1"><stop stop-color="#fff0bc"/><stop offset="1" stop-color="#f3be65"/></linearGradient>
<linearGradient id="dune-shade" x2="0" y2="1"><stop stop-color="#d79143"/><stop offset="1" stop-color="#f4c66c" stop-opacity="0"/></linearGradient>
<linearGradient id="stone" x2=".8" y2=".9"><stop stop-color="#ffe3a3"/><stop offset=".5" stop-color="#e6ac5f"/><stop offset="1" stop-color="#bc793d"/></linearGradient>
<linearGradient id="rock-light" x2=".8" y2="1"><stop stop-color="#ffe0a0"/><stop offset=".45" stop-color="#d99b59"/><stop offset="1" stop-color="#b87643"/></linearGradient>
<linearGradient id="green" x2="0" y2="1"><stop stop-color="#98ba57"/><stop offset="1" stop-color="#397e4b"/></linearGradient>
<pattern id="water-strokes" width="76" height="45" patternUnits="userSpaceOnUse"><path d="M4 9q12-4 24 0m15 22q12-3 26 0M0 41h12" fill="none" stroke="#a2f1eb" stroke-opacity=".23" stroke-width="1.1"/></pattern>
<pattern id="fields" width="44" height="32" patternUnits="userSpaceOnUse" patternTransform="rotate(-12)"><path fill="#89a64c" d="M0 0h44v32H0z"/><path fill="#b2bd62" d="M1 1h19v14H1z"/><path fill="#588d4b" d="M23 1h20v23H23z"/><path fill="#d7c274" d="M1 18h19v12H1z"/><path d="M5 1v14m5-14v14m5-14v14m12-14v23m5-23v23m5-23v23" stroke="#e0d58c" stroke-opacity=".32" stroke-width=".7"/></pattern>
<g id="palm"><ellipse cx="7" cy="1" rx="13" ry="3" fill="#70572c" opacity=".2"/><path d="M0 0q3-13 1-25" fill="none" stroke="#9c6d30" stroke-width="3"/><path d="M0-3l2-2m-2-4l2-2m-2-4l2-2" stroke="#ebbc68" stroke-width="1"/><path d="M1-25Q-11-37-17-23Q-7-28 1-25M1-25Q-9-46 0-39L4-26M1-25Q13-42 18-29Q10-32 1-25M1-25Q20-29 19-17Q10-24 1-25M1-25Q-13-27-12-15Q-4-24 1-25M1-25Q8-29 10-12Q4-23 1-25" fill="#367541"/><path d="M1-25l-12-3m12 3L0-36m1 11l12-8m-12 8l14 5m-14-5l-9 6" fill="none" stroke="#94ac49" stroke-width="1"/><circle cx="2" cy="-24" r="2" fill="#bd8c32"/></g>
<g id="tree"><ellipse cx="4" cy="0" rx="8" ry="2" fill="#766333" opacity=".2"/><path d="M0 0v-9" stroke="#946433" stroke-width="2"/><path d="M-7-6q-5-7 2-10q-1-10 7-9q8 0 7 9q7 8-1 12z" fill="#498249"/><path d="M-5-9q-4-8 4-12q5-2 6 5" fill="#7ca24e"/></g>
<g id="house"><path d="M-7-1L4 4l10-5V-14L3-18-7-13z" fill="#c28a50"/><path d="M-7-13L3-18l11 4-10 5z" fill="#ffe4a3"/><path d="M-7-13L4-9V4L-7-1z" fill="#e9b774"/><path d="M-3 1v-7h3v8m7-5v-5h3v4" fill="#785536"/><path d="M-7-13v-3L4-12l10-5v3" fill="none" stroke="#f7d995" stroke-width="2"/></g>
<g id="nubian-house"><use xlink:href="#house"/><path d="M-7-13q5-15 11 4" fill="#fff0ba"/><path d="M-7-8L4-4v8L-7-1z" fill="#64acb0"/><path d="M-3 1v-6h3v7" fill="#285c66"/><path d="M-7-6L4-2" stroke="#f9e5a3"/></g>
<g id="felucca"><ellipse cx="3" cy="3" rx="15" ry="4" fill="#005f85" opacity=".25"/><path d="M-15-1Q0 10 16-2L11 4q-15 8-24-1z" fill="#8f542e"/><path d="M-14-1l28-1" stroke="#ffe3a2" stroke-width="2"/><path d="M1 0v-40" stroke="#795f39" stroke-width="1.4"/><path d="M0-38L-12-5 0-4z" fill="#fffbe0"/><path d="M3-31L15-6 3-4z" fill="#e8e8cd"/><path d="M-18 8q20 7 38-2" stroke="#adf1e4" fill="none" stroke-width="1"/></g>
<g id="mountain"><path d="M-41 8L-27-9-13-18 0-53 15-30 26-27 44 10 7 20z" fill="#ad7443" opacity=".18"/><path d="M-43 8L-25-13-15-15 0-51 13-28 22-24 39 9 8 15z" fill="url(#rock-light)"/><path d="M0-51L-6-19 3-26 8 15 39 9 22-24 13-28z" fill="#a5663c"/><path d="M0-51L6-15 13-28 8 4 25 7 16-18 22-24 39 9 8 15-2-8-13 8-5-21-15-15-25 6-25-13" fill="none" stroke="#f5c485" stroke-width="2"/><path d="M-15-15L-20 7-7 3m20-31l5 26m4-22l8 25" fill="none" stroke="#bc8048" stroke-width="1.5"/></g>
<g id="dune"><path d="M-80 12Q-30 7 4-14Q32-30 76 4Q29-9 4 7Q-28 20-80 12" fill="url(#dune-light)"/><path d="M-80 12Q-28 20 4 7Q29-9 76 4Q21 8 11 21Q-35 33-80 12" fill="url(#dune-shade)"/><path d="M-80 12Q-30 7 4-14Q32-30 76 4" stroke="#ffeab0" stroke-width="1.2" fill="none"/></g>
<g id="pyramid"><path d="M-56 9L9-74 64 16 4 36z" fill="#bd7d3c" opacity=".18"/><path d="M-59 1L0-76 9 26z" fill="url(#stone)"/><path d="M0-76L60 2 9 26z" fill="#ad7038"/><path d="M-59 1L9 26 60 2" fill="none" stroke="#f8cf83" stroke-width="2"/><path d="M-46-16l53 18m-42-31l40 14m-29-29l27 9m-17-23l15 5m-47 61l63 22M15-53l-11 5m24 12L6-27m36 9L8-6M53-3L9 15" stroke="#87572e" stroke-opacity=".3" stroke-width="1"/></g>
<g id="column"><path d="M-5 0h11v-3H-5zM-4-3h8v-29h-8z" fill="url(#stone)"/><path d="M-6-38H6l-2 7h-8z" fill="#eec180"/><path d="M-6-39H6v3H-6z" fill="#ffe0a0"/><path d="M-1-30v25m3-25v25" stroke="#a46936" stroke-width=".8"/></g>
<g id="obelisk"><path d="M-4 1L-3-51 0-60 4-52 6 0z" fill="#f2c784"/><path d="M0-60L4-52 6 0 1 2z" fill="#a9703e"/><path d="M-1-45v33m-2-25h3m-3 7h3m-3 7h3" stroke="#b18045" stroke-width=".7"/></g>
<g id="sphinx"><ellipse cx="5" cy="2" rx="32" ry="6" fill="#a06a36" opacity=".2"/><path d="M-28-2l4-10 28-2 2-17 6-8 10 2 4 9-5 10 3 19H7L0-4z" fill="url(#stone)"/><path d="M8-29l3-10 10 2 5 9-5 4-2-10h-6l-1 12-5 4z" fill="#ba8247"/><path d="M11-29h7l-1 8-5 1zM4-6h21v5H4zM-26-3H1v4h-28" fill="#efc486"/><path d="M12-27h2m2 0h2m-6 5h5" stroke="#785436" stroke-width=".8"/></g>
</defs>''')
add(f'<defs><clipPath id="land-clip"><path d="{land_d}"/></clipPath>')
# Irregular eroded ridges, with separate sunlit faces, gullies and scree.
for k in range(4):
    rng=random.Random(100+k)
    add(f'<g id="ridge-{k}">')
    peaks=[(-58,8),(-46,-8),(-36,-12),(-26,-32),(-16,-28),(-4,-59),(5,-49),(14,-31),(25,-36),(37,-12),(49,-4),(60,15)]
    peaks=[(a+rng.uniform(-4,4),b+rng.uniform(-5,5)) for a,b in peaks]
    add(f'<path d="{path(peaks+[(31,25),(-9,21),(-46,18)],True)}" fill="url(#rock-light)"/>')
    for j in [3,5,8]:
        a,b=peaks[j];base=a+rng.uniform(8,26)
        add(f'<path d="M{a:.1f} {b:.1f}l4 18-3 11 8 12L{base:.1f} 22l-5-17 5-6-12-14z" fill="#9c613b" opacity=".67"/>')
        add(f'<path d="M{a:.1f} {b:.1f}l-5 18 1 9-10 13-8 13m22-36l6 15-4 10 8 13" fill="none" stroke="#ffdda0" stroke-width="1.4"/>')
    for j in range(20):
        xx=rng.uniform(-46,46);yy=rng.uniform(5,20)
        add(f'<path d="M{xx:.1f} {yy:.1f}l{rng.uniform(2,7):.1f} -2 4 3-6 1z" fill="{rng.choice(["#c28b51","#edbe7c","#ffdfa1"])}"/>')
    end()
add('<g id="plateau"><path d="M-87 16l13-26 20-11 93-9 31 15 20 25-19 17-96 5z" fill="#bc824b"/><path d="M-74-10l20-11 93-9 31 15-28 14-95 11z" fill="#f6d38a"/><path d="M-74-10l-5 22m16-18l-3 24m15-20l-2 26m16-29l-2 26m15-27l-1 27m16-28l2 26m13-26l3 23m12-26l4 20m11-24l7 19" stroke="#e6b573" stroke-width="4"/><path d="M-53-13l59-8m-34 15l63-9" stroke="#ffe7a8" stroke-width="2"/></g></defs>')
begin('seas');add('<path fill="url(#sea)" d="M0 0h1920v1120H0z"/><path fill="url(#water-strokes)" d="M0 0h1920v1120H0z"/>');end()
begin('geography')
add(f'<path d="{land_d}" fill="none" stroke="#46d1cc" stroke-width="22" stroke-linejoin="round"/>')
add(f'<path id="land-boundaries" d="{land_d}" fill="url(#sand)" stroke="#fff0bd" stroke-width="2.5"/>')
end()
begin('western-desert','clip-path="url(#land-clip)"')
for i in range(290):
    x=random.uniform(-50,W+50); y=random.uniform(150,H+50)
    use('dune',x,y,random.uniform(.45,1.6),f'opacity="{random.uniform(.3,.75):.2f}"')
for i in range(850):
    x=random.uniform(0,W);y=random.uniform(170,H)
    add(f'<path d="M{x:.1f} {y:.1f}q8-3 {random.uniform(12,36):.1f} -2" stroke="{random.choice(["#fff0b5","#dfaa5c","#f7cb78"])}" stroke-opacity=".32" stroke-width="{random.uniform(.5,1.8):.1f}" fill="none"/>')
for lon,lat,z in [(25.3,23.2,1.4),(25.6,23.4,1),(26.6,27.9,.7),(27.4,29.5,.75),(28.1,26.7,.65),(25.0,26.1,.85)]:
    x,y=xy(lon,lat);use('plateau',x,y,z)
end()
begin('eastern-desert-and-sinai','clip-path="url(#land-clip)"')
mounts=[]
for i in range(160):
    lat=random.uniform(22,29.7); lon=32.1+(29.7-lat)*.40+random.uniform(-.18,.5)
    x,y=xy(lon,lat)
    if is_land(x,y): mounts.append((x,y,random.uniform(.48,1.1)))
for i in range(65):
    lon=random.uniform(33.05,34.5);lat=random.uniform(27.9,30.1);x,y=xy(lon,lat)
    if is_land(x,y):mounts.append((x,y,random.uniform(.52,1.2)))
for i in range(36):
    x,y=xy(random.uniform(35,36.8),random.uniform(27.2,32.8))
    if is_land(x,y):mounts.append((x,y,random.uniform(.7,1.4)))
for i,(x,y,z) in enumerate(sorted(mounts,key=lambda p:p[1])): use('ridge-'+str(i%4),x,y,z)
end()
delta_geo=[(31.15,30.05),(30.65,30.45),(30.25,30.83),(29.98,31.15),(30.36,31.46),(30.9,31.58),(31.4,31.5),(31.9,31.52),(32.15,31.26),(31.96,30.87),(31.6,30.5)]
delta=project(delta_geo); delta_d=path(delta,True)
add(f'<defs><clipPath id="delta-clip"><path d="{delta_d}"/></clipPath></defs>')
begin('nile-valley-and-delta')
add(f'<path d="{nile_d}" stroke="#e1ca71" stroke-width="37" fill="none" stroke-linecap="round"/><path d="{nile_d}" stroke="url(#green)" stroke-width="29" fill="none" stroke-linecap="round"/>')
add(f'<path id="delta-fields" d="{delta_d}" fill="url(#fields)" stroke="#95ad54" stroke-width="2"/>')
for i in range(42):
    x=random.uniform(890,1210);y=random.uniform(125,285)
    add(f'<path d="M{x:.1f} {y:.1f}q25 8 42-3" stroke="#cbd28c" stroke-width="1.5" fill="none" clip-path="url(#delta-clip)"/>')
add(f'<path id="nile-river" d="{nile_d}" stroke="#208f9f" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="{nile_d}" stroke="#36c4ce" stroke-width="7" fill="none" stroke-linecap="round"/>')
# Secondary Delta distributary is an explicitly generalized illustration.
branch=project([(31.15,30.15),(31.12,30.5),(31.28,30.85),(31.35,31.09),(31.54,31.35),(31.82,31.5)])
add(f'<path id="damietta-distributary-generalized" d="{path(branch)}" fill="none" stroke="#26a7b2" stroke-width="5"/>')
for name,p in lakes: add(f'<path d="{path(p,True)}" fill="#23abb9" stroke="#7ed2bc" stroke-width="1.5"/>')
end()
begin('riverbank-groves-and-villages')
bank=[]
for line in nile:
    for a,b in zip(line,line[1:]):
        length=math.dist(a,b)
        for j in range(max(1,int(length/7))):
            t=j/max(1,int(length/7));x=a[0]+(b[0]-a[0])*t;y=a[1]+(b[1]-a[1])*t
            if not 10<y<H-10:continue
            dx,dy=b[0]-a[0],b[1]-a[1];den=max(length,1)
            side=random.choice([-1,1]);off=random.uniform(12,23)
            xx,yy=x-dy/den*off*side,y+dx/den*off*side
            bank.append((xx,yy,random.choice(['palm','palm','tree','house']),random.uniform(.35,.62)))
for i in range(230):
    x=random.uniform(890,1240);y=random.uniform(120,285)
    if inside(x,y,delta):bank.append((x,y,random.choice(['tree','tree','house','palm']),random.uniform(.3,.5)))
for x,y,n,z in sorted(bank,key=lambda p:p[1]):use(n,x,y,z)
end()

destinations=[]
places=read('ne_10m_populated_places')
def anchor(id,lon,lat,description,verified=None,kind='destination'):
    x,y=xy(lon,lat)
    destinations.append({'id':id,'description':description,'kind':kind,'svg':{'x':round(x,2),'y':round(y,2)},'geographic':{'longitude':lon,'latitude':lat,'status':'source-verified city center' if verified else 'approximate editorial location; not surveyed','source':verified},'landmarkGroupId':f'landmark-{id}'})
    return x,y
def city(id,query,lon,lat,description):
    for f in places:
        p=f['properties']
        if p.get('NAME')==query and p.get('ADM0NAME')=='Egypt':
            lon,lat=f['geometry']['coordinates'][:2]
            return anchor(id,lon,lat,description,'https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_populated_places.geojson')
    return anchor(id,lon,lat,description)

def temple(x,y,scale=1,variant='colonnade'):
    add(f'<g transform="translate({x:.2f} {y:.2f}) scale({scale})">')
    add('<path d="M-62 8L-21-18 69 2 31 30z" fill="#9b693c" opacity=".2"/><path d="M-64 1L-24-24 62-3 26 21z" fill="#e4ac65" stroke="#ffe0a1" stroke-width="2"/><path d="M-55-4L-22-21 50-5 24 11z" fill="#a97742"/>')
    if variant=='pylon':
        add('<path d="M-46 3l5-58 33 8 2 57zM7 12L6-45l34 8 7 57z" fill="url(#stone)" stroke="#bc8549"/><path d="M-8-34L7-31V12L-6 9z" fill="#66462c"/><path d="M-42-53l32 8M9-42l28 7" stroke="#ffe1a0" stroke-width="4"/>')
        for xx in [-30,23]:
            add(f'<path d="M{xx} -35v24m-6-21h12m-12 9h12m-12 9h12" stroke="#a87340" stroke-width="1.3" fill="none"/>')
    else:
        for yy in [-17,-2,10]:
            for xx in range(-38,40,15):use('column',xx,yy+xx*.22,.88)
        add('<path d="M-47-44L-21-60 53-43 29-27z" fill="#f5cd8c"/><path d="M-47-44L29-27v8L-47-36zM29-27L53-43v8L29-19z" fill="#be854c"/><path d="M-47-44L29-27 53-43" fill="none" stroke="#ffe7b0" stroke-width="2"/>')
    add('<path d="M-30 18l45 10m-50-6l45 10m-50-6l45 10" fill="none" stroke="#ffe1a3" stroke-width="2"/>');end()

begin('oases')
for id,lon,lat,label in [('siwa',25.52,29.20,'Siwa oasis'),('bahariya',28.87,28.35,'Bahariya oasis'),('farafra',27.97,27.06,'Farafra oasis'),('dakhla',29.0,25.5,'Dakhla oasis'),('kharga',30.55,25.44,'Kharga oasis'),('fayoum',30.65,29.31,'Fayoum agricultural basin')]:
    x,y=anchor(id,lon,lat,label);begin('landmark-'+id)
    add(f'<ellipse cx="{x}" cy="{y}" rx="39" ry="13" fill="#a1ad57"/><path d="M{x-28} {y}q15-17 40-6q15 9-7 14q-23 3-33-8" fill="#43b7bb" stroke="#e8d58a" stroke-width="2"/>')
    for j in range(14):
        a=j/14*math.tau;use('palm',x+math.cos(a)*random.uniform(23,42),y+math.sin(a)*random.uniform(10,17),random.uniform(.45,.7))
    for j in range(6):use('house',x+random.uniform(-25,25),y+random.uniform(11,24),.5)
    end()
end()

begin('landmark-clusters')
x,y=city('alexandria','Alexandria',29.9187,31.2001,'Alexandria city and Mediterranean harbor');begin('landmark-alexandria')
for j in range(46):use('house',x+random.uniform(-45,44),y+random.uniform(-9,22),random.uniform(.4,.65))
add(f'<path d="M{x-43} {y-9}l-13-14 43-10 4 9-28 6" fill="none" stroke="#eace94" stroke-width="5"/>')
use('felucca',x-46,y-40,.65);end()
x,y=city('cairo','Cairo',31.2357,30.0444,'Greater Cairo; anchor refers to city center');begin('landmark-cairo')
for j in range(65):use('house',x+random.uniform(0,65),y+random.uniform(-24,26),random.uniform(.35,.65))
add(f'<path d="M{x+27} {y-22}v-35m-4 8h8m-6-10l2-8 2 8" stroke="#b4824a" stroke-width="3" fill="#efd192"/>');end()
x,y=anchor('giza',31.1342,29.9792,'Giza pyramid complex; enlarged architectural vignette',kind='attraction');begin('landmark-giza')
use('pyramid',x-68,y-17,.83);use('pyramid',x-129,y+9,.67);use('pyramid',x-12,y+14,.52)
for j in range(3):use('pyramid',x-132+j*17,y+32,.16)
use('sphinx',x-36,y+43,.82)
for j in range(8):use('palm',x-165+j*25,y+48,.5)
end()
x,y=city('luxor','Luxor',32.6396,25.6872,'Luxor city; Luxor Temple is artistically enlarged on east bank');begin('landmark-luxor');temple(x+24,y+15,.75,'pylon');end()
x,y=anchor('karnak',32.6573,25.7188,'Karnak temple complex; architectural footprint exaggerated',kind='attraction');begin('landmark-karnak');temple(x+61,y-45,.9);use('obelisk',x+105,y-34,.9);end()
x,y=anchor('valley-of-the-kings',32.6014,25.7402,'Valley of the Kings on the west bank',kind='attraction');begin('landmark-valley-of-the-kings')
use('mountain',x-64,y-20,.8)
for j in range(3):
    add(f'<path d="M{x-85+j*12} {y-15+j*4}v-8h6v9" stroke="#d29a5b" stroke-width="3" fill="#765036"/>')
end()
x,y=anchor('edfu',32.873,24.978,'Edfu, Temple of Horus',kind='attraction');begin('landmark-edfu');temple(x-35,y+4,.63,'pylon');end()
x,y=anchor('kom-ombo',32.928,24.452,'Kom Ombo double temple on east bank',kind='attraction');begin('landmark-kom-ombo');temple(x+32,y,.58);end()
x,y=city('aswan','Aswan',32.8998,24.0889,'Aswan, granite islands and Nubian riverside settlements');begin('landmark-aswan')
for j in range(18):use('nubian-house',x+random.uniform(15,65),y+random.uniform(-5,35),random.uniform(.5,.8))
for j in range(6):
    xx=x+random.uniform(-15,3);yy=y+random.uniform(-20,35)
    add(f'<ellipse cx="{xx}" cy="{yy}" rx="6" ry="3" fill="#cfb26b"/>');use('palm',xx,yy,.45)
end()
x,y=anchor('philae',32.884,24.025,'Philae temple, island south of Aswan',kind='attraction');begin('landmark-philae');temple(x-33,y+30,.48);end()
x,y=anchor('abu-simbel',31.6258,22.3372,'Abu Simbel rock-cut temples on the west bank of Lake Nasser',kind='attraction');begin('landmark-abu-simbel')
add(f'<g transform="translate({x-45:.2f} {y:.2f})"><path d="M-70 17L-62-28-40-65 13-73 53-43 68 12 39 31z" fill="url(#rock-light)"/><path d="M-44 12L-37-48 31-43 39 22z" fill="url(#stone)" stroke="#f8d594" stroke-width="3"/><path d="M-8 16v-35H7v38z" fill="#5a402e"/><path d="M-37-43L30-38m-64 1l64 5" stroke="#9b673b" stroke-width="2"/>')
for xx in [-27,-14,17,30]:
    add(f'<g transform="translate({xx} 0)"><path d="M-6 12l1-25 3-6h7l3 8 1 24z" fill="#b77d45"/><ellipse cx="1" cy="-25" rx="5" ry="7" fill="#f2c485"/><path d="M-4-19L-7-4-4 3 0-10 3 3 8 0 5-18z" fill="#e5b271"/><path d="M-5 4h5v11h-7M2 4h6v12H2" fill="#f0c17e"/><path d="M-2-26h2m2 0h2" stroke="#79522e" stroke-width=".8"/></g>')
add('<path d="M-42 20l84 9m-88-4l84 9m-88-4l84 9" stroke="#f7d596" fill="none" stroke-width="3"/></g>');end()

for id,query,lon,lat,label in [('hurghada','Al Ghardaqah',33.81,27.26,'Hurghada coastal resort and reef waters'),('marsa-alam','Marsa Alam',34.9,25.067,'Marsa Alam Red Sea coast'),('sharm-el-sheikh','Sharm ash Shaykh',34.33,27.91,'Sharm el Sheikh at the southern tip of Sinai'),('dahab','Dahab',34.513,28.493,'Dahab on the Gulf of Aqaba'),('suez','Suez',32.55,29.97,'Suez at the head of the Gulf of Suez')]:
    x,y=city(id,query,lon,lat,label);begin('landmark-'+id)
    for j in range(14):use('house',x+random.uniform(-22,6),y+random.uniform(-6,20),random.uniform(.38,.6))
    for j in range(5):use('palm',x-18+j*9,y+22,.5)
    end()
x,y=anchor('saint-catherine',33.975,28.556,'Saint Catherine monastery in southern Sinai',kind='attraction');begin('landmark-saint-catherine')
for j in range(5):use('house',x-10+j*7,y+random.uniform(-5,5),.6)
add(f'<path d="M{x-18} {y}l26 8 13-10v12l-13 8-26-8z" fill="#cb985e" stroke="#f3d399" stroke-width="2"/>');end();end()

begin('marine-details')
for lon,lat,z in [(28.7,31.8,.9),(30.4,32.1,.75),(32.1,31.9,.7),(34.5,27.5,.8),(35.1,26.2,1),(35.9,24.5,.8),(31.12,29.3,.6),(30.82,28.2,.65),(31.4,27.25,.6),(32.85,24.8,.6),(32.7,23.7,.65)]:
    x,y=xy(lon,lat)
    if lat<31 and lon<33:
        x,y=min((p for line in nile for p in line),key=lambda p:math.dist(p,(x,y)))
    use('felucca',x,y,z)
for i in range(95):
    lat=random.uniform(22.6,27.7);lon=34.02+(27.7-lat)*.43+random.uniform(.06,.3);x,y=xy(lon,lat)
    if not is_land(x,y):
        add(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="{random.uniform(3,11):.1f}" ry="{random.uniform(2,5):.1f}" fill="#7ad7bd" opacity=".6"/>')
        if i%3==0:add(f'<ellipse cx="{x:.1f}" cy="{y:.1f}" rx="4" ry="2" fill="#f6d992"/>')
end()
add('</svg>')
svg='\n'.join(s)
(ROOT/'egypt-tourism.svg').write_text(svg,encoding='utf-8')
data={'version':1,'viewBox':[0,0,W,H],'orientation':'north-up','projection':{'name':'affine equirectangular illustration','longitudeBounds':[WEST,EAST],'latitudeBounds':[SOUTH,NORTH],'forward':{'x':'(longitude - 24.0) / 12.8 * 1920','y':'(32.8 - latitude) / 11.1 * 1120'},'inverse':{'longitude':'24.0 + x / 1920 * 12.8','latitude':'32.8 - y / 1120 * 11.1'},'warning':'Unequal axis scale is intentional for panorama. Not distance preserving. Shorelines/rivers generalized at 1:50m; monument footprints are exaggerated. Anchors are geographic reference points, not the visual centroid of enlarged illustrations.'},'destinations':destinations}
(ROOT/'destinations.json').write_text(json.dumps(data,indent=2),encoding='utf-8')
root=ET.fromstring(svg);ids=[e.get('id') for e in root.iter() if e.get('id')]
assert len(ids)==len(set(ids)),'duplicate IDs'
assert not any(e.tag.split('}')[-1] in ['image','script','foreignObject','text'] for e in root.iter())
for e in root.iter():
    ref=e.get('{http://www.w3.org/1999/xlink}href')
    if ref:assert ref[1:] in ids
for d in destinations:
    assert d['landmarkGroupId'] in ids
    assert 0<=d['svg']['x']<=W and 0<=d['svg']['y']<=H
report={'svgBytes':len(svg.encode()),'elementCount':sum(1 for e in root.iter()),'uniqueIDs':len(ids),'destinationCount':len(destinations),'rasterElements':0,'scripts':0,'filters':0,'checks':'XML, unique IDs, local symbol references, anchor bounds and group references passed'}
(ROOT/'validation.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(json.dumps(report))
sys.path.insert(0,str(ROOT/'.render-deps'))
try:
    import resvg_py
    (ROOT/'preview.png').write_bytes(resvg_py.svg_to_bytes(svg_string=svg,width=W,height=H))
    print('Rendered preview.png')
except ImportError: print('Preview skipped: install resvg-py to render.')
