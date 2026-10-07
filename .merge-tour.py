from pathlib import Path
from html.parser import HTMLParser
import re, html, json, hashlib

ROOT=Path('.')
original_bytes=Path('tour-details.html').read_bytes()
old=original_bytes.decode('utf-8').replace('\r\n','\n')
sample=Path(r'C:\Users\Farghally\.codex\attachments\ee517e68-9e57-4766-a0b3-47ad69144259\Pasted text.txt').read_text(encoding='utf-8')
esc=lambda x:html.escape(str(x),quote=True)

class Tree(HTMLParser):
 def __init__(self,source):
  super().__init__(convert_charrefs=False);self.source=source;self.nodes=[];self.stack=[];self.lines=[0]
  for m in re.finditer('\n',source):self.lines.append(m.end())
  self.feed(source)
 def position(self):
  line,col=self.getpos();return self.lines[line-1]+col
 def handle_starttag(self,tag,attrs):
  n={'tag':tag,'a':dict(attrs),'start':self.position(),'openend':self.position()+len(self.get_starttag_text()),'end':None,'parent':self.stack[-1] if self.stack else None}
  self.nodes.append(n)
  if tag in ['img','input','source','link','meta','hr','br','area','wbr','embed','param','track','col','base']:n['end']=n['openend']
  else:self.stack.append(n)
 def handle_startendtag(self,tag,attrs):
  self.handle_starttag(tag,attrs)
  if self.stack and self.stack[-1] is self.nodes[-1]:self.stack.pop()
  self.nodes[-1]['end']=self.nodes[-1]['openend']
 def handle_endtag(self,tag):
  for i in range(len(self.stack)-1,-1,-1):
   if self.stack[i]['tag']==tag:
    self.stack[i]['close']=self.position();self.stack[i]['end']=self.source.index('>',self.position())+1;self.stack=self.stack[:i];break
 def find(self,id=None,cls=None,tag=None):
  return next(n for n in self.nodes if (id is None or n['a'].get('id')==id) and (cls is None or cls in n['a'].get('class','').split()) and (tag is None or n['tag']==tag))
 def all(self,cls=None,tag=None):return [n for n in self.nodes if (cls is None or cls in n['a'].get('class','').split()) and (tag is None or n['tag']==tag)]
 def raw(self,n):return self.source[n['start']:n['end']]
 def inner(self,n):return self.source[n['openend']:n.get('close',n['end'])]

def text(x):return html.unescape(re.sub('<[^>]+>','',x)).strip()
def extract(source,id=None,cls=None,tag=None,inner=False):
 t=Tree(source);n=t.find(id,cls,tag);return t.inner(n) if inner else t.raw(n)
def replace_node(source,new,id=None,cls=None,tag=None):
 t=Tree(source);n=t.find(id,cls,tag);return source[:n['start']]+new+source[n['end']:]
def img_title(source):
 def fix(m):
  tag=m[0]
  if 'title=' not in tag:
   alt=re.search(r'alt="([^"]*)"',tag);tag=tag[:-1]+' title="'+(alt[1] if alt else 'Egypt tour')+'">'
  return tag
 return re.sub(r'<img\b[^>]*>',fix,source)

active=re.sub(r'<!--[\s\S]*?-->','',old)
ot=Tree(active)
title=text(extract(active,tag='h1'))
overview=extract(extract(active,id='trip-overview'),cls='truncate-content',inner=True)
highlights=extract(extract(active,id='highlights'),tag='ul',inner=True)
included=extract(extract(active,id='whats-included'),cls='yes')
excluded=extract(extract(active,id='whats-included'),cls='no')
days=[]
coords=[('Cairo',31.2357,30.0444),('Giza',31.1342,29.9792),('Cairo',31.2357,30.0444),('Aswan',32.8998,24.0889),('Edfu',32.8731,24.9785),('Luxor',32.6396,25.6872),('Luxor',32.6396,25.6872),('Hurghada',33.8116,27.2579)]
for i,n in enumerate(ot.all(cls='itin-day')):
 raw=ot.raw(n);it=Tree(raw);im=it.find(tag='img')['a'];name,lon,lat=coords[i]
 days.append({'title':text(extract(raw,cls='itin-day__title')),'body':extract(raw,cls='itin-day__description',inner=True),'image':im['src'],'alt':im['alt'],'city':name,'lon':lon,'lat':lat})
