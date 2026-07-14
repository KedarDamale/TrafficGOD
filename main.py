import pandas as pd
import requests
import json
req_obj = requests.get("https://metamorphosis.youv.ai/api/billing/sales-period?user_map_id=70697&start_date=2026-04-01&end_date=2026-04-30")


print(req_obj.content)

