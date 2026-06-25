import pandas as pd, numpy as np, re, json, os, datetime
from collections import defaultdict
def norm(x): return re.sub(r'\s+',' ',str(x).strip().lower())
U=os.environ.get("NCAD_DATA_DIR","/mnt/user-data/uploads/")
F_CA =os.environ.get("NCAD_CA", "Creative_Analytics_Dashboard_2026_06_25.csv")
F_CD2=os.environ.get("NCAD_CD2","Creative_Dashboard_2_2026_06_25.csv")
F_RAW=os.environ.get("NCAD_RAW","NCAD_-_Raw_Data__1_.csv")
# Funnel counts (paid/uninstall/cancel) now come from CD2 itself (it carries them at creative x adset x day, and has ad_set for the acquisition filter). No separate funnel query needed.

CAT=[('astrosamadhaan','Astrology'),('astrology','Astrology'),('sharemarket','Share Market'),('biz','Business'),('business','Business'),
     ('horxother','Career (HOR)'),('horxcrisis','Crisis (HOR)'),('hor','Career (HOR)'),('spokenenglish','English'),('eng','English'),
     ('diy','DIY'),('finance','Finance'),('sarkari','Sarkari'),('instagram','Instagram'),('insta','Instagram'),('skinbeauty','Beauty'),
     ('homeparlour','Beauty'),('beauty','Beauty'),('pti','PTI'),('yt','YouTube'),('catalogue','Catalogue'),
     ('weightloss','Health'),('guthealth','Health'),('sexualhealth','Health')]
FMT=[('microdrama','Micro-drama'),('cartooneditxdifferentxtype','Cartoon Edit'),('cartoonedit','Cartoon Edit'),('persepolisxcartoonedit','Cartoon Edit'),
     ('talkingobject','Talking Object'),('testimonial','Testimonial'),('miniature','Miniature'),('classroom','Classroom'),('skit','Skit'),
     ('printeda4','Printed A4'),('interview','Interview'),('vlog','Vlog'),('podcast','Podcast'),('splitscreen','Split Screen'),
     ('bobblehead','Bobblehead'),('asmr','ASMR'),('face2camera','Face to Camera'),('pov','POV'),('wb','Whiteboard'),('animation','Animation')]
def cat(t):
    for k,v in CAT:
        if t.startswith(k): return v
    return 'Other'
def pick(toks,table):
    j='_'.join(toks)
    for k,v in table:
        if k in j: return v
    return 'Other'
def parse(name):
    t=norm(name); toks=t.split('_')
    c=cat(toks[0]); fmt=pick(toks,FMT)
    ai='AI' if re.search(r'(^|_)ai(x|_|$)|aix|veo3|livegen',t) else ('Human' if re.search(r'(^|_)human(_|$)',t) else 'Unknown')
    face='Faceless' if 'faceless' in t else ('Face' if re.search(r'(^|_)face(2camera)?(_|$)',t) else 'Unknown')
    vis='AI Video' if re.search(r'veo3|livegen',t) else ('Cartoon/Edit' if 'cartoon' in t or 'animation' in t else ('Real/Face' if face=='Face' else 'Other'))
    strat='Expansion' if re.search(r'expansion|(^|_)exp(_|$)|rework',t) else ('New' if re.search(r'(^|_)new(script)?(_|$)|crosstest',t) else 'Other')
    hk=(re.search(r'hook[\s_]?(\d)',t) or [None,None]); hook=('Hook '+hk[1]) if hk and hk[1] else 'None'
    return dict(category=c,format=fmt,ai=ai,face=face,visual=vis,strat=strat,hook=hook,script=(toks[1] if len(toks)>1 else '-'))

def kw_stage(c):
    c=str(c).lower()
    if any(k in c for k in ['ctf','testing','test ads']): return 'Testing'
    if any(k in c for k in ['scaling','acquisition','cbo']): return 'Scaling'
    return None
