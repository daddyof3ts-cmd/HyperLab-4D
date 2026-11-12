export const VERTEX_SHADER_SOURCE = `
  attribute vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

export const FRAGMENT_SHADER_SOURCE = `
  precision highp float;

  uniform vec2 uResolution;
  uniform float uTime;

  // 4D Julia Constant
  uniform vec4 uJuliaC;

  // 4D Slicing & 6-Plane Rotation
  uniform float uWSlice;
  uniform float uRotXW;
  uniform float uRotYW;
  uniform float uRotZW;

  // 3D Camera Orbit
  uniform float uCamYaw;
  uniform float uCamPitch;
  uniform float uCamDist;

  // Fractal & Optics
  uniform float uIter;
  uniform float uSpiral;
  uniform float uAOStrength;
  uniform float uGlow;
  uniform float uPalette;
  uniform float uDriftTime;

  // Live Audio Bands (0..1)
  uniform float uAudioBass;
  uniform float uAudioMid;
  uniform float uAudioHigh;

  mat2 rot2(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  vec4 qSq(vec4 a) {
    return vec4(
      a.x * a.x - a.y * a.y - a.z * a.z - a.w * a.w,
      2.0 * a.x * a.y,
      2.0 * a.x * a.z,
      2.0 * a.x * a.w
    );
  }

  // Smooth spiral perturbation in 4D parameter space
  vec4 getSpiralOffset(float t) {
    float cycle = sin(t * 1.4);
    float evo = t * 0.22;
    return vec4(
      cos(evo) * cycle * 0.14,
      sin(evo) * cycle * 0.14,
      cos(evo * 0.7) * 0.08,
      sin(evo * 1.3) * 0.08
    );
  }

  // Distance Estimator + Orbit Trap accumulator
  float map(vec3 p, out vec4 trap) {
    // Embed 3D sample into 4D hyperplane at w = uWSlice + subtle audio breathing
    float wOffset = uWSlice + uAudioBass * 0.06 * sin(uTime * 2.0);
    vec4 z = vec4(p, wOffset);

    // Rotate in 4D XW, YW, ZW planes
    float drift = uDriftTime;
    z.xw *= rot2(uRotXW + drift * 0.35);
    z.yw *= rot2(uRotYW + drift * 0.22);
    z.zw *= rot2(uRotZW);

    float torque = uSpiral + uAudioMid * 0.45;
    vec4 c = uJuliaC + getSpiralOffset(uTime) * torque;

    float dr = 1.0;
    float r = length(z);

    trap = vec4(1e6);

    for (int i = 0; i < 14; i++) {
      if (float(i) >= uIter) break;
      if (r > 4.0) break;

      dr = 2.0 * r * dr;
      z = qSq(z) + c;
      r = length(z);

      trap.x = min(trap.x, r);
      trap.y = min(trap.y, abs(z.w));
      trap.z = min(trap.z, length(z.xy));
      trap.w = min(trap.w, abs(r - 0.85));
    }

    r = max(r, 1e-6);
    if (r <= 1.0) {
      return 0.0;
    }
    return 0.32 * log(r) * r / max(dr, 1e-6);
  }

  float mapDist(vec3 p) {
    vec4 unused;
    return map(p, unused);
  }

  vec3 calcNormal(vec3 p) {
    vec2 e = vec2(0.0022, 0.0);
    return normalize(vec3(
      mapDist(p + e.xyy) - mapDist(p - e.xyy),
      mapDist(p + e.yxy) - mapDist(p - e.yxy),
      mapDist(p + e.yyx) - mapDist(p - e.yyx)
    ));
  }

  float calcAO(vec3 pos, vec3 nor) {
    float occ = 0.0;
    float sca = 1.0;
    for (int i = 0; i < 5; i++) {
      float h = 0.015 + 0.045 * float(i);
      float d = mapDist(pos + h * nor);
      occ += (h - d) * sca;
      sca *= 0.72;
    }
    return clamp(1.0 - 2.6 * occ, 0.0, 1.0);
  }

  float calcSoftShadow(vec3 ro, vec3 rd) {
    float res = 1.0;
    float t = 0.02;
    for (int i = 0; i < 20; i++) {
      float h = mapDist(ro + rd * t);
      if (h < 0.001) return 0.15;
      res = min(res, 10.0 * h / t);
      t += clamp(h, 0.02, 0.25);
      if (t > 2.5) break;
    }
    return clamp(res, 0.15, 1.0);
  }

  vec3 getPaletteColor(vec4 trap, float fresnel, float paletteIdx) {
    float t1 = clamp(trap.x * 1.4, 0.0, 1.0);
    float t2 = clamp(trap.y * 2.5, 0.0, 1.0);
    float t3 = clamp(trap.z * 1.8, 0.0, 1.0);

    // 0: Dichroic Obsidian (Deep space dark + cyan/indigo/amber edge refraction)
    vec3 c0 = mix(vec3(0.04, 0.07, 0.14), vec3(0.05, 0.68, 0.85), 1.0 - t1);
    c0 = mix(c0, vec3(0.96, 0.62, 0.12), pow(1.0 - t2, 2.5) * 0.65);
    c0 += vec3(0.22, 0.85, 0.98) * pow(fresnel, 3.0) * 0.55;

    // 1: Plasma Corona (Volcanic obsidian + magenta/solar orange/cyan)
    vec3 c1 = mix(vec3(0.10, 0.02, 0.16), vec3(0.95, 0.28, 0.18), 1.0 - t1);
    c1 = mix(c1, vec3(1.0, 0.78, 0.25), pow(1.0 - t3, 2.0) * 0.7);
    c1 += vec3(0.85, 0.35, 0.95) * pow(fresnel, 2.6) * 0.65;

    // 2: Bioluminescent Reef (Deep abyssal slate + emerald/teal/ice)
    vec3 c2 = mix(vec3(0.02, 0.09, 0.11), vec3(0.08, 0.82, 0.64), 1.0 - t1);
    c2 = mix(c2, vec3(0.55, 0.96, 0.92), pow(1.0 - t2, 2.2) * 0.6);
    c2 += vec3(0.15, 0.95, 0.75) * pow(fresnel, 2.8) * 0.5;

    // 3: Chromatic Silver (Precision machined platinum + crisp Fresnel prism)
    vec3 c3 = mix(vec3(0.14, 0.16, 0.20), vec3(0.82, 0.86, 0.92), 1.0 - t1);
    c3 = mix(c3, vec3(0.42, 0.52, 0.65), t2 * 0.45);
    c3 += vec3(0.75, 0.90, 1.0) * pow(fresnel, 2.4) * 0.5;

    if (paletteIdx < 0.5) return c0;
    if (paletteIdx < 1.5) return c1;
    if (paletteIdx < 2.5) return c2;
    return c3;
  }

  void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;

    // 3D Orbit Camera around origin
    float dist = clamp(uCamDist - uAudioBass * 0.12, 1.15, 6.0);
    float cp = cos(uCamPitch);
    vec3 ro = vec3(
      dist * cp * sin(uCamYaw),
      dist * sin(uCamPitch),
      dist * cp * cos(uCamYaw)
    );

    vec3 target = vec3(0.0);
    vec3 forward = normalize(target - ro);
    vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));
    vec3 up = cross(right, forward);

    float fov = 1.15 + uAudioBass * 0.05;
    vec3 rd = normalize(uv.x * right + uv.y * up + fov * forward);

    // Subtle deep-space obsidian background gradient
    vec3 bg = mix(vec3(0.015, 0.022, 0.038), vec3(0.04, 0.06, 0.10), clamp(uv.y * 0.5 + 0.5, 0.0, 1.0));
    float vignette = 1.0 - 0.35 * dot(uv, uv);
    bg *= vignette;

    // Single-pass Sphere-Assisted Raymarching
    float t = 0.0;
    float maxDist = 7.5;
    vec4 trap = vec4(1.0);
    float glowAccum = 0.0;
    float minDist = 1e6;
    bool hit = false;

    for (int i = 0; i < 88; i++) {
      vec3 p = ro + rd * t;
      float d = map(p, trap);

      minDist = min(minDist, d);
      glowAccum += exp(-12.0 * max(d, 0.0)) * 0.032;

      if (d < 0.0012) {
        hit = true;
        break;
      }
      if (t > maxDist) break;

      // Bounding-sphere acceleration when outside radius 2.2
      float rLen = length(p);
      float stepD = d * 0.85;
      if (rLen > 2.2) {
        stepD = max(stepD, rLen - 2.0);
      }
      t += stepD;
    }

    vec3 col = bg;
    float dispersion = uSpiral * 0.45 + uAudioHigh * 0.55;

    if (hit) {
      vec3 pos = ro + rd * t;
      vec3 nor = calcNormal(pos);
      vec3 viewDir = -rd;
      float fresnel = pow(1.0 - max(dot(nor, viewDir), 0.0), 3.0);

      // Three-Point Studio Lighting
      vec3 keyDir = normalize(vec3(0.65, 0.85, 0.45));
      vec3 fillDir = normalize(vec3(-0.7, -0.35, 0.5));

      float shadow = calcSoftShadow(pos + nor * 0.005, keyDir);
      float ao = mix(1.0, calcAO(pos, nor), uAOStrength);

      float keyDiff = max(dot(nor, keyDir), 0.0) * shadow;
      float fillDiff = max(dot(nor, fillDir), 0.0) * 0.35;
      float hemi = 0.5 + 0.5 * nor.y;

      vec3 halfVec = normalize(keyDir + viewDir);
      float spec = pow(max(dot(nor, halfVec), 0.0), 36.0) * shadow;

      vec3 baseMat = getPaletteColor(trap, fresnel, uPalette);

      // Optical Chromatic Dispersion along surface refraction / normal shift
      if (dispersion > 0.01) {
        vec4 trapR;
        vec4 trapB;
        float shift = 0.025 * dispersion;
        map(pos + nor * shift, trapR);
        map(pos - nor * shift, trapB);
        vec3 colR = getPaletteColor(trapR, fresnel, uPalette);
        vec3 colB = getPaletteColor(trapB, fresnel, uPalette);
        baseMat = vec3(
          mix(baseMat.r, colR.r * 1.25, 0.65 * dispersion),
          baseMat.g,
          mix(baseMat.b, colB.b * 1.25, 0.65 * dispersion)
        );
        // Subtle spectral rim iridescence
        baseMat += dispersion * fresnel * vec3(
          0.5 + 0.5 * cos(6.28 * trap.x + 0.0),
          0.5 + 0.5 * cos(6.28 * trap.x + 2.1),
          0.5 + 0.5 * cos(6.28 * trap.x + 4.2)
        ) * 0.45;
      }

      vec3 lighting =
        baseMat * (keyDiff * 1.15 + fillDiff * vec3(0.45, 0.72, 1.0) + hemi * 0.22 * ao) +
        vec3(0.95, 0.98, 1.0) * spec * 0.75;

      col = lighting * ao;

      // Distance fog blending smoothly into deep obsidian
      float fog = 1.0 - exp(-0.045 * t * t);
      col = mix(col, bg, clamp(fog, 0.0, 0.65));
    }

    // Volumetric Corona / Halo Glow
    vec3 glowTint = vec3(0.08, 0.72, 0.92);
    if (uPalette > 0.5 && uPalette < 1.5) glowTint = vec3(0.98, 0.42, 0.18);
    else if (uPalette >= 1.5 && uPalette < 2.5) glowTint = vec3(0.12, 0.92, 0.68);
    else if (uPalette >= 2.5) glowTint = vec3(0.68, 0.82, 1.0);

    float glowStrength = uGlow * (0.65 + uAudioBass * 0.85 + uAudioHigh * 0.45);
    col += glowTint * glowAccum * glowStrength;

    // Spectral aura dispersion fringe when Torque / Highs are active
    if (dispersion > 0.02 && !hit) {
      float aura = exp(-6.5 * minDist) * dispersion * 0.35;
      col += aura * vec3(
        0.5 + 0.5 * sin(uTime + uv.x * 4.0),
        0.5 + 0.5 * sin(uTime + uv.y * 4.0 + 2.0),
        0.5 + 0.5 * sin(uTime + (uv.x + uv.y) * 3.0 + 4.0)
      );
    }

    // ACES Filmic Tone Mapping + Gamma
    col = (col * (2.51 * col + 0.03)) / (col * (2.43 * col + 0.59) + 0.14);
    col = pow(clamp(col, 0.0, 1.0), vec3(1.0 / 2.2));

    gl_FragColor = vec4(col, 1.0);
  }
`;