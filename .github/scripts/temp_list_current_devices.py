import json, urllib.parse, urllib.request
ROOT='https://www.xeronote.co.kr'
REF=ROOT+'/consult/mobile.php'
UA='Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/140 Safari/537.36'
for api_carrier,label in [('SKT','SKT'),('KT','KT'),('LGUPLUS','LGU+')]:
    params={'telecom_id':api_carrier,'manufacturer_id':'','sort_type1':'PHONE','sort_type2':'RELEASE_DT_DESC','keyword':'','search_group':'','search_support_mnp':''}
    url=ROOT+'/api/data/get_device_list.php?'+urllib.parse.urlencode(params)
    req=urllib.request.Request(url,headers={'User-Agent':UA,'Accept':'application/json,text/plain,*/*','Referer':REF})
    with urllib.request.urlopen(req,timeout=35) as r:
        data=json.loads(r.read().decode('utf-8-sig')).get('data') or []
    print('\n###',label,'count',len(data))
    shown=0
    for idx,d in enumerate(data,1):
        if str(d.get('join_yn','')).upper()=='N' or str(d.get('except_yn','')).upper()=='Y':
            continue
        print(json.dumps({'order':idx,'device_idx':d.get('device_idx'),'model_name':d.get('model_name'),'device_name':d.get('device_name'),'manufacturer':d.get('manufacturer_name'),'release_dt':d.get('release_dt'),'factory_price':d.get('factory_price'),'announce_dt':d.get('announce_dt')},ensure_ascii=False))
        shown+=1
        if shown>=45: break
