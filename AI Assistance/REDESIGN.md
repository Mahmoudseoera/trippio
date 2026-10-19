# Illustrated redesign

The new entry point is ../ai-assistance.html. The old version is ai-assistance.html
in this folder; reference.html is the supplied example unchanged.

The new map uses the supplied illustrated JPG with schematic image-space positions,
not geographic navigation. Real city coordinates remain separate for weather.
Tours draw connected numbered stops in itinerary order. Selecting another city
clears the previous route. Quiz city counts derive from actual catalogue cards.
Special requests reveal a textarea only when checked.

Narration prefers an installed softer English voice, at 0.78 speed and 0.8 volume;
the exact voice depends on the device. Weather effects start enabled and follow
fetched conditions, with no fabricated temperatures on API failure.

The previous satellite verification harness does not cover this redesign.
Browser visual, voice playback and live-weather QA are not confirmed: the preview
tool failed with an invalid C:/package.json configuration.