R=pd.read_csv(U+F_RAW,usecols=['campaign','Campaign Type'],low_memory=False)
_CT={'1. scaling':'Scaling','2. ctf':'Testing'}; ctmap={}
for _,r in R.dropna(subset=['Campaign Type']).iterrows():
    k=norm(r['campaign']); ct=norm(r['Campaign Type'])
    if k not in ctmap: ctmap[k]=_CT.get(ct,'DROP' if ct in('3. experiment','4. others') else None)
def stage(c):
    v=ctmap.get(norm(c))
    return v if v in('Scaling','Testing') else (None if v=='DROP' else kw_stage(c))

# ---- exclude NON-ACQUISITION adsets (retargeting + add-to-cart/event-optimized) at the row level,
#      so a creative's spend AND paid count acquisition activity only. NOT creative/format/attribution experiments. ----
EXCL=re.compile(r'retarget|re-?engage|add ?to ?cart|addtocart|event experiment|min_?viewed|viewed ?- ?event|\baeo\b|installers_retarget')
isacq=lambda s: ~s.map(norm).str.contains(EXCL,na=False)

# ---- Creative Analytics (Meta): cost basis + hook/hold + delivery ----
H=pd.read_csv(U+F_CA,usecols=['date','ad_name','adset_name','spend','impressions','clicks','meta_results','plays_3s','thruplay_15s'],low_memory=False)
H['key']=H.ad_name.map(norm)
for c in ['spend','impressions','clicks','meta_results','plays_3s','thruplay_15s']: H[c]=pd.to_numeric(H[c],errors='coerce').fillna(0)
H['date']=pd.to_datetime(H.date,errors='coerce')
_caN=len(H); H=H[isacq(H.adset_name)].copy()   # drop retargeting/add-to-cart/event rows
ca=H.groupby('key').agg(sp=('spend','sum'),im=('impressions','sum'),cl=('clicks','sum'),res=('meta_results','sum'),
    p3=('plays_3s','sum'),tp=('thruplay_15s','sum'),name=('ad_name',lambda s:s.iloc[0]),fd=('date','min')).reset_index()

# ---- CD2: campaign + adset + app + adset_type + creator + FUNNEL counts (FB). Cost is NOT taken from here. ----
C=pd.read_csv(U+F_CD2,usecols=['date_tz','ad_creative','campaign','ad_set','source','app_brand','adset_type','creator','total_cost','D0_paid_users','p0_unin_users','p0_cancel_users','p0_exit_users'],low_memory=False)
C=C[C.source.astype(str).str.lower()=='facebook'].copy(); C['key']=C.ad_creative.map(norm)
for c in ['total_cost','D0_paid_users','p0_unin_users','p0_cancel_users','p0_exit_users']: C[c]=pd.to_numeric(C[c],errors='coerce').fillna(0)
C['d']=pd.to_datetime(C.date_tz,errors='coerce')
Cacq=C[isacq(C.ad_set)]   # acquisition adsets only -> dominant campaign/adset AND funnel counts
dom=lambda col: Cacq.groupby(['key',col]).total_cost.sum().reset_index().sort_values('total_cost').drop_duplicates('key',keep='last').set_index('key')[col]
cd_camp=dom('campaign'); cd_adset=dom('ad_set')
cd_app=C.groupby('key').app_brand.agg(lambda s:s.value_counts().index[0])
cd_adtype=Cacq.groupby('key').adset_type.agg(lambda s:(s.dropna().value_counts().index[0] if s.notna().any() else ''))
cd_creator=C.groupby('key').creator.agg(lambda s:(s.dropna().value_counts().index[0] if s.notna().any() else ''))

# ---- Funnel = CD2 acquisition rows: paid/uninstall/cancellation counts ONLY (cost stays Meta spend from CA) ----
Fn=Cacq[['key','ad_set','d','D0_paid_users','p0_unin_users','p0_cancel_users','p0_exit_users']].copy()
fn=Fn.groupby('key').agg(pd=('D0_paid_users','sum'),nun=('p0_unin_users','sum'),ncx=('p0_cancel_users','sum'),nex=('p0_exit_users','sum')).reset_index()

