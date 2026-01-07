export interface Params {
  // Hillside
  slope_angle: number;  // degrees

  // Structure
  structure_width: number;   // ft
  structure_depth: number;   // ft
  structure_height: number;  // ft

  // Position
  setback: number;  // ft, how far structure is pushed into hill (Y direction)

  // Berm
  min_cover: number;   // ft, earth depth above roof
  overhang: number;    // ft, distance from structure wall to cap edge
  cap_slope: number;   // degrees, drainage slope toward sides
  side_slope: number;  // degrees, angle from cap edge down to grade

  // Walkout
  walkout_slope: number;  // degrees, drainage away from structure
}

export const DEFAULT_PARAMS: Params = {
  slope_angle: 20,
  structure_width: 10,
  structure_depth: 10,
  structure_height: 10,
  setback: 0,
  min_cover: 4,
  overhang: 3,
  cap_slope: 2,
  side_slope: 30,
  walkout_slope: 2,
};

export interface CalculatedOutputs {
  effective_burial: number;      // ft, derived from setback × tan(slope)
  walkout_distance: number;      // ft, where walkout meets grade
  walkout_width: number;         // ft, trapezoid width at front
  cut_volume: number;            // yd³
  fill_volume: number;           // yd³
  earth_balance: number;         // yd³ (cut - fill)
  convergence_y: number;         // ft, where cap center meets grade
  cap_clearance: number;         // ft, cap height above grade at front
  side_run: number;              // ft, horizontal run of side slope at front
}

export function degToRad(deg: number): number {
  return deg * Math.PI / 180;
}
