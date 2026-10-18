"""Real Chromium verification of the packaged, directly opened SVG viewer."""
from pathlib import Path
import json
import math
import sys
import time

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / ".browser-deps"))
from playwright.sync_api import sync_playwright

QA = ROOT / "qa"
QA.mkdir(exist_ok=True)
REPORT = {"viewer": (ROOT / "viewer.html").as_uri(), "checks": [], "errors": []}


def check(name, passed, **details):
    REPORT["checks"].append({"name": name, "passed": bool(passed), **details})
    print(f"{'PASS' if passed else 'FAIL'} {name}", flush=True)
    if not passed:
        raise AssertionError(f"{name}: {details}")


def box(page):
    return page.locator("#map-stage > svg").evaluate("s => s.getAttribute('viewBox').split(/\\s+/).map(Number)")


def mapped_point(page, x, y):
    return page.locator("#map-stage > svg").evaluate("""(svg, position) => {
        const p = svg.createSVGPoint(); p.x = position[0]; p.y = position[1];
        const q = p.matrixTransform(svg.getScreenCTM().inverse()); return [q.x, q.y];
    }""", [x, y])


def watch(page, name):
    page.on("pageerror", lambda error: REPORT["errors"].append({"page": name, "type": "pageerror", "message": str(error)}))
    page.on("console", lambda message: REPORT["errors"].append({"page": name, "type": "console", "message": message.text}) if message.type == "error" else None)
    page.on("requestfailed", lambda request: REPORT["errors"].append({"page": name, "type": "requestfailed", "url": request.url, "message": request.failure}))


