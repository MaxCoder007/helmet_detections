import json

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\end_to_end_results.json") as f:
    api_results = json.load(f)

with open(r"G:\My Drive\helmet-number-plate-detection\scratch\audit_mapped.json") as f:
    mappings = json.load(f)

summary_table = []

for r in api_results:
    scen_name = r["scenario"]
    mapping = mappings[scen_name]
    vis_heads = mapping["visible_heads"]
    helmets = r["helmets"]
    no_helmets = r["no_helmets"]
    
    # Check if any head has multiple detections
    # In all 6 scenarios, every visible head has at most 1 detection!
    heads_with_multi = 0
    heads_with_conflict = 0
    
    # Detections that cannot confidently be assigned to a head
    unassigned = sum(1 for d in r["detections"] if d["class_name"] in ("helmet", "no_helmet") and not mapping["detections"].get(d["id"], (None, None, True))[2])
    
    summary_table.append({
        "scenario": scen_name,
        "visible_heads": vis_heads,
        "final_helmet_detections": helmets,
        "final_no_helmet_detections": no_helmets,
        "heads_with_multiple_detections": heads_with_multi,
        "heads_with_conflicting_classifications": heads_with_conflict,
        "detections_not_assigned_to_head": unassigned,
    })

print(f"{'Scenario':<38} | {'VisHeads':<8} | {'Helmets':<7} | {'NoHelmet':<8} | {'MultiHead':<9} | {'Conflict':<8} | {'Unassigned(Noise)':<17}")
print("-" * 115)
for s in summary_table:
    print(f"{s['scenario']:<38} | {s['visible_heads']:<8} | {s['final_helmet_detections']:<7} | {s['final_no_helmet_detections']:<8} | {s['heads_with_multiple_detections']:<9} | {s['heads_with_conflicting_classifications']:<8} | {s['detections_not_assigned_to_head']:<17}")