assert len(days)==8
faq=[]
for n in Tree(extract(active,id='faq')).all(cls='faq-item'):
 raw=Tree(extract(active,id='faq')).raw(n)
 faq.append((text(extract(raw,cls='faq-item__q')),extract(raw,cls='faq-item__answer',inner=True)))

main=sample[sample.index('<body>')+6:sample.index('<footer>')]+extract(sample,id='bookbar')
main=main.replace('Nile Journey: Alexandria to Abu Simbel in 5 days',esc(title)).replace('Nile Journey</li>','8-Day Nile River Cruise</li>')
main=main.replace('A private tour from the Mediterranean to Lake Nasser, with an Egyptologist at every stop and time to enjoy each place.','Explore Cairo, cruise the Nile between Aswan and Luxor, and unwind on Hurghada’s Red Sea beaches.')
main=main.replace('href="#">Home','href="index.html">Home').replace('href="#">Egypt tours','href="category.html">Egypt tours')
main=main.replace('Private tour &middot; per person','Nile River Cruise &middot; per person').replace('5 days from','8 days from').replace('$990','$850')
heroimg=days[1]['image']
main=replace_node(main,'<img class="hero-img" src="'+esc(heroimg)+'" alt="Giza Pyramids on the 8-day Egypt tour" title="Giza Pyramids" width="1600" height="900" fetchpriority="high">',cls='hero-img')
main=replace_node(main,'',cls='hero-video')
routepath='assets/images/tours/nile-cruise-route.svg'
main=replace_node(main,'<a class="qbox-map" href="#itinerary"><img src="'+routepath+'" alt="Route overview: Cairo, Aswan, Luxor and Hurghada" title="Eight-day route overview" width="680" height="400"><span class="qbox-map-l">View itinerary</span></a>',cls='qbox-map')
qi=[('clock','Duration','8 days'),('pin','Cities','Cairo, Aswan, Luxor, Hurghada'),('route','Transportation','Air-conditioned transfers and domestic flights'),('shield','Tour type','Cultural Tour with Nile Cruise'),('globe','Guide languages','English, French, German, Spanish, Italian')]
qhtml=''.join('<div class="qi-i"><svg class="ic" aria-hidden="true"><use href="#i-'+icon+'"/></svg><div><span>'+label+'</span><b>'+value+'</b></div></div>' for icon,label,value in qi)
qhtml+='<div class="qi-i"><svg class="ic" aria-hidden="true"><use href="#i-compass"/></svg><div><span>Distance from you</span><b id="qdv" aria-live="polite"><button type="button" class="lnk">Show how far</button></b></div></div>'
main=replace_node(main,'<section class="qi" aria-label="Quick info"><div>'+qhtml+'</div></section>',cls='qi')
pars=re.findall(r'<p>[\s\S]*?</p>',overview)
overviewhtml=''.join(pars[:2])+'<details class="tour-more"><summary><span class="when-closed">Show more</span><span class="when-open">Show less</span></summary>'+''.join(pars[2:])+'</details>'
main=replace_node(main,'<section class="wrap two" id="trip-overview"><div><h2>Trip Overview</h2>'+overviewhtml+'</div><aside class="hl" id="highlights"><h3>Highlights</h3><ul class="ck">'+highlights+'</ul></aside></section>',cls='two',tag='section')