started = time.monotonic()
try:
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=r"C:\Program Files\Google\Chrome\Application\chrome.exe", headless=True)
        REPORT["browser"] = browser.version
        page = browser.new_page(viewport={"width": 1440, "height": 1000}, device_scale_factor=1)
        watch(page, "desktop")
        page.goto(REPORT["viewer"], wait_until="load", timeout=90000)
        page.locator("#map-stage.ready").wait_for(timeout=90000)
        page.locator("#map-stage > svg").wait_for(state="visible", timeout=90000)
        initial = box(page)
        initial_hidden = page.locator("#map-stage > svg").evaluate("svg => [...svg.querySelectorAll('[data-art-bounds]')].filter(e=>e.style.display==='none').length")
        check("Direct file URL initializes actual inline SVG", initial == [0, 0, 2400, 2378], viewBox=initial)
        check("Single page H1", page.locator("h1").count() == 1)
        check("No raster SVG image elements", page.locator("#map-stage > svg image").count() == 0)
        check("Desktop has no horizontal overflow", page.evaluate("document.documentElement.scrollWidth <= innerWidth"))
        check("Controls enable after load", page.locator("#zoom-in").is_enabled() and page.locator("#zoom-out").is_disabled())
        page.screenshot(path=str(QA / "viewer-desktop.png"), full_page=True, timeout=90000)

        page.locator("#zoom-in").click()
        after_button = box(page)
        check("Zoom button changes actual viewBox", abs(after_button[2] - 1600) < .01 and page.locator("#zoom-level").text_content() == "150%", viewBox=after_button)
        extent = page.locator("#map-stage").bounding_box()
        # WheelEvent client coordinates are integer CSS pixels in Chromium.
        x, y = round(extent["x"] + extent["width"] * .55), round(extent["y"] + extent["height"] * .5)
        anchor_before = mapped_point(page, x, y)
        page.mouse.move(x, y)
        page.mouse.wheel(0, -120)
        page.wait_for_function("document.querySelector('#map-stage > svg').viewBox.baseVal.width < 1590", timeout=90000)
        after_wheel = box(page)
        anchor_after = mapped_point(page, x, y)
        drift = math.hypot(anchor_after[0] - anchor_before[0], anchor_after[1] - anchor_before[1])
        check("Wheel zoom remains anchored under pointer", after_wheel[2] < after_button[2] and drift < .1, anchor_drift_units=drift, viewBox=after_wheel)

        page.mouse.move(x, y)
        page.mouse.down()
        page.mouse.move(x + 80, y + 40, steps=4)
        page.mouse.up()
        after_drag = box(page)
        check("Dragging pans the vector viewport", after_drag[0] < after_wheel[0] and after_drag[1] < after_wheel[1] and abs(after_drag[2] - after_wheel[2]) < .01, viewBox=after_drag)
        page.locator("#reset-view").click()
        check("Reset restores full map", box(page) == initial)

        stage = page.locator("#map-stage")
        stage.focus()
        page.keyboard.press("+")
        check("Keyboard plus zooms", box(page)[2] < 2400)
        before_arrow = box(page)
        page.keyboard.press("ArrowRight")
        check("Keyboard arrow pans", box(page)[0] > before_arrow[0])
        page.keyboard.press("Home")
        check("Home restores full map", box(page) == initial)

        for _ in range(10):
            if page.locator("#zoom-in").is_disabled(): break
            page.locator("#zoom-in").click()
        check("Zoom is capped at 1600 percent", abs(box(page)[2] - 150) < .01 and page.locator("#zoom-in").is_disabled(), viewBox=box(page))
        visibility = page.locator("#map-stage > svg").evaluate("""svg => {
          const art=[...svg.querySelectorAll('[data-art-bounds]')].filter(e=>!e.closest('defs'));
          return {total:art.length, hidden:art.filter(e=>e.style.display==='none').length,
                  defsHidden:svg.querySelectorAll('defs [style*="display: none"]').length};
        }""")
        check("High zoom culls offscreen artwork and preserves defs", visibility["total"] > 0 and visibility["hidden"] > 0 and visibility["defsHidden"] == 0, **visibility)
        page.screenshot(path=str(QA / "viewer-detail-1600.png"), full_page=False, timeout=90000)
        page.locator("#reset-view").click()
        still_hidden = page.locator("#map-stage > svg").evaluate("svg => [...svg.querySelectorAll('[data-art-bounds]')].filter(e=>e.style.display==='none').length")
        check("Reset restores visible artwork", still_hidden == initial_hidden, hidden=still_hidden, initial_hidden=initial_hidden)

        mobile = browser.new_page(viewport={"width": 390, "height": 844}, device_scale_factor=1, is_mobile=True, has_touch=True)
        watch(mobile, "mobile")
        mobile.goto(REPORT["viewer"], wait_until="load", timeout=90000)
        mobile.locator("#map-stage.ready").wait_for(timeout=90000)
        check("390px layout has no horizontal overflow", mobile.evaluate("document.documentElement.scrollWidth <= innerWidth"), width=mobile.evaluate("document.documentElement.scrollWidth"))
        check("Mobile controls remain visible and usable", mobile.locator("#zoom-in").is_visible() and mobile.locator("#zoom-in").bounding_box()["width"] >= 40)
        mobile.screenshot(path=str(QA / "viewer-mobile.png"), full_page=True, timeout=90000)
        bounds = mobile.locator("#map-stage").bounding_box()
        mx, my = bounds["x"] + bounds["width"] / 2, min(bounds["y"] + bounds["height"] / 2, 700)
        cdp = mobile.context.new_cdp_session(mobile)
        def touches(distance):
            return [{"x": mx-distance, "y": my, "id": 1}, {"x": mx+distance, "y": my, "id": 2}]
        cdp.send("Input.dispatchTouchEvent", {"type": "touchStart", "touchPoints": touches(35)})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchMove", "touchPoints": touches(70)})
        cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
        mobile.wait_for_function("document.querySelector('#map-stage > svg').viewBox.baseVal.width < 2000", timeout=90000)
        check("Two-finger pinch updates vector viewBox", box(mobile)[2] < 2000, viewBox=box(mobile))
        mobile.locator("#reset-view").click()
        check("No console, script, or loading errors", not REPORT["errors"], errors=REPORT["errors"])
        browser.close()
        REPORT["passed"] = True
except Exception as exc:
    REPORT["passed"] = False
    REPORT["failure"] = str(exc)
    print(f"ERROR {exc}", flush=True)
finally:
    REPORT["elapsed_seconds"] = round(time.monotonic() - started, 2)
    (QA / "browser-report.json").write_text(json.dumps(REPORT, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"passed": REPORT["passed"], "checks": len(REPORT["checks"]), "seconds": REPORT["elapsed_seconds"]}), flush=True)
    sys.exit(0 if REPORT["passed"] else 1)
