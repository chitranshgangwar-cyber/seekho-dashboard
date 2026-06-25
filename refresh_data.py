#!/usr/bin/env python3
"""Pull the 3 source CSVs fresh from Redash at build time, so no CSV is ever exported by hand.
Env vars (set them in Vercel > Project > Settings > Environment Variables):
  REDASH_BASE_URL  e.g. https://analytics.seekho.in
  REDASH_API_KEY   a Redash user API key
  Q_CREATIVE_ANALYTICS / Q_CREATIVE_DASHBOARD2 / Q_RAW  = the 3 Redash query IDs
"""
import os, time, requests

BASE = os.environ["REDASH_BASE_URL"].rstrip("/")
KEY  = os.environ["REDASH_API_KEY"]
QUERIES = {  # output filename (matches build_dashboard.sh) -> Redash query id
    "Creative_Analytics.csv":      os.environ["Q_CREATIVE_ANALYTICS"],
    "Creative_Dashboard_2.csv":    os.environ["Q_CREATIVE_DASHBOARD2"],
    "Raw_Data_CampaignType.csv":   os.environ["Q_RAW"],
}
os.makedirs("data", exist_ok=True)
S = requests.Session(); S.params = {"api_key": KEY}

def fresh_csv(qid):
    r = S.post(f"{BASE}/api/queries/{qid}/refresh"); r.raise_for_status()
    job = r.json()["job"]; jid = job["id"]
    for _ in range(240):                       # up to ~20 min
        job = S.get(f"{BASE}/api/jobs/{jid}").json()["job"]
        if job["status"] in (3, 4): break
        time.sleep(5)
    if job["status"] != 3:
        raise RuntimeError(f"Redash query {qid} failed: {job.get('error')}")
    rid = job["query_result_id"]
    c = S.get(f"{BASE}/api/query_results/{rid}.csv"); c.raise_for_status()
    return c.content

for fn, qid in QUERIES.items():
    print(f"  pulling {fn}  (query {qid}) ...", flush=True)
    open(f"data/{fn}", "wb").write(fresh_csv(qid))
    print(f"    saved {fn}  ({os.path.getsize('data/'+fn)/1e6:.1f} MB)")
print("data refresh complete.")
