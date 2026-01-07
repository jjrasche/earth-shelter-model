import * as THREE from 'three';
import { Params, CalculatedOutputs, degToRad } from './params';

const EPSILON = 0.001;

export function calculateOutputs(p: Params): CalculatedOutputs {
  const slope_rad = degToRad(p.slope_angle);
  const side_slope_rad = degToRad(p.side_slope);
  const walkout_slope_rad = degToRad(p.walkout_slope);

  // Grade height at front of structure (Y = setback)
  const grade_at_front = p.setback * Math.tan(slope_rad);

  // Effective burial = how much grade has risen at front face
  const effective_burial = grade_at_front;

  // Cap clearance = how high cap center is above grade at front
  // Cap center is at Z = min_cover (relative to structure roof at Z=0)
  // Structure roof is at Z = 0, grade at front is at Z = grade_at_front
  // So cap is at Z = min_cover, grade is at Z = grade_at_front
  // Cap clearance = min_cover - grade_at_front (can be negative if cap is below grade)
  const cap_clearance = p.min_cover - grade_at_front;

  // Side run at front = horizontal distance side slope travels to reach grade
  // Only positive if cap is above grade
  const side_run = cap_clearance > 0
    ? cap_clearance / Math.tan(side_slope_rad)
    : 0;

  // Walkout width = structure width + 2*overhang + 2*side_run
  const walkout_width = p.structure_width + 2 * p.overhang + 2 * side_run;

  // Walkout distance = where sloped walkout floor meets natural grade
  // Floor at front is at Z = -structure_height
  // Floor slopes down at walkout_slope (going in -Y direction)
  // Grade at Y position: Z = Y * tan(slope_angle)
  // Floor at Y position: Z = -structure_height - (setback - Y) * tan(walkout_slope)
  // Solve: Y * tan(slope) = -structure_height - (setback - Y) * tan(walkout_slope)
  // Y * tan(slope) = -structure_height - setback*tan(walkout_slope) + Y*tan(walkout_slope)
  // Y * (tan(slope) - tan(walkout_slope)) = -structure_height - setback*tan(walkout_slope)
  // Y = (-structure_height - setback*tan(walkout_slope)) / (tan(slope) - tan(walkout_slope))

  // The walkout extends in -Y direction from setback
  // Distance = setback - Y_intersection
  const tan_slope = Math.tan(slope_rad);
  const tan_walkout = Math.tan(walkout_slope_rad);

  let walkout_distance: number;
  if (Math.abs(tan_slope - tan_walkout) < EPSILON) {
    // Parallel slopes - walkout extends indefinitely
    walkout_distance = 50; // cap at reasonable value
  } else {
    const y_intersect = (-p.structure_height - p.setback * tan_walkout) / (tan_slope - tan_walkout);
    walkout_distance = p.setback - y_intersect;
    if (walkout_distance < 0) walkout_distance = 0;
    if (walkout_distance > 100) walkout_distance = 100; // cap
  }

  // Convergence Y = where cap center meets natural grade
  // Cap center is at Z = min_cover
  // Grade at Y: Z = Y * tan(slope)
  // Solve: min_cover = Y * tan(slope)
  // Y = min_cover / tan(slope)
  const convergence_y = p.min_cover / tan_slope;

  // Volume calculations
  const cut_volume = calculateCutVolume(p, walkout_distance, walkout_width);
  const fill_volume = calculateFillVolume(p, convergence_y, cap_clearance);
  const earth_balance = cut_volume - fill_volume;

  return {
    effective_burial,
    walkout_distance,
    walkout_width,
    cut_volume,
    fill_volume,
    earth_balance,
    convergence_y,
    cap_clearance,
    side_run,
  };
}

