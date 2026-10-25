import json

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\end_to_end_results.json") as f:
    results = json.load(f)

print(f"{'Scenario':<38} | {'Raw':<4} | {'AfterDup':<8} | {'AfterConf':<9} | {'API':<4} | {'Front':<5} | {'Headwear':<11} | {'Riders':<6} | {'Plates':<6}")
print("-" * 105)
for r in results:
    s = r["scenario"]
    raw = r["raw_yolo_nms"]
    ad = r["after_same_class_dup"]
    ac = r["after_conflict_res"]
    api = r["api_response_count"]
    fr = r["frontend_render_count"]
    hw = f"{r['unique_headwear_count']} ({r['helmets']}H/{r['no_helmets']}NH)"
    rd = r["riders"]
    pl = r["plates"]
    print(f"{s:<38} | {raw:<4} | {ad:<8} | {ac:<9} | {api:<4} | {fr:<5} | {hw:<11} | {rd:<6} | {pl:<6}")
