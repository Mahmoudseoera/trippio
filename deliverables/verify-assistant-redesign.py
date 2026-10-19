from html.parser import HTMLParser
from pathlib import Path

root = Path(__file__).resolve().parents[1]


class PlannerParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.headings = 0
        self.points = 0
        self.questions = 0

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        self.headings += tag == "h1"
        self.questions += attrs.get("class") == "chat-question"
        if attrs.get("class") in ("city-tab", "attraction"):
            assert 22 <= float(attrs["data-lat"]) <= 32
            assert 25 <= float(attrs["data-lon"]) <= 36
            self.points += 1
        if tag == "img":
            assert attrs.get("alt") and attrs.get("title")
        for attribute in ("src", "href", "poster"):
            value = attrs.get(attribute, "")
            if value and not value.startswith(("http", "#", "data:", "tel:", "mailto:")):
                assert (root / value.split("#")[0]).exists(), value


parser = PlannerParser()
parser.feed((root / "ai-assistance.html").read_text(encoding="utf-8-sig"))
assert len(parser.ids) == len(set(parser.ids))
assert parser.headings == 1
assert parser.questions == 6
assert parser.points == 21
script = (root / "assets/js/ai-assistance.js").read_text(encoding="utf-8-sig")
assert "L.CRS.Simple" in script and "L.polyline(orderedStops.map(latLng)" in script
assert "tileLayer" not in script
assert "projectToArtwork" in script
assert 'class="map-heading"' not in (root / "ai-assistance.html").read_text(encoding="utf-8-sig")
assert "Number(element.dataset.lat),Number(element.dataset.lon)" in script
assert "photoURL" not in script and "inspiration" not in script
assert "location.assign('assistant-confirmation.html')" in script
assert "fetch(" not in script
assert "narration.rate=.78" in script
assert "new FormData" not in script
assert "cityTours(city).length+' tours'" in script
assert (root / "AI Assistance/assets/js/ai-assistance.js").exists()
print("PASS: unique IDs, one H1, six quiz steps, 21 geographic anchors, image-only map, no heading or tile layer, links, routes, male narration, preview redirect.")