function calculateCutVolume(p: Params, walkout_dist: number, walkout_width: number): number {
  const slope_rad = degToRad(p.slope_angle);

  // Structure excavation: box with slanted top
  const grade_at_front = p.setback * Math.tan(slope_rad);
  const grade_at_back = (p.setback + p.structure_depth) * Math.tan(slope_rad);
  const avg_grade = (grade_at_front + grade_at_back) / 2;
  const structure_excavation = p.structure_width * p.structure_depth * (p.structure_height + avg_grade);

  // Walkout excavation: wedge shape
  // Front depth = structure_height + grade_at_front (dig from grade down to floor)
  // Actually, floor is at Z = -structure_height, grade at front is at Z = grade_at_front
  // So excavation depth at front = grade_at_front - (-structure_height) = grade_at_front + structure_height
  // At walkout end, excavation depth = 0 (floor meets grade)
  const front_excavation_depth = grade_at_front + p.structure_height;
  const walkout_excavation = 0.5 * walkout_width * walkout_dist * front_excavation_depth;

  // Convert to cubic yards
  return (structure_excavation + walkout_excavation) / 27;
}

function calculateFillVolume(p: Params, convergence_y: number, cap_clearance: number): number {
  if (cap_clearance <= 0) {
    // Cap is at or below grade at front - minimal fill
    return 0;
  }

  const slope_rad = degToRad(p.slope_angle);
  const cap_slope_rad = degToRad(p.cap_slope);
  const side_slope_rad = degToRad(p.side_slope);

  const cap_front_y = p.setback;
  const cap_back_y = p.setback + p.structure_depth + p.overhang;
  const cap_half_width = p.structure_width / 2 + p.overhang;

  // Numerical integration for berm volume above grade
  const dy = 0.5;
  const dx = 0.5;
  let volume = 0;

  for (let y = cap_front_y; y < cap_back_y && y < convergence_y + 10; y += dy) {
    const grade_z = y * Math.tan(slope_rad);

    for (let x = -cap_half_width; x < cap_half_width; x += dx) {
      // Cap Z at this x (slopes to sides from center ridge)
      const cap_z = p.min_cover - Math.abs(x) * Math.tan(cap_slope_rad);

      if (cap_z > grade_z + EPSILON) {
        // This column is above grade - count it
        const height = cap_z - grade_z;
        volume += height * dx * dy;
      }
    }
  }

  // Add side slope volumes (triangular prisms)
  // This is approximate - side slopes add volume outside the cap footprint
  const side_run = cap_clearance > 0 ? cap_clearance / Math.tan(side_slope_rad) : 0;
  const side_length = Math.min(cap_back_y, convergence_y) - cap_front_y;
  if (side_length > 0 && side_run > 0) {
    // Each side slope is roughly a triangular prism
    // Height at cap edge, goes to 0 at ground
    const side_vol = 0.5 * side_run * cap_clearance * side_length;
    volume += 2 * side_vol; // both sides
  }

  return volume / 27; // convert to cubic yards
}

// Create geometry meshes

export function createNaturalGradeMesh(p: Params): THREE.Mesh {
  const slope_rad = degToRad(p.slope_angle);
  const extent = 60;

  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    -extent, -20, -20 * Math.tan(slope_rad),
    extent, -20, -20 * Math.tan(slope_rad),
    extent, extent, extent * Math.tan(slope_rad),
    -extent, -20, -20 * Math.tan(slope_rad),
    extent, extent, extent * Math.tan(slope_rad),
    -extent, extent, extent * Math.tan(slope_rad),
  ]);
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x228b22,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

export function createStructureMesh(p: Params): THREE.Group {
  const group = new THREE.Group();

  // Wireframe box for structure
  const geometry = new THREE.BoxGeometry(p.structure_width, p.structure_depth, p.structure_height);
  const edges = new THREE.EdgesGeometry(geometry);
  const line = new THREE.LineSegments(
    edges,
    new THREE.LineBasicMaterial({ color: 0x4a9eff, linewidth: 2 })
  );

  // Position: center at (0, setback + depth/2, -height/2)
  // Front face at Y = setback, bottom at Z = -structure_height
  line.position.set(0, p.setback + p.structure_depth / 2, -p.structure_height / 2);
  group.add(line);

  // Semi-transparent fill
  const fillMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a9eff,
    transparent: true,
    opacity: 0.2,
  });
  const fill = new THREE.Mesh(geometry, fillMaterial);
  fill.position.copy(line.position);
  group.add(fill);

  return group;
}

