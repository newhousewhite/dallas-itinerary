import json
import re
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
    "about": "about.html",
    "map": "map.html",
    "lunch": "lunch.html",
    "trolley": "trolley.html",
}

EXPECTED_CALENDAR_EVENTS = [
    ("arrival-reception", "달라스 리셉션", "2026-07-16T19:00:00", "2026-07-16T22:00:00"),
    ("day1-breakfast", "호텔 조식", "2026-07-17T06:00:00", "2026-07-17T08:00:00"),
    ("terry-blacks-bbq", "Terry Black’s BBQ", "2026-07-17T19:00:00", "2026-07-17T21:00:00"),
    ("auction-talk", "Auction + 대표님과의 담화", "2026-07-17T21:00:00", "2026-07-17T22:00:00"),
    ("day2-breakfast", "호텔 조식", "2026-07-18T06:00:00", "2026-07-18T08:00:00"),
    ("kimbell-art-museum", "Kimbell Art Museum", "2026-07-18T10:00:00", "2026-07-18T12:00:00"),
    ("cafe-modern-lunch", "점심 · The Café Modern", "2026-07-18T12:00:00", "2026-07-18T14:00:00"),
    ("modern-art-museum", "The Modern Art Museum of Fort Worth", "2026-07-18T14:00:00", "2026-07-18T16:00:00"),
    ("stockyards-free-time", "Stockyards 자유 탐방", "2026-07-18T16:30:00", "2026-07-18T19:30:00"),
    ("cowtown-rodeo", "Rodeo @ Cowtown Coliseum", "2026-07-18T19:30:00", "2026-07-18T20:30:00"),
    ("return-to-hotel", "호텔로 복귀", "2026-07-18T21:00:00", "2026-07-18T22:00:00"),
    ("sans-session", "산스 전체세션 참석", "2026-07-19T07:00:00", "2026-07-19T09:00:00"),
]

EXPECTED_LUNCH_PLACES = [
    ("malai-kitchen", "Malai Kitchen", "업타운", "$25 ~ $40", "3699 McKinney Ave Ste 350, Dallas, TX 75204", "https://maps.app.goo.gl/2UaDwhBLH6jYZJUi6"),
    ("mexican-sugar", "Mexican Sugar", "업타운", "$30 ~ $50", "2355 Olive St #155, Dallas, TX 75201", "https://maps.app.goo.gl/Yg5JSubAqcTMEJMn7"),
    ("katy-trail-ice-house", "Katy Trail Ice House", "업타운(케이티 트레일 옆)", "$15 ~ $30", "3127 Routh St, Dallas, TX 75201", "https://maps.app.goo.gl/5YyCQvM82awbJdtL8"),
    ("shugs-bagels", "Shug's Bagels", "업타운", "$10 ~ $20", "4001 Lemmon Ave, Dallas, TX 75219", "https://maps.app.goo.gl/tGveo12kPM4xAFnb8"),
    ("mister-o1-turtle-creek", "Mister O1 Extraordinary Pizza Turtle Creek", "업타운(터틀 크릭)", "$25 ~ $40", "3838 Oak Lawn Ave P100, Dallas, TX 75219", "https://maps.app.goo.gl/gBPFXVr1NycN6dPi7"),
    ("loro-asian-smokehouse", "Loro Asian Smokehouse & Bar", "업타운(이스트 달라스 인근)", "$25 ~ $40", "1812 N Haskell Ave., Dallas, TX 75204", "https://maps.app.goo.gl/b5CjFoxDoVRpG1gf8"),
    ("san-martin-bakery", "San Martin Bakery and Restaurant", "업타운", "$15 ~ $30", "3120 McKinney Ave, Dallas, TX 75204", "https://maps.app.goo.gl/nvzxzGq1Sqzkmx959"),
    ("torchys-tacos", "Torchy's Tacos", "업타운", "$10 ~ $20", "2305 Cedar Springs Rd Suite 100, Dallas, TX 75201", "https://maps.app.goo.gl/L5sEULA6L7WA7aw8A"),
    ("velvet-taco", "Velvet Taco", "딥엘럼", "$10 ~ $20", "2556 Elm St, Dallas, TX 75226", "https://maps.app.goo.gl/TjYji9h9JnUenxrR9"),
    ("hopdoddy-burger-bar", "Hopdoddy Burger Bar", "업타운", "$15 ~ $30", "3227 McKinney Ave #102, Dallas, TX 75204", "https://maps.app.goo.gl/F81WfPwEwsH4DPjo9"),
    ("cosmic-cafe", "Cosmic Cafe", "업타운(오크로운)", "$15 ~ $25", "2912 Oak Lawn Ave, Dallas, TX 75219", "https://maps.app.goo.gl/CmXAsxAtmpmQcjss7"),
]