# Keep all photo and video entries from the old gallery, with a local route image.
gallery=[]
gt=Tree(extract(active,id='lightgallery'))
for i,n in enumerate(gt.all(tag='a')):
 a=n['a'];url=a['href'];caption=a.get('data-sub-html','Egypt tour');attrs='';thumb=a.get('data-thumb',heroimg)
 if '.mp4' in url:
  attrs=' data-video="'+esc(json.dumps({'source':[{'src':url,'type':'video/mp4'}],'attributes':{'controls':True,'preload':'none'}}))+'" data-poster="'+heroimg+'"'
 elif 'youtube.com' in url:attrs=' data-src="'+esc(url)+'"';thumb=heroimg
 gallery.append('<a href="'+esc(url)+'"'+attrs+' data-sub-html="'+esc(caption)+'"><img src="'+esc(thumb)+'" alt="'+esc(caption)+'" title="'+esc(caption)+'" loading="lazy" width="600" height="400">'+('<span class="gallery-label">Play video</span>' if i<2 else '')+'</a>')
gallery.insert(0,'<a href="'+routepath+'" data-sub-html="Eight-day route overview"><img src="'+routepath+'" alt="Cairo, Aswan, Luxor and Hurghada route map" title="Tour route map" width="680" height="400" loading="lazy"></a>')
main=replace_node(main,'<div class="gal" id="gal">'+''.join(gallery)+'</div>',id='gal')

timeline=''.join('<li><button type="button" data-day="'+str(i)+'"><span class="tl-d">Day '+str(i+1)+'</span><b>'+esc(d['city'])+'</b><small>'+esc(d['title'])+'</small></button></li>' for i,d in enumerate(days))
main=replace_node(main,'<ol class="tl" aria-label="Eight-day itinerary">'+timeline+'</ol>',cls='tl')
main=main.replace('style="--n:5"','style="--n:8"').replace('and the map shows how far you go between cities','and the map follows the route between cities')
scenes=''.join('<div class="scene"><div class="bg" style="background-image:url(\''+esc(d['image'])+'\')"></div><div class="layer dusk"></div><div class="wm" aria-hidden="true">'+esc(d['city'])+'</div></div>' for d in days)
main=replace_node(main,'<div id="scenes">'+scenes+'</div>',id='scenes')
cards=''.join('<article class="card" data-name="'+esc(d['city'])+'" data-lon="'+str(d['lon'])+'" data-lat="'+str(d['lat'])+'"><small>Day '+str(i+1)+' · '+esc(d['city'])+'</small><h3>'+esc(d['title'])+'</h3>'+d['body']+'</article>' for i,d in enumerate(days))
main=replace_node(main,'<div id="cards">'+cards+'</div>',id='cards')
main=replace_node(main,'<nav id="dots" aria-label="Jump to a day">'+''.join('<button type="button" aria-label="Day '+str(i+1)+': '+esc(d['city'])+'" title="Day '+str(i+1)+'"></button>' for i,d in enumerate(days))+'</nav>',id='dots')
detaildays=''.join('<details class="journey-day"'+(' open' if i==0 else '')+'><summary>Day '+str(i+1)+' — '+esc(d['title'])+'</summary><div class="journey-day__body"><img src="'+esc(d['image'])+'" alt="'+esc(d['alt'])+'" title="'+esc(d['alt'])+'" loading="lazy" width="600" height="400">'+d['body']+'</div></details>' for i,d in enumerate(days))
itinerarydetails='<section class="wrap" id="itinerary-details"><div class="journey-heading"><h2>Full itinerary</h2><button type="button" class="btn" id="itineraryToggleAll" aria-expanded="false">Open all days</button></div><div id="itineraryList">'+detaildays+'</div></section>'
main=main.replace('<section class="wrap" id="included">',itinerarydetails+'\n<section class="wrap" id="included">')
ie='<div class="ie" id="whats-included">'+re.sub(r'<ul>','<ul class="ck yes">',included)+re.sub(r'<ul>','<ul class="ck no">',excluded)+'</div>'
main=replace_node(main,ie,cls='ie')
faqhtml=''.join('<details'+(' class="faq-extra" hidden' if i>=4 else '')+'><summary>'+esc(q)+'</summary>'+answer+'</details>' for i,(q,answer) in enumerate(faq))
main=replace_node(main,'<div class="faq" id="tourFaq">'+faqhtml+'</div><button type="button" class="lnk faq-more" aria-controls="tourFaq" aria-expanded="false">Show more</button>',cls='faq')

