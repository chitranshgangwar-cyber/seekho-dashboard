#!/usr/bin/env python3
"""Pull fresh source data at build time, so no CSV is exported by hand.
 - Creative Analytics + Creative Dashboard 2  -> from Redash
 - Raw Data (Campaign Type)                    -> from a published Google Sheet CSV (updates daily)
"""
import os, time, requests

os.makedirs("data", exist_ok=True)

# ---- 1) Redash: Creative Analytics + Creative Dashboard 2 ----
BASE = os.environ["REDASH_BASE_URL"].rstrip("/")
KEY  = os.environ["REDASH_API_KEY"]
REDASH = {
    "Creative_Analytics.csv":   os.environ["Q_CREATIVE_ANALYTICS"],
    "Creative_Dashboard_2.csv": os.environ["Q_CREATIVE_DASHBOARD2"],
}
S = requests.Session(); S.params = {"api_key": KEY}

def redash_csv(qid):
    r = S.post(f"{BASE}/api/queries/{qid}/refresh"); r.raise_for_status()
    jid = r.json()["job"]["id"]
    for _ in range(240):                       # up to ~20 min
        job = S.get(f"{BASE}/api/jobs/{jid}").json()["job"]
        if job["status"] in (3, 4): break
        time.sleep(5)
    if job["status"] != 3:
        raise RuntimeError(f"Redash query {qid} failed: {job.get('error')}")
    c = S.get(f"{BASE}/api/query_results/{job['query_result_id']}.csv"); c.raise_for_status()
    return c.content

for fn, qid in REDASH.items():
    print(f"  Redash: {fn} (query {qid}) ...", flush=True)
    open(f"data/{fn}", "wb").write(redash_csv(qid))
    print(f"    saved {fn} ({os.path.getsize('data/'+fn)/1e6:.1f} MB)")

# ---- 2) Google Sheet (published CSV): Raw Data Campaign Type ----
url = os.environ["NCAD_RAW_URL"]
print("  Sheet: Raw_Data_CampaignType.csv ...", flush=True)
r = requests.get(url, timeout=120, allow_redirects=True); r.raise_for_status()
open("data/Raw_Data_CampaignType.csv", "wb").write(r.content)
print(f"    saved Raw_Data_CampaignType.csv ({os.path.getsize('data/Raw_Data_CampaignType.csv')/1e6:.2f} MB)")
print("data refresh complete.")