EXPECTED_LUNCH_COORDINATES = {
    "malai-kitchen": (32.8086608, -96.796891),
    "mexican-sugar": (32.7912182, -96.8044116),
    "katy-trail-ice-house": (32.8007453, -96.8074712),
    "shugs-bagels": (32.8136125, -96.80816),
    "mister-o1-turtle-creek": (32.8145394, -96.8011281),
    "loro-asian-smokehouse": (32.8011693, -96.7847456),
    "san-martin-bakery": (32.8021821, -96.7999207),
    "torchys-tacos": (32.7954189, -96.8057777),
    "velvet-taco": (32.783816, -96.7867638),
    "hopdoddy-burger-bar": (32.8042444, -96.7997301),
    "cosmic-cafe": (32.8076862, -96.809756),
}

EXPECTED_LUNCH_IMAGES = {
    "malai-kitchen": [("Malai Kitchen1.jpg", "malai-kitchen-1.jpg"), ("Malai Kitchen2.jpg", "malai-kitchen-2.jpg")],
    "mexican-sugar": [("Mexican Sugar1.jpg", "mexican-sugar-1.webp"), ("Mexican Sugar2.jpg", "mexican-sugar-2.webp")],
    "katy-trail-ice-house": [("Katy Trail Ice House1.jpg", "katy-trail-ice-house-1.jpg"), ("Katy Trail Ice House2.jpg", "katy-trail-ice-house-2.jpg")],
    "shugs-bagels": [("Shug's Bagels1.jpg", "shugs-bagels-1.webp"), ("Shug's Bagels2.jpg", "shugs-bagels-2.jpg")],
    "mister-o1-turtle-creek": [("Mister O1 Extraordinary Pizza1.jpg", "mister-o1-turtle-creek-1.jpg"), ("Mister O1 Extraordinary Pizza2.jpg", "mister-o1-turtle-creek-2.jpg")],
    "loro-asian-smokehouse": [("Loro Asian Smokehouse1.jpg", "loro-asian-smokehouse-1.jpg"), ("Loro Asian Smokehouse2.jpg", "loro-asian-smokehouse-2.jpg")],
    "san-martin-bakery": [("San Martin Bakery and Restaurant1.jpg", "san-martin-bakery-1.jpg"), ("San Martin Bakery and Restaurant2.jpg", "san-martin-bakery-2.jpg")],
    "torchys-tacos": [("Torchy's Tacos1.jpg", "torchys-tacos-1.jpg"), ("Torchy's Tacos2.jpg", "torchys-tacos-2.jpg")],
    "velvet-taco": [("Velvet Taco1.jpg", "velvet-taco-1.webp"), ("Velvet Taco2.jpg", "velvet-taco-2.jpg")],
    "hopdoddy-burger-bar": [("Hopdoddy Burger Bar1.jpg", "hopdoddy-burger-bar-1.jpg"), ("Hopdoddy Burger Bar2.jpg", "hopdoddy-burger-bar-2.avif")],
    "cosmic-cafe": [("Cosmic Cafe1.jpg", "cosmic-cafe-1.webp"), ("Cosmic Cafe2.jpg", "cosmic-cafe-2.webp")],
}

