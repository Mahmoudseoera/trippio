"""Turn a transparent contact sheet into reusable, raster-free SVG symbols.

Dependencies live beside tools/ in ../.deps. Tested with VTracer 0.6.12 and
Pillow 12.3.0. Native VTracer transparency was verified using a ring with an
internal transparent hole. Partial alpha is represented by a vector mask.
"""
from __future__ import annotations

import argparse
from array import array
from collections import deque
from copy import deepcopy
import hashlib
import io
import json
from pathlib import Path
import re
import sys
import time
import xml.etree.ElementTree as ET

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / ".deps"))
from PIL import Image
import vtracer

NS = "http://www.w3.org/2000/svg"
ET.register_namespace("", NS)


def tag(name):
    return f"{{{NS}}}{name}"


def trace(im, settings):
    stream = io.BytesIO()
    im.save(stream, format="PNG")
    value = vtracer.convert_raw_image_to_svg(stream.getvalue(), img_format="png", **settings)
    root = ET.fromstring(value)
    if any(e.tag.split("}")[-1] in {"image", "foreignObject"} for e in root.iter()):
        raise RuntimeError("Unexpected raster or foreign content in traced output")
    return root


def split_components(im, columns, rows, threshold, min_component):
    """Assign disconnected ink islands to a grid cell without clipping gutters.

    Tiny background/alpha fragments are discarded. Surviving components use
    their alpha-weight-independent centroid for cell assignment. This lets a
    pyramid or palm cross its nominal cell edge while remaining intact.
    """
    width, height = im.size
    alpha = bytearray(im.getchannel("A").tobytes())
    labels = array("h", [-1]) * (width * height)
    statistics = [[] for _ in range(columns * rows)]
    for start in range(width * height):
        if alpha[start] <= threshold:
            continue
        queue = deque([start])
        alpha[start] = 0
        pixels = []
        sx = sy = 0
        left = width
        top = height
        right = bottom = -1
        while queue:
            p = queue.pop()
            pixels.append(p)
            y, x = divmod(p, width)
            sx += x
            sy += y
            left, top = min(left, x), min(top, y)
            right, bottom = max(right, x), max(bottom, y)
            neighbours = []
            if x:
                neighbours.append(p - 1)
            if x + 1 < width:
                neighbours.append(p + 1)
            if y:
                neighbours.append(p - width)
            if y + 1 < height:
                neighbours.append(p + width)
            for neighbour in neighbours:
                if alpha[neighbour] > threshold:
                    alpha[neighbour] = 0
                    queue.append(neighbour)
        if len(pixels) < min_component:
            continue
        cx, cy = sx / len(pixels), sy / len(pixels)
        cell_x = min(columns - 1, int(cx * columns / width))
        cell_y = min(rows - 1, int(cy * rows / height))
        cell = cell_y * columns + cell_x
        for p in pixels:
            labels[p] = cell
        statistics[cell].append({"pixels": len(pixels), "bbox": [left, top, right + 1, bottom + 1]})
    tiles = []
    for cell, stats in enumerate(statistics):
        if not stats:
            raise ValueError(f"Cell {cell + 1} has no visible artwork")
        bounds = (
            min(s["bbox"][0] for s in stats), min(s["bbox"][1] for s in stats),
            max(s["bbox"][2] for s in stats), max(s["bbox"][3] for s in stats),
        )
        crop = im.crop(bounds)
        raw = bytearray(crop.tobytes())
        crop_width, crop_height = crop.size
        for y in range(crop_height):
            source_row = (y + bounds[1]) * width + bounds[0]
            for x in range(crop_width):
                if labels[source_row + x] != cell:
                    off = (y * crop_width + x) * 4
                    raw[off:off + 4] = b"\x00\x00\x00\x00"
        crop = Image.frombytes("RGBA", crop.size, bytes(raw))
        tiles.append((crop, bounds, {"component_count": len(stats), "largest_component": max(s["pixels"] for s in stats)}))
    return tiles


def split_grid(im, columns, rows, threshold):
    tiles = []
    for row in range(rows):
        for col in range(columns):
            bounds = (round(col * im.width / columns), round(row * im.height / rows),
                      round((col + 1) * im.width / columns), round((row + 1) * im.height / rows))
            crop = im.crop(bounds)
            alpha = crop.getchannel("A").point(lambda a: a if a > threshold else 0)
            crop.putalpha(alpha)
            box = alpha.getbbox()
            if box is None:
                raise ValueError(f"Cell {row * columns + col + 1} has no visible artwork")
            tiles.append((crop.crop(box), (bounds[0] + box[0], bounds[1] + box[1], bounds[0] + box[2], bounds[1] + box[3]), {}))
    return tiles


