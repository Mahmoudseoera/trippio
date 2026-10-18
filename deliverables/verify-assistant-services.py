from concurrent.futures import ThreadPoolExecutor
import urllib.request, json
urls = {
'weather':'https://api.open-meteo.com/v1/forecast?latitude=30.0444&longitude=31.2357&current=temperature_2m,weather_code,is_day,wind_speed_10m,precipitation&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&forecast_days=16&timezone=Africa%2FCairo',
'archive':'https://archive-api.open-meteo.com/v1/archive?latitude=30.0444&longitude=31.2357&start_date=2025-08-01&end_date=2025-08-31&daily=temperature_2m_max,temperature_2m_min&timezone=Africa%2FCairo',
'satellite':'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/6/26/37',
'labels':'https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/6/26/37',
'leaflet':'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'}
def check(item):
 name,url=item
 try:
  with urllib.request.urlopen(url,timeout=20) as response:
   body=response.read()
   assert response.status==200
   if name=='weather':
    data=json.loads(body); assert len(data['daily']['time'])==16; assert isinstance(data['current']['temperature_2m'],(int,float)); return (name,'PASS: current data + 16 forecast days')
   if name=='archive':
    data=json.loads(body); assert len(data['daily']['temperature_2m_max'])==31; return (name,'PASS: 31 historical daily temperatures')
   assert len(body)>500
   return (name,'PASS',response.headers.get('Content-Type'),len(body))
 except Exception as error:return (name,'FAIL',str(error))
for result in ThreadPoolExecutor(5).map(check,urls.items()):print(result)