# ---- assemble: COST = Meta spend (CA); counts = funnel ----
m=ca.merge(fn,on='key',how='inner')
m['camp']=m.key.map(cd_camp).fillna('-'); m['adset']=m.key.map(cd_adset).fillna('-')
m['app']=m.key.map(cd_app).fillna('unknown'); m['adset_type']=m.key.map(cd_adtype).fillna(''); m['creator']=m.key.map(cd_creator).fillna('')
m['st']=m.camp.map(stage)
ttmk=m.key.str.match(r'^seekho(telugu|tamil|malayalam|kannada)')
m=m[(m.app=='seekho')&(m.st.isin(['Scaling','Testing']))&(~ttmk)&(m.sp>=2000)].copy()

# ---- periods (UNION of CA + funnel dates) ----
def addp(df,dcol):
    df['mon']=df[dcol].dt.strftime('%Y-%m'); df['day']=df[dcol].dt.strftime('%Y-%m-%d')
    iso=df[dcol].dt.isocalendar(); df['wk']=iso.year.astype('Int64').astype(str)+'-W'+iso.week.astype('Int64').astype(str).str.zfill(2)
addp(H,'date'); addp(Fn,'d')
alld=pd.concat([H.date,Fn.d]).dropna()
dmin,dmax=alld.min().date(),alld.max().date()
months=sorted(set(H.mon.dropna())|set(Fn.mon.dropna()))
weeks=sorted(x for x in (set(H.wk.dropna())|set(Fn.wk.dropna())) if isinstance(x,str) and 'W' in x)
days=sorted(x for x in (set(H.day.dropna())|set(Fn.day.dropna())) if isinstance(x,str))
MM=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']; MMF=['January','February','March','April','May','June','July','August','September','October','November','December']
def wk_label(k):
    y,w=k.split('-W'); mon=datetime.date.fromisocalendar(int(y),int(w),1); sun=datetime.date.fromisocalendar(int(y),int(w),7)
    lo,hi=max(mon,dmin),min(sun,dmax)
    return f"{lo.day}\u2013{hi.day} {MM[lo.month-1]}" if lo.month==hi.month else f"{lo.day} {MM[lo.month-1]}\u2013{hi.day} {MM[hi.month-1]}"
def mon_label(k): y,mo=k.split('-'); return f"{MMF[int(mo)-1]} {y}"
def day_label(k): dd=datetime.date.fromisoformat(k); return f"{dd.day} {MM[dd.month-1]}"
PERIODS=[{'k':'L','kind':'life','label':'Lifetime'}]+[{'k':x,'kind':'month','label':mon_label(x)} for x in months]+[{'k':x,'kind':'week','label':wk_label(x)} for x in weeks]+[{'k':x,'kind':'day','label':day_label(x)} for x in days]
pidx={p['k']:i for i,p in enumerate(PERIODS)}

# ---- per-period cells PC = [pidx, stc, sp, pd, nun, ncx, im, cl, res, p3, tp] ----
stc_of=m.set_index('key')['st'].map({'Scaling':0,'Testing':1}).to_dict()
keys=set(m.key); Hk=H[H.key.isin(keys)]; Fk=Fn[Fn.key.isin(keys)]
PCd=defaultdict(list)
for r in m.itertuples():
    PCd[r.key].append([0,stc_of[r.key],round(r.sp),int(r.pd),int(r.nun),int(r.ncx),int(r.im),int(r.cl),int(r.res),int(r.p3),int(r.tp)])
for col in ['mon','wk','day']:
    cac=Hk.groupby(['key',col]).agg(sp=('spend','sum'),im=('impressions','sum'),cl=('clicks','sum'),res=('meta_results','sum'),p3=('plays_3s','sum'),tp=('thruplay_15s','sum'))
    fnc=Fk.groupby(['key',col]).agg(pd=('D0_paid_users','sum'),nun=('p0_unin_users','sum'),ncx=('p0_cancel_users','sum'))
    j=cac.join(fnc,how='outer').fillna(0)
    for t in j.itertuples():
        key,pk=t.Index; pi=pidx.get(pk)
        if pi is None or key not in stc_of: continue
        PCd[key].append([pi,stc_of[key],round(t.sp),int(t.pd),int(t.nun),int(t.ncx),int(t.im),int(t.cl),int(t.res),int(t.p3),int(t.tp)])