# Retain the existing pricing table explicitly as Day Tour Pricing; never substitute sample rates.
pricing=extract(active,cls='td-pricing-type')
qt=Tree(extract(main,id='quote'));first=next(n for n in qt.nodes if n['tag']=='div' and n['parent'] and n['parent']['a'].get('class')=='wrap two')
qraw=extract(main,id='quote');qraw=qraw[:first['start']]+'<div id="pricing"><h2>Pricing</h2><p>8-day Nile River Cruise from <strong>$850 per person</strong>.</p>'+pricing+'</div>'+qraw[first['end']:]
main=replace_node(main,qraw,id='quote')
form=extract(main,id='bf')
form=re.sub(r'<form\b[^>]*>','<form id="bf" action="thank-you.html" method="get" novalidate>',form,1)
form=form.replace('value="5-day Nile Journey"','value="8-day Nile River Cruise"')
form=re.sub(r'<input[^>]*name="tour"[^>]*>','<input type="hidden" name="tour" value="8-day Nile River Cruise">',form)
form=form.replace('<p id="ok" role="status"></p>','<p class="note f">Preview form: no request is sent from this static page.</p><p id="ok" role="status"></p>')
main=replace_node(main,form,id='bf')

# Existing related blogs carry over into the new cards without making up dates or authors.
blogs=[]
bt=Tree(extract(active,id='related-blogs'))
for n in bt.all(cls='related-blog-card'):
 raw=bt.raw(n);t=Tree(raw);im=t.find(tag='img')['a'];label=text(extract(raw,tag='h4'));category=text(extract(raw,cls='related-blog-card__date'))
 blogs.append('<article class="blog"><a class="blog-img" href="blog-details.html"><img src="'+esc(im['src'])+'" alt="'+esc(im.get('alt',label))+'" title="'+esc(label)+'" loading="lazy" width="600" height="400"></a><div class="blog-b"><span class="blog-c">'+esc(category)+'</span><h3><a href="blog-details.html">'+esc(label)+'</a></h3><p class="blog-metadata">Travel journal · Publication details in article</p><a class="blog-more" href="blog-details.html">Read more →</a></div></article>')
main=replace_node(main,'<section class="wrap" id="blogs"><h2 id="related-blogs">Related blogs</h2><div class="blogs">'+''.join(blogs)+'</div></section>',id='blogs')

# Restore missing original sections (including its commented Good to Know content).
good=extract(old,id='good-to-know') if False else re.search(r'<!-- (<div class="tour-block" id="good-to-know">[\s\S]*?) -->',old)[1]
goodgrid=extract(good,cls='goodtoknow-grid')
location=extract(active,cls='location-map-card')
extras='<section class="wrap" id="good-to-know"><h2>Good to Know</h2>'+goodgrid+'</section><section class="wrap" id="tour-location"><h2>Tour Location</h2>'+location+'</section>'
main=main.replace('<section class="wrap" id="faq">',extras+'\n<section class="wrap" id="faq">')
related=extract(active,cls='related-trips')
related=related.replace('class="related-trips mx-auto"','class="related-trips wrap"')
main+=related
pdf=extract(active,id='downloadPdfBtn')
if not Path('assets/docs/nile-river-cruise-8-days.pdf').is_file():
 pdf='<button class="btn tour-print" type="button">Download / print itinerary</button>'
badges=extract(active,cls='tour-badges')
main=main.replace('<section class="qi"','<div class="wrap tour-extras">'+badges+pdf+'</div><section class="qi"')
nav='<nav class="journey-nav" aria-label="Tour sections">'+''.join('<a href="#'+id+'">'+label+'</a>' for id,label in [('trip-overview','Overview'),('gallery','Gallery'),('itinerary','Itinerary'),('included','Included'),('good-to-know','Good to Know'),('faq','FAQ'),('quote','Pricing & booking'),('blogs','Blogs')])+'</nav>'
main=main.replace('<section class="wrap two"',nav+'<section class="wrap two"',1)
main=img_title(main)
main='<main class="tour-experience" id="tour-content">'+main+'</main>'

