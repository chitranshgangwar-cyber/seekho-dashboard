#!/usr/bin/env bash
set -euo pipefail
export NCAD_DATA_DIR="data/"
export NCAD_CA="${NCAD_CA:-Creative_Analytics.csv}"
export NCAD_CD2="${NCAD_CD2:-Creative_Dashboard_2.csv}"
export NCAD_RAW="${NCAD_RAW:-Raw_Data_CampaignType.csv}"
echo "1/4 prep      -> data_ncad.js"; python3 prep_ncad.py
echo "2/4 esbuild   -> bundle_ncad.js"
./node_modules/.bin/esbuild entry_ncad.jsx --bundle --minify --format=iife \
  --outfile=bundle_ncad.js --loader:.jsx=jsx '--define:process.env.NODE_ENV="production"' --legal-comments=none
echo "3/4 tailwind  -> output_ncad.css"
./node_modules/.bin/tailwindcss -i input.css -o output_ncad.css --minify
echo "4/4 assemble  -> dashboard/index.html"; python3 assemble.py