EXPECTED_LUNCH_CONTENT = {
    "malai-kitchen": ("고급스러운 태국 요리 전문점. 현대적인 인테리어와 세련된 분위기.", "그린 커리, 똠얌꿍, 팟타이, 베트남 샌드위치 (반미), 신선한 칵테일."),
    "mexican-sugar": ("멕시코 칸쿤의 해변을 연상시키는 활기차고 트렌디한 멕시칸 레스토랑. 넓은 야외 좌석 완비.", "세비체, 파히타, 몰레 닭고기, 다양한 타코 종류, 럼 기반의 칵테일 및 데킬라."),
    "katy-trail-ice-house": ("달라스에서 가장 유명한 야외 비어 가든. 반려견 동반 가능, 활기차고 캐주얼한 분위기. 웨이팅 있을수 있음. 달라스의 젊은 친구들이 케이티 트레일 걷다 많이들 들러 맥주마시는 곳.", "텍사스 BBQ (브리스킷, 소시지), 버거, 텍스-멕스 애피타이저, 다양한 생맥주."),
    "shugs-bagels": ("뉴욕 스타일의 베이글 전문점으로, 쫄깃한 식감의 베이글로 유명함. 원래는 SMU학교 앞에서 시작했으나 유명해지면서 업타운 근처에도 오픈(현재는 오스틴, 뉴올리언스까지 진출) 아침 식사나 브런치로 인기. 주말아침에는 문밖까지 웨이팅 라인이 길 수 있음.", "다양한 베이글, 다양한 크림치즈 스프레드 (딸기, 스칼리온 등), 베이글 샌드위치(Spice Shug’s, Club, 치킨커틀릿 등등 추천). 글루텐프리 베이글 가능(+ $2.00~$2.5)"),
    "mister-o1-turtle-creek": ("마이애미에서 온 유명 피자 체인. 얇은 도우와 독창적인 피자 토핑으로 유명하며, 아늑한 분위기. 이름의 유래가 재미있음. 설립자이자 이탈리아 셰프인 레나토 비올라(Renato Viola)가 미국 마이애미에 진출할 때 발급받은 'O-1 비자'에서 유래. 이 비자는 '예술, 과학, 교육, 비즈니스 등 해당 분야에서 특출한 재능이나 능력(Extraordinary Ability)을 인정받은 사람'에게만 주어지는 비자로, 그의 특별하고 뛰어난 피자를 만들겠다는 철학을 담음", "스타 피자 (Starita, Nebula), 칼라브레제 (Calabrese), 다양한 크러스트 옵션."),
    "loro-asian-smokehouse": ("텍사스 BBQ와 아시아 요리의 퓨전 레스토랑. 'Uchi' 레스토랑(달라스/오스틴의 유명 스시식당) 그룹의 공동 창업주들이 오픈.", "아시안 BBQ 브리스킷, 매운 소시지, 쌀국수 볶음밥, 샐러드, BBQ 소스 치킨."),
    "san-martin-bakery": ("과테말라에서 온 베이커리 & 레스토랑. 아침 식사부터 저녁까지 다양한 메뉴 제공. 주말아침에 가면 가족, 연인, 친구들이 다양하게 즐기는 식당으로 웨이팅이 길수있음", "다양한 빵과 페이스트리, 남아메리카 스타일의 아침 식사 플래터, 샌드위치, 샐러드, 파스타."),
    "torchys-tacos": ("텍사스에서 시작된 인기 타코 체인. 캐주얼하고 빠르며, 창의적인 타코 메뉴로 유명.", "트래쉬 트레일러 (Trashy Trailer), 미스터 오렌지 (Mr. Orange), 퀘소 & 칩스."),
    "velvet-taco": ("텍사스에서 시작된 인기 타코 체인. 캐주얼하고 빠르며, 창의적인 타코 메뉴로 유명.", "스파이시 치킨티카 타코(인도커리 퓨전), 쉬림프 타코 등"),
    "hopdoddy-burger-bar": ("텍사스 기반(오스틴)의 수제 버거 맛집. 신선한 재료와 다양한 버거 조합으로 인기.", "클래식 버거, 아히 참치 버거, 다양한 감자튀김 (트러플, 치즈 등), 셰이크."),
    "cosmic-cafe": ("달라스의 대표적인 채식 및 비건 식당. 독특한 인테리어와 차분한 분위기. 문을 닫았다가 많은 달라스 채식인들의 바램으로 다시 오픈.", "렌틸콩 수프, 채식 커리, 비건 타코, 다양한 스무디 및 차 (Tea)."),
}