# Scope demo styling so header/footer and unrelated pages retain their existing styles.
css=re.search(r'<style>([\s\S]*?)</style>',sample)[1]
css=re.sub(r':root\{[\s\S]*?\}','',css,count=1)
def scope_css(css,scope,filter_related=False):
 css=re.sub(r'/\*[\s\S]*?\*/','',css);out=[];pos=0
 while pos<len(css):
  op=css.find('{',pos)
  if op<0:break
  sel=css[pos:op].strip();depth=1;end=op+1;quote=None
  while depth and end<len(css):
   ch=css[end]
   if quote:
    if ch==quote and css[end-1]!='\\':quote=None
   elif ch in ['"',"'"]:quote=ch
   elif ch=='{':depth+=1
   elif ch=='}':depth-=1
   end+=1
  body=css[op+1:end-1]
  if sel.startswith('@media') or sel.startswith('@supports'):
   nested=scope_css(body,scope,filter_related)
   if nested.strip():out.append(sel+' {\n'+nested+'\n}')
  elif not sel.startswith('@') and sel:
   selectors=sel.split(',')
   if filter_related:selectors=[x for x in selectors if any(k in x for k in ['tour-card-v2','more-trips-grid','related-trips'])]
   selectors=[scope if x.strip() in ['body',':root'] else scope+' '+x.strip() for x in selectors if x.strip() not in ['html']]
   if selectors:out.append(', '.join(selectors)+' {'+body+'}')
  pos=end
 return '\n'.join(out)
css=scope_css(css,'.tour-experience')
css=css.replace('--cta-color-dark','--color-second-dark').replace('--cta-color','--color-second-dark')
for literal,token in {'#061d35':'--main-color-dark','#082844':'--main-color','#e3bd68':'--accent-color-light','#c99b3d':'--accent-color','#fffdfa':'--color-off-white'}.items():css=css.replace(literal,'var('+token+')')
css='.tour-experience { --space: 64px; color-scheme: light; }\n'+css
css+='\n'+scope_css(Path('assets/css/tour-details.css').read_text(encoding='utf-8'),'.tour-experience',True)
Path('assets/css/tour-experience.css').write_text(css,encoding='utf-8')

# Keep original site chrome; archive replaced HTML/JS as a reversible, inert HTML comment.
prefix=old[:old.index('<!-- Start: Breadcrumb -->')]
prefix=prefix.replace('<link rel="stylesheet" href="assets/css/tour-details.css" />','<link rel="stylesheet" href="assets/css/tour-experience.css" />')
prefix=re.sub(r'<script type="application/ld\+json">[\s\S]*?</script>','',prefix)
prefix=prefix.replace('assets/images/blogs/A-wonderful-picture-of-a-tourist-in-front-of-the-pyramids-webp.webp',heroimg)
prefix=prefix.replace('<body>','<body class="tour-details-page">')
prefix=prefix.replace('content="#082844"','content="#153B60"')
suffix=old[old.index('<!-- End: More Trips -->')+len('<!-- End: More Trips -->'):old.index('<script src="https://cdnjs.cloudflare.com/ajax/libs/lightgallery/')]
# Preserve global mobile navigation, but reserve bottom space for the new availability bar.
suffix=suffix.replace('class="mobile-fixed-footer"','class="mobile-fixed-footer tour-mobile-footer"')
suffix=img_title(suffix)
suffix=suffix.replace('onsubmit="return false"','action="thank-you.html" method="get"')
archive=old.replace('<!--','&lt;!--').replace('-->','--&gt;').replace('--!>','--!&gt;')
scripts='''
<script src="https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/lightgallery.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/plugins/thumbnail/lg-thumbnail.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/plugins/zoom/lg-zoom.min.js" defer></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/lightgallery/2.7.2/plugins/video/lg-video.min.js" defer></script>
<script src="assets/js/librairies/flatpickr.min.js" defer></script>
<script src="assets/js/librairies/swiper-bundle.min.js" defer></script>
<script src="assets/js/custom.js" defer></script>
<script src="assets/js/tour-experience.js" defer></script>
'''
final=prefix+main+suffix+scripts+'\n<!-- LEGACY TOUR DETAILS SOURCE — preserved HTML and JavaScript; inactive.\nNested comment delimiters are entity-escaped. Reverse &lt;!-- and --&gt; to restore.\nLEGACY_SOURCE_BEGIN\n'+archive+'\nLEGACY_SOURCE_END\n-->\n</body>\n</html>\n'
Path('tour-details.html').write_text(final,encoding='utf-8',newline='\r\n')

