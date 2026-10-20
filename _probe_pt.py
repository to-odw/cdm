import json
data = json.load(open(r"C:\Users\Taylor\AppData\Local\Temp\gallery1.json", encoding="utf-8"))
min_id = data["minId"]
print("min", min_id, "proportions", data.get("proportions"), "dims", data.get("dims"))
for s in data["scenes"]:
    photos = s.get("photos") or []
    print("\nSCENE", s["nm"], "len", len(photos))
    print("first40", photos[:40])
    if photos:
        print("min", min(photos), "max", max(photos))
# guess stride by looking at small numbers vs large
photos = data["scenes"][1]["photos"]
# values that look like proportion indexes 0-3
small = sum(1 for x in photos if x < 20)
print("day1 small<20", small, "of", len(photos))
