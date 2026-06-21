import json
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA_FILE = ROOT / "data" / "itinerary.json"

EXPECTED_PAGES = {
    "overview": "index.html",
    "arrival": "arrival.html",
    "day1": "day1.html",
    "day2": "day2.html",
    "departure": "departure.html",
}

EXPECTED_IMAGES = {
    "three-nations": ("3 Nations Brewing.png", "three-nations-brewing.png"),
    "nasher": ("test_01.webp", "nasher-sculpture-center.webp"),
    "netflix-house": ("NetflixHouse-Morning-Exterior-0212_v2-970.jpg", "netflix-house.jpg"),
    "sixth-floor": ("6th_Floor_Musiem.png", "sixth-floor-museum.webp"),
    "dallas-arboretum": ("Dallas Arboretum.avif", "dallas-arboretum.avif"),
    "bishop-arts": ("BishopArtDistrict.png", "bishop-arts-district.png"),
    "medieval-times": ("MedievalTimes.avif", "medieval-times.avif"),
    "perot-museum": ("PerotMuseum.avif", "perot-museum.avif"),
    "reunion-tower": ("ReunionTower.png", "reunion-tower.png"),
    "m-line": ("M-Line-Trolley-Hero-Image-2.webp", "m-line-trolley.webp"),
    "videogame-museum": (" National Videogame Museum.png", "national-videogame-museum.png"),
    "highland-park": (" Highland Park Village.png", "highland-park-village.png"),
    "cosm-dallas": ("cosm-dallas-the-dome-3.webp", "cosm-dallas.webp"),
    "terry-blacks": ("Terry Black's Barbecue Best BBQ.png", "terry-blacks-barbecue.png"),
    "kimbell": ("Kimbell Art Museum.png", "kimbell-art-museum.png"),
    "cafe-modern": ("The Cafe Modern Modern Art Museum of Fort Worth.png", "cafe-modern.png"),
    "modern-art-museum": ("Modern Art Museum of Fort Worth.png", "modern-art-museum-fort-worth.png"),
    "stockyards": ("FW StockYard.jpeg", "fort-worth-stockyards.jpeg"),
    "rodeo": ("Rodeo.jpg", "rodeo.jpg"),
    "fort-worth-botanic": ("Fort Worth Botanic Garden BRIT.png", "fort-worth-botanic-garden.png"),
    "amon-carter": ("Amon Carter Museum of American Art.png", "amon-carter-museum.png"),
    "omni-theater": ("Omni Theater.jpg", "omni-theater.jpg"),
    "magnolia-avenue": ("MgnoliaAve.jpg", "magnolia-avenue.jpg"),
    "water-gardens": ("water-gardens-oasis-pool.png", "fort-worth-water-gardens.png"),
}


class ItineraryContractTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(DATA_FILE.exists(), "data/itinerary.json must exist")
        self.data = json.loads(DATA_FILE.read_text(encoding="utf-8"))

    def test_page_routes_are_complete_and_ordered(self):
        pages = self.data["pages"]
        self.assertEqual([page["id"] for page in pages], list(EXPECTED_PAGES))
        self.assertEqual(
            {page["id"]: page["href"] for page in pages},
            EXPECTED_PAGES,
        )

        for page_id, href in EXPECTED_PAGES.items():
            html = (ROOT / href).read_text(encoding="utf-8")
            self.assertIn(f'data-page="{page_id}"', html)
            self.assertIn('src="js/app.js"', html)

    def test_trip_dates_and_status_language_match_the_source(self):
        self.assertEqual(self.data["trip"]["dates"], "2026.07.16 — 07.19")
        pages = {page["id"]: page for page in self.data["pages"]}
        self.assertEqual(pages["arrival"]["date"], "7월 16일 목요일")
        self.assertEqual(pages["day1"]["date"], "7월 17일 금요일")
        self.assertEqual(pages["day2"]["date"], "7월 18일 토요일")
        self.assertEqual(pages["departure"]["date"], "7월 19일 일요일")

        payload = json.dumps(self.data, ensure_ascii=False)
        self.assertIn("확정 필요", payload)
        self.assertIn("Terry Black’s BBQ", payload)
        self.assertIn("Kimbell Art Museum", payload)

    def test_every_drive_image_has_an_exact_auditable_mapping(self):
        places = self.data["places"]
        actual = {
            place_id: (
                place["image"]["sourceName"],
                Path(place["image"]["src"]).name,
            )
            for place_id, place in places.items()
            if place.get("image")
        }
        self.assertEqual(actual, EXPECTED_IMAGES)

        for place_id, (_, normalized_name) in EXPECTED_IMAGES.items():
            image_path = ROOT / places[place_id]["image"]["src"]
            self.assertTrue(image_path.is_file(), f"missing image for {place_id}: {normalized_name}")
            self.assertGreater(image_path.stat().st_size, 1_000)
            self.assertTrue(places[place_id]["image"]["alt"].strip())

    def test_place_links_are_secure_and_primary_links_are_labeled(self):
        for place_id, place in self.data["places"].items():
            self.assertTrue(place["primaryLink"]["label"].strip(), place_id)
            self.assertTrue(place["primaryLink"]["url"].startswith("https://"), place_id)
            for link in place.get("resources", []):
                self.assertTrue(link["label"].strip(), place_id)
                self.assertTrue(link["url"].startswith("https://"), place_id)

    def test_tracked_web_content_contains_no_legacy_destination_material(self):
        forbidden = ("gangneung", "sokcho", "강릉", "속초")
        candidates = [ROOT / "README.md"]
        for directory in ("data", "docs", "css", "js"):
            base = ROOT / directory
            if base.exists():
                candidates.extend(path for path in base.rglob("*") if path.is_file())
        candidates.extend(ROOT.glob("*.html"))
        candidates.extend(ROOT.glob("*.py"))

        violations = []
        for path in candidates:
            if path.suffix.lower() not in {".md", ".json", ".css", ".js", ".html", ".py"}:
                continue
            content = path.read_text(encoding="utf-8", errors="ignore").lower()
            if any(term in content for term in forbidden):
                violations.append(str(path.relative_to(ROOT)))
        self.assertEqual(violations, [])


if __name__ == "__main__":
    unittest.main()