# Adapt the example animation and validation to the existing route and local form behavior.
js=re.findall(r'<script>([\s\S]*?)</script>',sample)[0]
js=js.replace('const $=s=>document.querySelector(s)',"const root=document.querySelector('.tour-experience'); if(!root)return; const $=s=>root.querySelector(s)")
js=js.replace('document.querySelectorAll(', 'root.querySelectorAll(')
js=js.replace('[window.lgZoom,window.lgThumbnail]','[window.lgZoom,window.lgThumbnail,window.lgVideo]')
js=js.replace('const legText=l=>`about ${fmtT(l.min)} by ${l.via}`;',"const legText=l=>'Route overview';")
js=js.replace("$('#ck').textContent=fmtD(leg.km*m);","$('#ck').textContent='Next stop';")
js=js.replace("const DEMO=true;",'')
js=js.replace("const rows=[...root.querySelectorAll('#pt tr')];","const rows=[];")
js=re.sub(r'function tier\(\)\{[^\n]*\}', 'function tier(){}',js)
js=js.replace("const min=new Date(d);min.setDate(min.getDate()+1)","const min=new Date(d);min.setDate(min.getDate()+1)")
js=js.replace('e.setDate(e.getDate()+4)','e.setDate(e.getDate()+7)')
js=js.replace("if(!/^[\\d\\s().-]+$/.test(v))return'Use digits only (spaces and dashes are fine).';","if(!/^\\d+$/.test(v))return'Use digits only.';")
js=js.replace("f.addEventListener('input',e=>{const n=key(e);if(!V[n])return;", "E.phone.addEventListener('input',()=>{E.phone.value=E.phone.value.replace(/\\D/g,'')});\nf.addEventListener('input',e=>{const n=key(e);if(!V[n])return;")
submit=js.index("  const btn=f.querySelector('[type=submit]')") if "  const btn=f.querySelector('[type=submit]')" in js else js.index(" const btn=f.querySelector('[type=submit]')")
js=js[:submit]+" window.location.assign('thank-you.html?type=preview');\n});\n"
# A single namespace avoids collisions with existing scripts and scope stays inside the new main.
Path('assets/js/tour-experience.js').write_text('(function () {\n\"use strict\";\n'+js+'\n})();\n',encoding='utf-8')

# Local map asset replaces the demo's embedded third-party credential.
route='''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 680 400" role="img" aria-labelledby="title desc"><title id="title">Eight-day Egypt tour route</title><desc id="desc">An illustrative route from Cairo to Aswan, along the Nile to Luxor, and on to Hurghada.</desc><rect width="680" height="400" fill="#eef7f6"/><path d="M120 30 510 40 600 340 150 365Z" fill="#e8d8b6" opacity=".55"/><path d="M270 60 330 315 345 225 470 170" fill="none" stroke="#2a9f9d" stroke-width="5" stroke-dasharray="8 7"/><g fill="#153b60" font-family="sans-serif" font-size="23" font-weight="600"><circle cx="270" cy="60" r="9"/><text x="288" y="65">Cairo / Giza</text><circle cx="330" cy="315" r="9"/><text x="350" y="323">Aswan</text><circle cx="345" cy="225" r="9"/><text x="365" y="233">Luxor</text><circle cx="470" cy="170" r="9"/><text x="490" y="177">Hurghada</text></g><text x="24" y="376" fill="#455665" font-family="sans-serif" font-size="14">Route overview · illustration, not to scale</text></svg>'''
Path(routepath).write_text(route,encoding='utf-8')
print('Merged eight-day content into cinematic template; archived original HTML/JS; wrote scoped CSS, JS and local route SVG.')