export function createCapMesh(p: Params, outputs: CalculatedOutputs): THREE.Mesh | null {
  if (outputs.cap_clearance <= 0) return null;

  const cap_slope_rad = degToRad(p.cap_slope);
  const half_width = p.structure_width / 2 + p.overhang;
  const cap_front_y = p.setback;
  const cap_back_y = Math.min(p.setback + p.structure_depth + p.overhang, outputs.convergence_y);

  if (cap_back_y <= cap_front_y) return null;

  // Cap vertices: 4 corners at front, 4 at back
  // Z varies with X (drainage slope to sides)
  const z_center = p.min_cover;
  const z_edge = p.min_cover - half_width * Math.tan(cap_slope_rad);

  const vertices = new Float32Array([
    // Front face (Y = cap_front_y)
    -half_width, cap_front_y, z_edge,
    half_width, cap_front_y, z_edge,
    0, cap_front_y, z_center,
    // Back face (Y = cap_back_y)
    -half_width, cap_back_y, z_edge,
    half_width, cap_back_y, z_edge,
    0, cap_back_y, z_center,
  ]);

  const indices = new Uint16Array([
    // Left slope
    0, 2, 3,
    3, 2, 5,
    // Right slope
    2, 1, 5,
    5, 1, 4,
  ]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xcd853f,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

export function createSideSlopeMesh(p: Params, outputs: CalculatedOutputs, side: 'left' | 'right'): THREE.Mesh | null {
  if (outputs.cap_clearance <= 0 || outputs.side_run <= 0) return null;

  const slope_rad = degToRad(p.slope_angle);
  const cap_slope_rad = degToRad(p.cap_slope);
  const side_slope_rad = degToRad(p.side_slope);

  const sign = side === 'left' ? -1 : 1;
  const half_width = p.structure_width / 2 + p.overhang;
  const cap_front_y = p.setback;

  // Generate points along Y
  const num_segments = 20;
  const cap_back_y = Math.min(p.setback + p.structure_depth + p.overhang, outputs.convergence_y);

  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= num_segments; i++) {
    const t = i / num_segments;
    const y = cap_front_y + t * (cap_back_y - cap_front_y);
    const grade_z = y * Math.tan(slope_rad);

    // Cap edge at this Y
    const cap_x = sign * half_width;
    const cap_z = p.min_cover - half_width * Math.tan(cap_slope_rad);

    // Ground edge: where side slope hits grade
    const height_above_grade = cap_z - grade_z;
    if (height_above_grade <= 0) continue;

    const run = height_above_grade / Math.tan(side_slope_rad);
    const ground_x = cap_x + sign * run;
    const ground_z = grade_z;

    // Add vertices: cap edge, ground edge
    vertices.push(cap_x, y, cap_z);
    vertices.push(ground_x, y, ground_z);
  }

  // Create triangles between segments
  const num_points = vertices.length / 3;
  const num_quads = num_points / 2 - 1;

  for (let i = 0; i < num_quads; i++) {
    const tl = i * 2;
    const bl = i * 2 + 1;
    const tr = i * 2 + 2;
    const br = i * 2 + 3;

    if (side === 'left') {
      indices.push(tl, tr, bl);
      indices.push(bl, tr, br);
    } else {
      indices.push(tl, bl, tr);
      indices.push(bl, br, tr);
    }
  }

  if (vertices.length === 0) return null;

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

export function createFrontClosureMesh(p: Params, outputs: CalculatedOutputs, side: 'left' | 'right'): THREE.Mesh | null {
  if (outputs.cap_clearance <= 0 || outputs.side_run <= 0) return null;

  const slope_rad = degToRad(p.slope_angle);
  const cap_slope_rad = degToRad(p.cap_slope);
  const side_slope_rad = degToRad(p.side_slope);

  const sign = side === 'left' ? -1 : 1;
  const half_width = p.structure_width / 2 + p.overhang;
  const y = p.setback;
  const grade_z = y * Math.tan(slope_rad);

  // Three points of the triangle:
  // 1. Cap edge
  const cap_x = sign * half_width;
  const cap_z = p.min_cover - half_width * Math.tan(cap_slope_rad);

  // 2. Ground at side slope edge
  const height = cap_z - grade_z;
  if (height <= 0) return null;
  const run = height / Math.tan(side_slope_rad);
  const ground_x = cap_x + sign * run;

  // 3. Ground at cap edge x position
  const vertices = new Float32Array([
    cap_x, y, cap_z,
    ground_x, y, grade_z,
    cap_x, y, grade_z,
  ]);

  const indices = side === 'left'
    ? new Uint16Array([0, 2, 1])
    : new Uint16Array([0, 1, 2]);

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0xa0522d,
    side: THREE.DoubleSide,
  });

  return new THREE.Mesh(geometry, material);
}

