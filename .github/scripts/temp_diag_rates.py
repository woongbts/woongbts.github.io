from pathlib import Path

for path in ['assets/rates.min.js','assets/rates.css','rates.html']:
    s=Path(path).read_text(encoding='utf-8')
    print('\n===== ',path,' =====')
    terms=['purpose-category','data-purpose-category','purpose-results','value','Jump5','A37','퀀텀7','overflow','plan-picker-backdrop','mvno-plan-picker-backdrop','style.overflow','document.body','touchmove']
    for term in terms:
        print(f'\n--- TERM {term!r} ---')
        start=0
        count=0
        while True:
            i=s.find(term,start)
            if i<0: break
            count+=1
            a=max(0,i-700); b=min(len(s),i+1400)
            print(s[a:b].replace('\n','\\n'))
            print('\n[END SNIP]')
            start=i+len(term)
            if count>=6: break
        print('COUNT_SHOWN',count)