# ---- intern + records ----
camp_list=[];camp_ix={};adset_list=[];adset_ix={}
def cidx(n):
    if n not in camp_ix: camp_ix[n]=len(camp_list); camp_list.append(n[:80])
    return camp_ix[n]
def aidx(n):
    if n not in adset_ix: adset_ix[n]=len(adset_list); adset_list.append(n[:60])
    return adset_ix[n]
wk=lambda d:('' if pd.isna(d) else f"{d.isocalendar().year}-W{int(d.isocalendar().week):02d}")
recs=[];PC=[]
for r in m.itertuples():
    p=parse(r.name)
    strat=('Expansion' if str(r.adset_type).lower()=='expansion' else ('New' if str(r.adset_type).lower()=='new' else p['strat']))
    recs.append({'n':r.name[:70],'app':r.app,'stage':r.st,'cp':cidx(str(r.camp)),'as':aidx(str(r.adset)),
        'cat':p['category'],'fmt':p['format'],'ai':p['ai'],'face':p['face'],'vis':p['visual'],'strat':strat,'hook':p['hook'],'script':p['script'][:30],'creator':str(r.creator or '')[:24],
        'sp':round(float(r.sp)),'im':int(r.im),'cl':int(r.cl),'res':int(r.res),'p3':int(r.p3),'tp':int(r.tp),
        'fc':round(float(r.sp)),'pd':int(r.pd),'nun':int(r.nun),'ncx':int(r.ncx),'nex':int(r.nex),'fw':wk(r.fd)})
    PC.append(PCd.get(r.key,[]))
FIELDS=["n","app","stage","cp","as","cat","fmt","ai","face","vis","strat","hook","script","creator","sp","im","cl","res","p3","tp","fc","pd","nun","ncx","nex","fw"]
ROWS=[[r[f] for f in FIELDS] for r in recs]
meta={'span':[str(H.date.min().date()),str(H.date.max().date())],'funnel_span':[str(Fn.d.min().date()),str(Fn.d.max().date())],'n':len(recs),'apps':['seekho'],'cost_basis':'meta_spend','scope':'acquisition_only','pulled':str(dmax)}
out=""
for nm,obj in [('F',FIELDS),('ROWS',ROWS),('CAMPS',camp_list),('ADSETS',adset_list),('PC',PC),('PERIODS',PERIODS),('META',meta)]:
    out+="export const %s=%s;\n"%(nm,json.dumps(obj,separators=(',',':')))
open("data_ncad.js","w").write(out)
print("CA rows dropped as non-acquisition (retargeting/add-to-cart/event): %d of %d (%.1f%%)"%(_caN-len(H),_caN,100*(_caN-len(H))/_caN))
print("creatives:",len(recs),"| campaigns:",len(camp_list),"| adsets:",len(adset_list),"| PC cells:",sum(len(x) for x in PC),"| file MB: %.2f"%(os.path.getsize('data_ncad.js')/1e6))
from collections import Counter
print("stage:",dict(Counter(r['stage'] for r in recs)),"| periods:",len(PERIODS),"(L+%dmo+%dwk+%dday)"%(len(months),len(weeks),len(days)))
print("categories:",dict(Counter(r['cat'] for r in recs)))
def W(n,d):
    a=sum(r[n] for r in recs); b=sum(r[d] for r in recs); return a/b if b else 0
print("WEIGHTED overall: spend Rs {:,.0f} | CAC {:.0f} | CPR {:.0f} | hook {:.2f}% | hold {:.2f}% | CTR {:.2f}% | unin {:.2f}% | cancel {:.2f}%".format(
    sum(r['sp'] for r in recs),W('fc','pd'),W('sp','res'),100*W('p3','im'),100*W('tp','im'),100*W('cl','im'),100*W('nun','pd'),100*W('ncx','pd')))