export function createBackSlopeMesh(p: Params, _outputs: CalculatedOutputs): THREE.Mesh | null {
  const slope_rad = degToRad(p.slope_angle);
  const cap_slope_rad = degToRad(p.cap_slope);

  const half_width = p.structure_width / 2 + p.overhang;
  const cap_back_y = p.setback + p.structure_depth + p.overhang;

  // Generate back edge of cap and convergence line
  const num_segments = 20;
  const vertices: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= num_segments; i++) {
    const t = i / num_segments;
    const x = -half_width + t * 2 * half_width;

    // Cap back edge
    const cap_z = p.min_cover - Math.abs(x) * Math.tan(cap_slope_rad);

    // Convergence point (where this X column meets grade)
    const convergence_y = cap_z / Math.tan(slope_rad);
    const convergence_z = convergence_y * Math.tan(slope_rad);  // grade height at convergence

    // Only add if convergence is behind cap back
    if (convergence_y > cap_back_y) {
      vertices.push(x, cap_back_y, cap_z);
      vertices.push(x, convergence_y, convergence_z);  // descends to meet grade
    }
  }

  if (vertices.length < 6) return null;

  const num_points = vertices.length / 3;
  const num_quads = num_points / 2 - 1;

  for (let i = 0; i < num_quads; i++) {
    const tl = i * 2;
    const bl = i * 2 + 1;
    const tr = i * 2 + 2;
    const br = i * 2 + 3;

    indices.push(tl, bl, tr);
    indices.push(bl, br, tr);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  const material = new THREE.MeshStandardMaterial({
    color: 0x8b4513,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
  });

  return new THREE.Mesh(geometry, material);
}

export function createWalkoutMesh(p: Params, outputs: CalculatedOutputs): THREE.Group {
  const group = new THREE.Group();
  const slope_rad = degToRad(p.slope_angle);
  const walkout_slope_rad = degToRad(p.walkout_slope);

  const front_y = p.setback;
  const end_y = p.setback - outputs.walkout_distance;
  const floor_z_front = -p.structure_height;
  const floor_z_end = floor_z_front - outputs.walkout_distance * Math.tan(walkout_slope_rad);

  // Walkout is a rectangle - constant width from front to end
  // Width matches berm footprint at front (structure + overhang + side_run)
  const half_width = outputs.walkout_width / 2;

  // Floor - rectangle, not trapezoid
  const floorGeo = new THREE.BufferGeometry();
  const floorVerts = new Float32Array([
    -half_width, front_y, floor_z_front,
    half_width, front_y, floor_z_front,
    half_width, end_y, floor_z_end,
    -half_width, front_y, floor_z_front,
    half_width, end_y, floor_z_end,
    -half_width, end_y, floor_z_end,
  ]);
  floorGeo.setAttribute('position', new THREE.BufferAttribute(floorVerts, 3));
  floorGeo.computeVertexNormals();

  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x808080,
    side: THREE.DoubleSide,
  });
  group.add(new THREE.Mesh(floorGeo, floorMat));

  // Side walls (vertical cut faces, constant X position)
  const createSideWall = (sign: number) => {
    const hw = sign * half_width;
    const grade_front = front_y * Math.tan(slope_rad);
    const grade_end = end_y * Math.tan(slope_rad);

    // Vertical wall from floor to grade, parallel sides
    const verts = new Float32Array([
      hw, front_y, floor_z_front,
      hw, front_y, grade_front,
      hw, end_y, grade_end,
      hw, front_y, floor_z_front,
      hw, end_y, grade_end,
      hw, end_y, floor_z_end,
    ]);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0x654321,
      side: THREE.DoubleSide,
    });

    return new THREE.Mesh(geo, mat);
  };

  group.add(createSideWall(-1));
  group.add(createSideWall(1));

  return group;
}
