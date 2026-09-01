"""One-off backfill: fetch ingredients/benefits from altosindia.net for existing products."""
import asyncio
import os
import re
import html as html_mod

import requests
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"


def strip_tags(s: str) -> str:
    return html_mod.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", s)).strip())


def slugify(name: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", name.lower())).strip("-")


def extract(page: str) -> dict:
    out = {}
    ing = re.search(r"Ingredients\s*</h2>(.*?)</section>", page, re.S | re.I)
    if ing:
        names = re.findall(r"<h5[^>]*product-name[^>]*>(.*?)</h5>", ing.group(1), re.S)
        clean = [strip_tags(n) for n in names]
        joined = ", ".join([c for c in clean if c])[:1000]
        if joined:
            out["ingredients"] = joined
    ben = re.search(r"Benefits\s*</h2>(.*?)(<h2|</section)", page, re.S | re.I)
    if ben:
        text = strip_tags(ben.group(1))[:3000]
        if len(text) > 20:
            out["benefits"] = text
    dos = re.search(r"How\s*To\s*Use\s*</h2>(.*?)(<h2|<div class=\"tab|</section)", page, re.S | re.I)
    if dos:
        text = strip_tags(dos.group(1))[:500]
        if len(text) > 10:
            out["dosage"] = text
    return out


async def main():
    db = AsyncIOMotorClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "test_database")]
    sess = requests.Session()
    sess.headers["User-Agent"] = UA
    updated, skipped, notfound = [], [], []
    async for p in db.products.find({}, {"_id": 0, "id": 1, "name": 1, "ingredients": 1, "benefits": 1, "dosage": 1}):
        if p.get("ingredients") and p.get("benefits"):
            skipped.append(p["name"])
            continue
        slug = slugify(p["name"])
        url = f"https://www.altosindia.net/products/product/{slug}"
        try:
            r = sess.get(url, timeout=20, allow_redirects=True)
            if r.status_code != 200 or "product-title" not in r.text:
                notfound.append(p["name"])
                continue
            data = extract(r.text)
        except Exception:
            notfound.append(p["name"])
            continue
        sets = {"source_url": url}
        if data.get("ingredients") and not p.get("ingredients"):
            sets["ingredients"] = data["ingredients"]
        if data.get("benefits") and not p.get("benefits"):
            sets["benefits"] = data["benefits"]
        if data.get("dosage") and not p.get("dosage"):
            sets["dosage"] = data["dosage"]
        if len(sets) > 1:
            await db.products.update_one({"id": p["id"]}, {"$set": sets})
            updated.append(f"{p['name']} ({', '.join(k for k in sets if k != 'source_url')})")
        else:
            notfound.append(p["name"] + " (page found, no data)")
    print(f"UPDATED ({len(updated)}):")
    for u in updated:
        print("  +", u)
    print(f"ALREADY COMPLETE ({len(skipped)})")
    print(f"NOT FOUND / NO DATA ({len(notfound)}):")
    for n in notfound:
        print("  -", n)


asyncio.run(main())
