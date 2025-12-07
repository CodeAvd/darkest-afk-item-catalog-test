# Game Item Images

This directory contains the visual assets for the Darkest AFK item catalog.

## Current Images

The following placeholder images are included (SVG format):

1. **items_hero_summon_scroll_class.svg** - Class Summon Scroll / Классовый свиток (parchment with colored gems)
2. **item_meteorite.svg** - Blazing Meteorite / Пылающий метеорит (fireball effect)
3. **item_magic_bean.svg** - Magic Beans / Магические бобы (green seed resource)
4. **item_magic_seed.svg** - Magic Seeds / Магические семена (yellow leaves resource)
5. **item_stardust.svg** - Stardust / Звездная пыль (purple mystical stones)

## Replacing Placeholder Images

The current images are SVG placeholders. To use actual game assets:

1. **Export your game item images** from your asset pipeline
2. **Save them in PNG or SVG format** with the same filenames (just change extension in items.json)
3. **Recommended specs**:
   - Format: PNG with transparency (preferred) or SVG
   - Size: 64x64 to 128x128 pixels (will be scaled to 80x80 in featured section)
   - Color space: sRGB
   - Background: Transparent or dark (#0b0d12)

4. **Replace the files** in this directory, keeping the same base names
5. **Update `items.json`** if changing from .svg to .png
6. **Refresh your browser** to see the changes

## Adding New Images

When adding new items to `items.json`:

1. Export the item's icon from your game
2. Save it in this directory as `item_code_name.png`
3. Reference it in your JSON: `"image": "images/item_code_name.png"`
4. The catalog will automatically display it in the grid

## Image Format Guidelines

- Use PNG for items with effects or transparency
- Use consistent sizing (all items should be roughly the same dimensions)
- Ensure good contrast against dark backgrounds (#0b0d12)
- Add subtle glows or borders in the source asset for better visibility

## Browser Compatibility

All modern browsers support PNG images. The `loading="lazy"` attribute is used for performance optimization.
