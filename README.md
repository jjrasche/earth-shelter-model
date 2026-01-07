# Earth Shelter Burial Calculator

Interactive 3D visualization tool for designing earth-sheltered structures buried in hillsides.

## What This Does

Visualizes a structure (default 10×10×10 ft) pushed into a sloped hillside. Shows:
- The exposed front face
- Earth berm covering the structure with a flat cap, angled side slopes, and back termination
- Excavation (walkout cut below the front)
- Real-time volume calculations for cut and fill

## Interactive Parameters

- **Slope angle**: Natural hillside slope (5-45°)
- **Setback**: How far the structure is pushed into the hill (0-30 ft)
- **Structure dimensions**: Width, depth, height
- **Berm config**: Overhang (cap edge distance), cover depth, drainage slopes
- **Walkout slope**: Front excavation drainage angle

## Outputs

- Effective burial depth (derived from setback × slope)
- Walkout distance (where excavation meets grade)
- Walkout width (trapezoid, wider than structure due to side slope run)
- Cut volume (excavation in cubic yards)
- Fill volume (berm above natural grade, cubic yards)
- Earth balance (cut - fill)

## Geometry

Three views: isometric (rotatable), side cross-section, top-down plan.

Cap has center ridge, slopes to sides for water drainage. Side slopes (~30°) descend to natural grade. Back slope terminates where cap meets rising hillside.

Coordinate system: X=width, Y=into hill, Z=height. Origin at front face grade level.