def vector_asset(im, name, settings, max_paths, alpha_levels):
    # Native color tracing treats all visible pixels as fully opaque. A separate
    # vector luminance mask retains quantized partial alpha including holes.
    alpha = im.getchannel("A")
    colors = im.copy()
    colors.putalpha(alpha.point(lambda a: 255 if a else 0))
    current = dict(settings)
    root = None
    for attempt in range(5):
        root = trace(colors, current)
        count = len(root.findall(".//" + tag("path")))
        if count <= max_paths:
            break
        current["layer_difference"] += 5
        current["filter_speckle"] += 1
        if attempt > 1:
            current["color_precision"] = max(4, current["color_precision"] - 1)
    if count > max_paths:
        raise RuntimeError(f"{name}: {count} color paths exceeds budget {max_paths}")
    root.set("viewBox", f"0 0 {im.width} {im.height}")
    root.set("role", "img")
    title = ET.Element(tag("title"))
    title.text = name.replace("-", " ").title()
    root.insert(0, title)
    mask_count = 0
    quantized = alpha.point(lambda a: round(a / 255 * (alpha_levels - 1)) * 255 // (alpha_levels - 1))
    alpha_values = set(quantized.tobytes())
    if alpha_values - {0, 255}:
        mask_im = Image.merge("RGBA", (quantized, quantized, quantized, alpha.point(lambda a: 255 if a else 0)))
        mask_settings = dict(settings, color_precision=8, layer_difference=1, filter_speckle=2, length_threshold=2.0)
        mask_root = trace(mask_im, mask_settings)
        defs = ET.SubElement(root, tag("defs"))
        mask = ET.SubElement(defs, tag("mask"), {"id": f"{name}-alpha", "maskUnits": "userSpaceOnUse", "x": "0", "y": "0", "width": str(im.width), "height": str(im.height), "style": "mask-type:luminance"})
        for child in list(mask_root):
            mask.append(child)
        mask_count = len(mask.findall(".//" + tag("path")))
        group = ET.Element(tag("g"), {"mask": f"url(#{name}-alpha)"})
        for child in list(root):
            if child.tag not in {tag("title"), tag("defs")}:
                root.remove(child)
                group.append(child)
        root.append(group)
    return root, current, count, mask_count


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--names", help="Comma-separated row-major cell IDs")
    group.add_argument("--names-json", type=Path, help="JSON array of row-major cell IDs")
    parser.add_argument("--columns", type=int, default=3)
    parser.add_argument("--rows", type=int, default=3)
    parser.add_argument("--split", choices=("components", "grid"), default="components")
    parser.add_argument("--alpha-threshold", type=int, default=32)
    parser.add_argument("--alpha-levels", type=int, default=16)
    parser.add_argument("--min-component", type=int, default=8)
    parser.add_argument("--color-precision", type=int, default=7)
    parser.add_argument("--layer-difference", type=int, default=10)
    parser.add_argument("--filter-speckle", type=int, default=2)
    parser.add_argument("--max-paths", type=int, default=18000)
    args = parser.parse_args()
    names = json.loads(args.names_json.read_text("utf-8-sig")) if args.names_json else args.names.split(",")
    names = [name.strip() for name in names]
    if len(names) != args.rows * args.columns or len(names) != len(set(names)):
        parser.error("Provide one unique name per cell")
    if any(not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]*", name) for name in names):
        parser.error("IDs must begin with a letter and contain letters, digits, underscores or dashes")
    if not 2 <= args.alpha_levels <= 256:
        parser.error("alpha-levels must be between 2 and 256")
    args.output.mkdir(parents=True, exist_ok=True)
    crops = args.output / "trace-inputs"
    crops.mkdir(exist_ok=True)
    im = Image.open(args.input).convert("RGBA")
    if im.getchannel("A").getextrema()[0] == 255:
        parser.error("The source must have actual transparent pixels")
    started = time.time()
    tiles = split_components(im, args.columns, args.rows, args.alpha_threshold, args.min_component) if args.split == "components" else split_grid(im, args.columns, args.rows, args.alpha_threshold)
    settings = dict(colormode="color", hierarchical="cutout", mode="spline", filter_speckle=args.filter_speckle,
                    color_precision=args.color_precision, layer_difference=args.layer_difference,
                    corner_threshold=60, length_threshold=2.5, max_iterations=10, splice_threshold=45, path_precision=2)
    metadata = {"source": str(args.input.resolve()), "source_sha256": hashlib.sha256(args.input.read_bytes()).hexdigest(),
                "source_size": list(im.size), "grid": [args.columns, args.rows], "split": args.split,
                "alpha_threshold": args.alpha_threshold, "alpha_levels": args.alpha_levels,
                "raster_embedded": False, "assets": []}
    library = ET.Element(tag("svg"), {"version": "1.1"})
    for index, (name, (tile, bounds, stats)) in enumerate(zip(names, tiles)):
        tile.save(crops / f"{name}.png")
        root, effective, paths, alpha_paths = vector_asset(tile, name, settings, args.max_paths, args.alpha_levels)
        path = args.output / f"{name}.svg"
        ET.ElementTree(root).write(path, encoding="utf-8", xml_declaration=True)
        symbol = ET.SubElement(library, tag("symbol"), {"id": name, "viewBox": root.get("viewBox")})
        for child in root:
            symbol.append(deepcopy(child))
        asset = {"id": name, "index": index, "svg": path.name, "source_bbox": list(bounds), "viewBox": [0, 0, *tile.size],
                 "width": tile.width, "height": tile.height, "anchor": [round(tile.width / 2, 2), tile.height],
                 "color_paths": paths, "alpha_paths": alpha_paths, "total_paths": paths + alpha_paths,
                 "svg_bytes": path.stat().st_size, "trace_settings": effective, **stats}
        metadata["assets"].append(asset)
        print(json.dumps({key: asset[key] for key in ("id", "width", "height", "color_paths", "alpha_paths", "svg_bytes")}), flush=True)
    ET.ElementTree(library).write(args.output / "symbols.svg", encoding="utf-8", xml_declaration=True)
    metadata["elapsed_seconds"] = round(time.time() - started, 2)
    (args.output / "metadata.json").write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Finished {len(names)} vector assets in {metadata['elapsed_seconds']} seconds", flush=True)


if __name__ == "__main__":
    main()
