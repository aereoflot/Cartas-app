#!/usr/bin/env python3
"""Generate the app icons.

    python3 scripts/gen_icons.py      (needs pillow)

Drawn rather than drafted in an editor so the set is reproducible and all of it
changes together. Shapes only, no text: an icon has to read at 48 pixels on a
home screen, and a word never does.

Two overlapping cards and a gold coin - the oros of a Spanish deck - on the
card-table green of the app's accent colour.
"""
import pathlib

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "public"

GREEN = (31, 111, 74)
PAPER = (250, 248, 243)
GOLD = (165, 117, 26)
INK = (27, 24, 21)


def draw_icon(size: int, padding: float) -> Image.Image:
    """padding: share of the side kept clear, for maskable icons."""
    scale = 4  # draw big, downsample: cheap antialiasing
    side = size * scale
    image = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    draw.rounded_rectangle(
        [0, 0, side - 1, side - 1], radius=int(side * 0.22), fill=GREEN
    )

    inner = side * (1 - 2 * padding)
    left = side * padding
    card_w, card_h = inner * 0.46, inner * 0.68
    radius = int(card_w * 0.16)

    # the card behind, leaning left
    back = Image.new("RGBA", (int(card_w), int(card_h)), (0, 0, 0, 0))
    ImageDraw.Draw(back).rounded_rectangle(
        [0, 0, card_w - 1, card_h - 1], radius=radius, fill=PAPER + (255,),
        outline=INK + (40,), width=max(2, int(side * 0.004)),
    )
    back = back.rotate(14, expand=True, resample=Image.BICUBIC)
    image.alpha_composite(
        back,
        (int(left + inner * 0.06), int(left + inner * 0.18)),
    )

    # the card in front, upright, with the coin
    front = Image.new("RGBA", (int(card_w), int(card_h)), (0, 0, 0, 0))
    front_draw = ImageDraw.Draw(front)
    front_draw.rounded_rectangle(
        [0, 0, card_w - 1, card_h - 1], radius=radius, fill=PAPER + (255,),
        outline=INK + (50,), width=max(2, int(side * 0.004)),
    )
    coin = card_w * 0.46
    cx, cy = card_w / 2, card_h / 2
    front_draw.ellipse(
        [cx - coin / 2, cy - coin / 2, cx + coin / 2, cy + coin / 2],
        fill=GOLD + (255,),
    )
    front_draw.ellipse(
        [cx - coin / 4, cy - coin / 4, cx + coin / 4, cy + coin / 4],
        outline=PAPER + (220,), width=max(2, int(side * 0.006)),
    )
    image.alpha_composite(
        front,
        (int(left + inner * 0.40), int(left + inner * 0.13)),
    )

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(exist_ok=True)
    made = []

    for size in (192, 512):
        path = OUT / f"icon-{size}.png"
        draw_icon(size, padding=0.06).save(path)
        made.append(path)

    # maskable: the launcher may crop to a circle, so keep the art well inside
    path = OUT / "icon-maskable-512.png"
    draw_icon(512, padding=0.18).save(path)
    made.append(path)

    path = OUT / "apple-touch-icon.png"
    draw_icon(180, padding=0.06).save(path)
    made.append(path)

    path = OUT / "favicon-32.png"
    draw_icon(32, padding=0.04).save(path)
    made.append(path)

    for path in made:
        print(f"  {path.relative_to(ROOT)}  {path.stat().st_size // 1024} kB")


if __name__ == "__main__":
    main()
