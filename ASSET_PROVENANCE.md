# Asset provenance

All fighter bodies, the common rig, combat clips, arena and trophy are original assets authored in Blender through `scripts/build_assets.py`. The editable shared source is `scripts/fighter-source.blend`. Portraits are Blender renders of those models.

`scripts/build_head.py` constructs individually fitted, closed head surfaces from the unchanged source atlas's opaque contours and per-person facial landmarks. The chin, facial relief, crown, scalp and shaped ears share the head bone. There is no separate face card or generic skull behind it. Side/scalp colors and body skin tones are sampled from the same likeness. Side views remain an approximation derived from a frontal source, rather than a scanned likeness. `scripts/render_head_qa.py` renders all four heads from the front, three-quarter view and profile for visual inspection.

`public/models/fighter-face-atlas.png` was created with the built-in image-generation tool in one request for this project. It is an original generated texture, not a photograph. The four quadrants depict fictional likenesses of Elon Musk, Mark Zuckerberg, Dario Amodei and Sam Altman, in that order. Actual resolution: 1254 × 1254 RGBA.

Generation brief: A 2×2 atlas of distinct, recognizable, realistic game-quality heads. Top left Elon Musk; top right Mark Zuckerberg; bottom left Dario Amodei; bottom right Sam Altman. Front-facing orthographic view, neutral closed-mouth expressions, complete hair and ears, no neck/body/clothes/text, natural adult proportions, detailed skin/eyelids/lips, flat soft neutral lighting, transparent background. Intended as UV texture maps for fictional satirical MMA characters.

Original synthetic audio was created with `scripts/build_audio.py`. It contains no voice clones or third-party recordings. Barlow, Barlow Condensed and IBM Plex Mono are served by Google Fonts.

`scripts/build_upper_body.py` creates a continuous welded surface across the chest, trapezius, neck, shoulders and arms. Clavicles, pectorals and neck tendons use shallow geometric relief. Blended head/chest/arm weights preserve the connected surface during combat animations.

`scripts/build_lower_body.py` creates tapered thigh/knee/calf/ankle surfaces with blended leg weights and fitted shorts with a continuous hip panel. The export applies the same adult-proportion mapping to mesh vertices, skeleton rest positions and strike targets, keeping total height approximately constant while lengthening legs and reducing head, shoulder, glove and boot bulk.

Arm geometry uses a single curved shoulder-to-wrist surface without spherical joint caps. The wrist cuffs follow the forearm direction. The neck is shortened by 3.5 model centimeters with the same mapping applied to the mesh and skeleton. Each waistband and the upper shorts use the shared `torso_section` profile and that fighter's width, keeping the waist aligned with the abdomen.

This is a fictional satirical depiction. No affiliation or endorsement is implied. Commercial likeness review is not part of this implementation.
