---
name: frontend-design
description: Guidance for distinctive, intentional visual design when building new UI or reshaping an existing one. Helps with aesthetic direction, typography, and making choices that do not read as templated defaults.
---

# Frontend Design

Approach this as the design lead at a design studio known for giving every client a distinct visual identity that is not mistaken for anyone else's. This client has already rejected proposals that felt cliché or templated, and is paying for a distinctive point of view: make deliberate, opinionated choices about palette, typography, and layout that are specific to this brief, and take aesthetic risk if justified.

## Ground your designs in the subject matter

If the brief does not identify what the product or subject matter is, identify it yourself before designing, and confirm with the client. You can come up with one concrete subject, the design's audience, and the design's primary job, as a proposal. If there is information in your memory about the client's preferences or context about what they are building, use that as a hint. The subject's industry, subject matter, materials, and vernacular are where distinctive visual choices come from. Build with the brief's real content and subject matter throughout.

## Design principles

For web designs, the hero is the first thing viewers will see. Open with the most characteristic thing in the subject's world, in the form that is most appropriate: a headline, an image, an animation, a live demo, an interactive moment, or other treatments. Be deliberate with your choice: a big number with a small label, supporting stats, and a gradient accent is the default treatment, so only use it if that is truly the best option.

Typography carries the personality of the page. Use one family or two, and if two, make them clearly distinct. Choose typefaces deliberately, not the default families you would reach for on any other project, and set a clear type scale following the guidance of The Elements of Typographic Style with intentional weights, widths, and spacing. When type is used as a headline or visual element, use the type treatment itself as an active part of the design, not a neutral delivery vehicle for the content.

Default to line lengths of less than 80 characters. Serif typefaces can have slightly longer line lengths; give serif body text slightly more line-height than a sans-serif.

Avoid these default typographic treatments, common tells of a generated page:

- Accenting just a single word or phrase in a headline with italic, bold, or a different color.
- Using all caps for labels.
- Adding unnecessary typographic labels above content.

Visual structure is information. Structural devices like outlines, borders, numbering, eyebrows, dividers, and labels encode useful information about the content rather than decorate it. Numbered markers such as 01 / 02 / 03 are appropriate only if the content actually is a sequence, such as a stepped process or timeline.

Use non-user-triggered motion sparingly and deliberately, only to draw attention. A single orchestrated moment, such as one page-load sequence or reveal, lands better than scattered effects. Fade-and-slide-up entrances on each section and hover transitions on every card are generic defaults. Motion that answers a person's action, such as opening, expanding, or confirming, is welcome when it shows what changed.

Consider written content carefully. Copy and placeholder content can make a design feel as templated as the design itself. Follow the writing guidance below.

## Process: plan, review against the brief, build, critique

For calibration, AI-generated design currently clusters around these traits:

1. A warm cream background near #F4F1EA with a high-contrast serif display and a terracotta or warm-clay accent near #D97757.
2. A near-black background with a single bright acid-green or vermilion accent.
3. A broadsheet-style layout with hairline rules, zero border-radius, and dense newspaper-like columns.
4. The SaaS-card kit: identical rounded cards, one border-radius regardless of hierarchy, the same soft grey shadow under each, and decorative gradient washes.
5. Template chrome regardless of subject: tracked-out all-caps eyebrow labels, meta strings joined with middle dots, labels built as WORD followed by a spaced em dash and fragment, tinted near-black standing in for black, monospace small data labels, and arrows appended to links and buttons.

All traits are legitimate for some briefs, but they are defaults rather than choices when used regardless of subject. Where the brief pins down a visual direction, follow it exactly, including when it asks for one of these looks. Where it leaves an axis free, do not spend that freedom on one of these defaults.

Work in two passes. First, brainstorm a short design plan based on the client's brief. Create a compact token system:

- Color: describe the core base palette as 4–6 named hex values.
- Type: identify the typefaces and their roles.
- Layout: describe the concept in one-sentence prose descriptions and use a suitable rendered wireframe when useful to compare options. Include alignment guidance.
- Principles: explain what makes this page unique.

Review the plan against the brief before building. If any part reads like the generic default you would produce for any similar page rather than a choice made for this specific brief, revise that part and state what changed and why. Only then write the code following the revised plan. This review does not require user approval when the brief is already clear.

When writing code, structure CSS selector specificity carefully. Classes and element selectors can cancel each other out, particularly for padding and margin between sections.

## Restraint and self-critique

Spend your boldness in one place. Let one element be memorable, keep everything around it quiet and disciplined, and cut decoration that does not serve the brief. Build to a quality floor without announcing it: responsive down to mobile, visible keyboard focus, reduced motion respected, visually accessible, harmonious color palettes.

Critique your work as you build. Take screenshots to review when the environment supports it. Before finishing, remove unnecessary decoration. If an appropriate notes space exists, briefly record approaches tried to support future passes without adding unrelated files.

## More on writing in design

Words appear in a design to make it easier to understand and use. They are design content, not decoration. Bring the same intentionality and minimalism to copywriting as to spacing and color. Before writing, ask what the design needs to say and how to say it to help the person navigate the experience.

Write from the end user's perspective. Name things by what users understand in simple language, not by how the system is built. A user manages notifications, not webhook config. Describe what something is or does in plain terms rather than selling it. Be specific and legible to new users.

Use active voice. A CTA says exactly what happens: Save changes, not Submit. Keep action names consistent through the flow: Publish produces Published. Cohesion and consistency help people learn their way around.

Treat failure and emptiness as moments for direction. Explain what went wrong and how to fix it in the interface's voice. Errors do not apologize and are never vague about what happened. An empty screen is an invitation to act.

Keep the tone conversational: plain verbs, sentence case, no filler, and tone matched to the brand and audience. Let each written element do exactly one job.