EXPECTED_GROUP_ADDRESSES = {
    "nasher": "Nasher: 2001 Flora St, Dallas, TX 75201 · DMA: 1717 N Harwood St, Dallas, TX 75201",
    "netflix-house": "13550 N Dallas Pkwy, Dallas, TX 75240",
    "sixth-floor": "411 Elm St, Dallas, TX 75202",
    "dallas-arboretum": "8525 Garland Rd, Dallas, TX 75218",
    "bishop-arts": "200 N Bishop Ave, Dallas, TX 75208",
    "medieval-times": "2021 N Stemmons Fwy, Dallas, TX 75207",
    "perot-museum": "2201 N Field St, Dallas, TX 75201",
    "reunion-tower": "300 Reunion Blvd E, Dallas, TX 75207",
    "m-line": "Cityplace/Uptown Station · 2711 N Haskell Ave, Dallas, TX 75204",
    "videogame-museum": "8004 Dallas Pkwy, Suite 300, Frisco, TX 75034",
    "highland-park": "47 Highland Park Village, Dallas, TX 75205",
    "cosm-dallas": "5776 Grandscape Blvd, The Colony, TX 75056",
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

    def test_calendar_export_events_are_complete_and_timed(self):
        calendar = self.data["calendar"]
        self.assertEqual(calendar["timezone"], "America/Chicago")
        self.assertEqual(calendar["filename"], "howdy-eight-dallas-fort-worth.ics")
        self.assertEqual(calendar["icsPath"], "calendar/howdy-eight-dallas-fort-worth.ics")
        self.assertEqual(calendar["note"], "종료 시간이 없는 일정은 1시간으로 내보냅니다.")

        actual = [
            (event["id"], event["title"], event["start"], event["end"])
            for event in calendar["events"]
        ]
        self.assertEqual(actual, EXPECTED_CALENDAR_EVENTS)
        self.assertEqual(len(calendar["events"]), 12)

        events = {event["id"]: event for event in calendar["events"]}
        self.assertEqual(events["cowtown-rodeo"]["start"], "2026-07-18T19:30:00")
        self.assertEqual(events["cowtown-rodeo"]["end"], "2026-07-18T20:30:00")
        self.assertEqual(events["return-to-hotel"]["start"], "2026-07-18T21:00:00")
        self.assertEqual(events["return-to-hotel"]["end"], "2026-07-18T22:00:00")

        ics_file = ROOT / calendar["icsPath"]
        self.assertTrue(ics_file.exists())
        ics = ics_file.read_text(encoding="utf-8")
        self.assertEqual(ics.count("BEGIN:VEVENT"), 12)
        self.assertIn("X-WR-TIMEZONE:America/Chicago", ics)
        self.assertIn("DTSTART;TZID=America/Chicago:20260716T190000", ics)
        self.assertIn("DTEND;TZID=America/Chicago:20260718T203000", ics)

        overview = next(page for page in self.data["pages"] if page["id"] == "overview")
        calendar_section = next(section for section in overview["sections"] if section["type"] == "calendarExport")
        self.assertEqual(calendar_section["downloadLabel"], "전체 iCal 다운로드")
        self.assertEqual(calendar_section["googleHeading"], "Google Calendar에 추가")
        self.assertEqual(calendar_section["note"], calendar["note"])

    def test_contact_hotel_transit_and_departure_updates(self):
        pages = {page["id"]: page for page in self.data["pages"]}

        contact = next((section for section in pages["overview"]["sections"] if section["type"] == "contact"), None)
        self.assertIsNotNone(contact, "overview contact section is required")
        self.assertEqual(contact["name"], "민일")
        self.assertEqual(contact["phone"], "+1-814-777-6590")
        self.assertEqual(contact["phoneHref"], "tel:+18147776590")

        arrival = pages["arrival"]
        timeline = next(section for section in arrival["sections"] if section["type"] == "timeline")
        check_in, reception = timeline["items"][:2]
        self.assertNotIn("status", check_in)
        self.assertNotIn("status", reception)
        self.assertEqual(reception["description"], "3 Nations Brewing에서 찐 Tex-Mex를 즐기며 Ice Breaking")

        guide = next((section for section in arrival["sections"] if section["type"] == "arrivalGuide"), None)
        self.assertIsNotNone(guide, "arrival DART guide is required")
        self.assertEqual(guide["hotel"]["name"], "Renaissance Saint Elm Dallas Downtown Hotel")
        self.assertEqual(guide["hotel"]["address"], "1907 Elm Street, Dallas, Texas, USA, 75201")
        self.assertEqual(guide["hotel"]["phone"], "+1 214-220-2900")
        self.assertEqual(
            guide["hotel"]["url"],
            "https://www.marriott.com/en-us/hotels/dalbw-renaissance-saint-elm-dallas-downtown-hotel/overview/",
        )
        self.assertEqual(len(guide["routes"]), 2)
        route_text = json.dumps(guide["routes"], ensure_ascii=False)
        for phrase in (
            "약 1시간",
            "Orange Line",
            "St Paul Station",
            "약 32분",
            "Love Link (Route 55)",
            "Inwood/Love Field",
            "Green Line",
        ):
            self.assertIn(phrase, route_text)

        departure = pages["departure"]
        departure_timeline = next(section for section in departure["sections"] if section["type"] == "timeline")
        departure_items = departure_timeline["items"]
        self.assertEqual(departure_items[0]["time"], "7 — 9 AM")
        self.assertEqual(departure_items[0]["title"], "산스 전체세션 참석")
        self.assertTrue(all("status" not in item for item in departure_items))
        airport = next(item for item in departure_items if item["title"] == "공항 이동 & 귀국")
        self.assertEqual(airport["transport"], "DART 전철")

    def test_sans_theme_dart_link_group_addresses_and_docents(self):
        pages = {page["id"]: page for page in self.data["pages"]}

        sans = next(section for section in pages["overview"]["sections"] if section["type"] == "sansTheme")
        self.assertEqual(sans["heading"], "SANS")
        sans_payload = json.dumps(sans, ensure_ascii=False)
        for phrase in (
            "2026 글로벌 8색조 리트릿의 주제는 바로 SANS 입니다.",
            "Solidarity",
            "연대",
            "Art",
            "예술",
            "Nexus",
            "만나는 중심점: 리트릿",
            "Smoke",
            "텍사스 바베큐",
            "7월의 한 가운데 강렬한 텍사스의 여름에 만날 우리",
            "함께할 평생의 기억을 만들어 보아요",
        ):
            self.assertIn(phrase, sans_payload)

        self.assertEqual(
            sans["letters"],
            [
                {"letter": "S", "term": "Solidarity", "meaning": "연대"},
                {"letter": "A", "term": "Art", "meaning": "예술"},
                {"letter": "N", "term": "Nexus", "meaning": "만나는 중심점: 리트릿"},
                {"letter": "S", "term": "Smoke", "meaning": "텍사스 바베큐"},
            ],
        )

        self.assertEqual(self.data["trip"]["dartUrl"], "https://www.dart.org")

        day1_timeline = next(section for section in pages["day1"]["sections"] if section["type"] == "timeline")
        day1_items = {item["title"]: item for item in day1_timeline["items"]}
        self.assertEqual(day1_items["호텔 조식"]["time"], "6 AM — 8 AM")
        self.assertEqual(day1_items["Terry Black’s BBQ"]["time"], "7 PM — 9 PM")
        self.assertEqual(day1_items["Auction + 대표님과의 담화"]["time"], "9 PM — 10 PM")

        day1_cards = next(section for section in pages["day1"]["sections"] if section["type"] == "cards")
        day1_place_ids = [item["placeId"] for item in day1_cards["items"]]
        self.assertEqual(set(day1_place_ids), set(EXPECTED_GROUP_ADDRESSES))
        self.assertEqual(
            {place_id: self.data["places"][place_id].get("address") for place_id in day1_place_ids},
            EXPECTED_GROUP_ADDRESSES,
        )

        self.assertIn("우버로 이동해", pages["day2"]["summary"])
        day2_timeline = next(section for section in pages["day2"]["sections"] if section["type"] == "timeline")
        day2_items = {item["title"]: item for item in day2_timeline["items"]}
        self.assertEqual(day2_items["호텔 조식"]["time"], "6 AM — 8 AM")
        self.assertEqual(day2_items["호텔 조식"]["transport"], "우버 이동")
        self.assertEqual(day2_items["Kimbell Art Museum"]["transport"], "우버 이동 · 약 35분")
        self.assertEqual(day2_items["점심 · The Café Modern"]["time"], "12 PM — 2 PM")
        self.assertEqual(day2_items["The Modern Art Museum of Fort Worth"]["time"], "2 — 4 PM")
        self.assertEqual(day2_items["Stockyards 자유 탐방"]["time"], "4:30 PM — 7:30 PM")
        self.assertEqual(day2_items["호텔로 복귀"]["transport"], "우버로 복귀")
        docent_text = "Architecture Docent · Haeseok Ko / Art Docent · Nari Rhee"
        kimbell = next(item for item in day2_timeline["items"] if item.get("placeId") == "kimbell")
        modern = next(item for item in day2_timeline["items"] if item.get("placeId") == "modern-art-museum")
        self.assertEqual(kimbell["description"], docent_text)
        self.assertEqual(modern["description"], docent_text)
        self.assertNotIn("버스 대절", json.dumps(pages["day2"], ensure_ascii=False))
        self.assertNotIn("전세 버스", json.dumps(pages["day2"], ensure_ascii=False))
        self.assertNotIn("버스 · 약 35분", json.dumps(pages["day2"], ensure_ascii=False))
        self.assertNotIn("Hae Suk Ko", json.dumps(pages["day2"], ensure_ascii=False))

    def test_destination_guide_preserves_the_supplied_html_content(self):
        about = next(page for page in self.data["pages"] if page["id"] == "about")
        self.assertEqual(about["title"], "Dallas Fort Worth는 어떤 곳인가요?")
        self.assertEqual(about["navLabel"], "지역 안내")

        guide = next(
            (section for section in about["sections"] if section["type"] == "destinationGuide"),
            None,
        )
        self.assertIsNotNone(guide, "Dallas–Fort Worth destination guide is required")
        self.assertEqual(len(guide["history"]["timeline"]), 7)
        self.assertEqual(len(guide["history"]["themes"]), 3)
        self.assertEqual(
            {group["name"]: len(group["places"]) for group in guide["cities"]},
            {"댈러스": 5, "포트워스": 5, "알링턴": 5},
        )
        self.assertEqual(len(guide["tips"]), 4)

        payload = json.dumps(about, ensure_ascii=False)
        required_source_phrases = (
            "Texas · The Lone Star State",
            "댈러스 – 포트워스",
            "A HISTORY OF DALLAS–FORT WORTH",
            "존 닐리 브라이언, 댈러스 정착지 건설",
            "치점 트레일",
            "식스 플로어 박물관",
            "클라이드 워런 파크",
            "포트워스 스톡야드",
            "선댄스 스퀘어",
            "AT&T 스타디움",
            "식스 플래그 오버 텍사스",
            "텍사스 BBQ",
            "TRE 통근열차",
            "식당 팁 문화(약 15~20%)",
            "운영시간·요금은 변동될 수 있으니 방문 전 공식 홈페이지 확인 권장",
        )
        for phrase in required_source_phrases:
            self.assertIn(phrase, payload)

    def test_interactive_map_precedes_lunch_and_trolley_pages_and_preserves_the_attachment(self):
        map_page = self.data["pages"][-3]
        self.assertEqual(map_page["id"], "map")
        self.assertEqual(map_page["navLabel"], "여행 지도")
        section = next(section for section in map_page["sections"] if section["type"] == "mapEmbed")
        source_path = ROOT / section["src"]
        self.assertTrue(source_path.is_file())

        source = source_path.read_text(encoding="utf-8")
        self.assertIn("우리 여행 한눈에", source)
        self.assertIn("DALLAS · FORT WORTH · ARLINGTON", source)
        self.assertIn("★ 초록 핀이 우리 숙소입니다", source)
        self.assertEqual(len(re.findall(r"\{n:\d+,", source)), 25)
        self.assertIn("const HOTEL =", source)

    def test_lunch_page_preserves_source_order_content_and_images(self):
        lunch = self.data["pages"][-2]
        self.assertEqual(lunch["id"], "lunch")
        self.assertEqual(lunch["navLabel"], "점심 추천")
        self.assertEqual(lunch["title"], "오늘 점심, 어디서 먹을까요?")
        self.assertEqual(lunch["heroPlace"], "malai-kitchen")

        section = next(section for section in lunch["sections"] if section["type"] == "lunchCards")
        self.assertEqual(section["items"], [place_id for place_id, *_ in EXPECTED_LUNCH_PLACES])

        for place_id, name, location, budget, address, map_url in EXPECTED_LUNCH_PLACES:
            place = self.data["places"][place_id]
            self.assertEqual(place["name"], name)
            self.assertEqual(place["location"], location)
            self.assertEqual(place["budget"], budget)
            self.assertEqual(place["address"], address)
            self.assertEqual(
                (place["map"]["lat"], place["map"]["lng"]),
                EXPECTED_LUNCH_COORDINATES[place_id],
            )
            self.assertGreater(place["map"]["lat"], 32.7)
            self.assertLess(place["map"]["lat"], 32.9)
            self.assertGreater(place["map"]["lng"], -96.9)
            self.assertLess(place["map"]["lng"], -96.7)
            self.assertEqual(place["primaryLink"], {"label": "Google 지도", "url": map_url})
            self.assertEqual((place["description"], place["menu"]), EXPECTED_LUNCH_CONTENT[place_id])
            self.assertEqual(len(place["images"]), 2)

            actual_images = [(image["sourceName"], Path(image["src"]).name) for image in place["images"]]
            self.assertEqual(actual_images, EXPECTED_LUNCH_IMAGES[place_id])
            for image in place["images"]:
                image_path = ROOT / image["src"]
                self.assertTrue(image_path.is_file(), image_path)
                self.assertGreater(image_path.stat().st_size, 1_000)
                self.assertTrue(image["alt"].strip())

    def test_trolley_page_is_last_and_embeds_the_copied_guide(self):
        trolley = self.data["pages"][-1]
        self.assertEqual(trolley["id"], "trolley")
        self.assertEqual(trolley["href"], "trolley.html")
        self.assertEqual(trolley["navLabel"], "M-Line 트롤리")
        self.assertEqual(trolley["layout"], "embed")

        section = next(section for section in trolley["sections"] if section["type"] == "mapEmbed")
        self.assertEqual(section["title"], "M-Line Trolley 한국어 안내")
        self.assertEqual(section["iframeTitle"], "M-Line Trolley 한국어 안내")
        self.assertEqual(section["src"], "resources/mline-trolley-guide-ko.html")
        self.assertTrue((ROOT / section["src"]).is_file())

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
        for directory in ("data", "docs", "css", "js", "maps"):
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
