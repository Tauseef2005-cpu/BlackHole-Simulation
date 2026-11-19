#version 430 core

layout (location = 0) out vec4 FragColor;
layout (location = 1) out vec4 BrightColor;

in vec2 v_TexCoord;

// Camera & Resolution
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_camPos;
uniform vec3 u_camTarget;
uniform mat4 u_view;
uniform mat4 u_projection;
uniform float u_fov;

// Black Hole Parameters
uniform float u_mass;
uniform float u_spin;
uniform float u_rs;
uniform float u_r_photon;
uniform float u_r_isco;

// Accretion Disk Parameters
uniform float u_diskInnerRadius;
uniform float u_diskOuterRadius;
uniform float u_diskThickness;
uniform float u_diskBrightness;
uniform float u_diskTemperature;
uniform float u_diskTurbulence;
uniform float u_diskDensity;
uniform float u_diskTime;

// Relativistic Effects & Ray Marching
uniform float u_dopplerEffect;
uniform float u_gravitationalLensing;
uniform float u_photonRingIntensity;
uniform float u_gravitationalDistortion;
uniform int u_maxRaySteps;
uniform float u_bloomThreshold;

// Environment & Rendering
uniform float u_starDensity;
uniform float u_nebulaIntensity;
uniform float u_backgroundBrightness;

#define PI 3.14159265359

// --- Ultra-Fast Hash & Noise Functions ---
float hash13(vec3 p3) {
    p3  = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

float fastNoise3D(vec3 p) {
    vec3 i = floor(p);
    vec3 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);

    float n000 = hash13(i);
    float n100 = hash13(i + vec3(1,0,0));
    float n010 = hash13(i + vec3(0,1,0));
    float n110 = hash13(i + vec3(1,1,0));
    float n001 = hash13(i + vec3(0,0,1));
    float n101 = hash13(i + vec3(1,0,1));
    float n011 = hash13(i + vec3(0,1,1));
    float n111 = hash13(i + vec3(1,1,1));

    return mix(mix(mix(n000, n100, f.x), mix(n010, n110, f.x), f.y),
               mix(mix(n001, n101, f.x), mix(n011, n111, f.x), f.y), f.z);
}

// Temperature Color Gradient (White-hot inner -> Yellow -> Orange -> Dark Red)
vec3 getDiskColor(float normR, float tempMult) {
    float t = clamp(normR, 0.0, 1.0);
    float temp = (1.0 - t * 0.85) * tempMult;

    vec3 darkRed   = vec3(0.40, 0.04, 0.01);
    vec3 orangeRed = vec3(1.00, 0.28, 0.02);
    vec3 yellow    = vec3(1.20, 0.75, 0.10);
    vec3 whiteHot  = vec3(3.20, 2.80, 2.20);

    if (temp < 0.35) return mix(darkRed, orangeRed, temp / 0.35);
    if (temp < 0.75) return mix(orangeRed, yellow, (temp - 0.35) / 0.40);
    return mix(yellow, whiteHot, (temp - 0.75) / 0.25);
}

// Deep Space Starfield
vec3 getSkyColor(vec3 rayDir) {
    vec3 dir = normalize(rayDir);
    vec3 background = vec3(0.008, 0.012, 0.028) * u_nebulaIntensity;

    vec3 grid = floor(dir * 240.0 * u_starDensity);
    float starHash = hash13(grid);

    if (starHash > 0.994) {
        float starIntensity = pow((starHash - 0.994) / 0.006, 4.0) * 2.5;
        vec3 starColor = mix(vec3(0.7, 0.85, 1.0), vec3(1.0, 0.9, 0.75), hash13(grid + 2.0));
        background += starColor * starIntensity;
    }

    return background * u_backgroundBrightness;
}

// Fast Disk Sample
vec4 sampleDiskEmission(vec3 pos, vec3 rayVel) {
    float r = length(pos);
    float r_isco = u_diskInnerRadius;
    float r_outer = u_diskOuterRadius;

    if (r < r_isco || r > r_outer) {
        return vec4(0.0);
    }

    float normR = (r - r_isco) / (r_outer - r_isco);

    // Compute radial and vertical envelope FIRST before expensive 3D noise!
    float radialProfile = sin(normR * PI) * exp(-1.2 * normR);
    float distFromPlane = abs(pos.y);
    float maxH = u_diskThickness * exp(- normR * 1.5);
    float verticalProfile = exp(-4.0 * (distFromPlane / maxH) * (distFromPlane / maxH));
    float profileFactor = radialProfile * verticalProfile;

    if (profileFactor < 0.002) return vec4(0.0);

    // Differential orbital rotation
    float angle = atan(pos.z, pos.x);
    float keplerSpeed = (1.8 / pow(r, 0.75)) * u_diskTime;
    float rotAngle = angle - keplerSpeed;

    vec3 noisePos = vec3(r * cos(rotAngle), pos.y * 3.5, r * sin(rotAngle)) * u_diskTurbulence;
    float noiseVal = fastNoise3D(noisePos);

    float density = noiseVal * profileFactor * u_diskDensity;
    if (density < 0.01) return vec4(0.0);

    vec3 baseColor = getDiskColor(normR, u_diskTemperature);

    // Relativistic Doppler Boosting
    vec3 gasVelocity = normalize(vec3(-pos.z, 0.0, pos.x));
    float v_gas = clamp(0.48 * sqrt(u_rs / r), 0.05, 0.72);
    float cosTheta = dot(gasVelocity, normalize(rayVel));

    float gamma = 1.0 / sqrt(max(0.01, 1.0 - v_gas * v_gas));
    float dopplerFactor = 1.0 / (gamma * (1.0 - v_gas * cosTheta * u_dopplerEffect));

    float gravRedshift = sqrt(max(0.01, 1.0 - u_rs / r));
    float totalShift = dopplerFactor * gravRedshift;

    vec3 emission = baseColor * pow(totalShift, 3.5) * u_diskBrightness;
    if (totalShift > 1.15) {
        emission += vec3(0.4, 0.8, 1.6) * (totalShift - 1.15) * u_diskBrightness;
    }

    return vec4(emission, density);
}

void main() {
    // 1. Setup Camera Ray
    vec2 ndc = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    ndc.x *= (u_resolution.x / u_resolution.y);

    float tanHalfFov = tan(radians(u_fov * 0.5));
    vec3 rayDirLocal = normalize(vec3(ndc.x * tanHalfFov, ndc.y * tanHalfFov, -1.0));

    mat3 invViewRot = mat3(inverse(u_view));
    vec3 rayDir = normalize(invViewRot * rayDirLocal);
    vec3 rayPos = u_camPos;

    // --- Ultra-Fast Early Exit Bounding Check ---
    float perpDist = length(cross(rayPos, rayDir));
    float dotToCenter = dot(-rayPos, rayDir);
    if ((perpDist > max(u_diskOuterRadius * 1.35, 18.0) && dotToCenter < 0.0) ||
        (perpDist > max(u_diskOuterRadius * 2.2, 28.0))) {
        vec3 skyColor = getSkyColor(rayDir);
        FragColor = vec4(skyColor, 1.0);
        float bright = dot(skyColor, vec3(0.2126, 0.7152, 0.0722));
        BrightColor = vec4(bright > u_bloomThreshold ? skyColor : vec3(0.0), 1.0);
        return;
    }

    // 2. High-FPS 2-Stage Ray Marching Engine
    vec3 accumulatedColor = vec3(0.0);
    float accumulatedOpacity = 0.0;
    float minDistanceToBH = 1e6;

    float rs = u_rs;
    float r_photon = u_r_photon;

    vec3 currentPos = rayPos;
    vec3 currentVel = rayDir;
    vec3 prevPos = currentPos;

    int steps = u_maxRaySteps;

    for (int i = 0; i < steps; i++) {
        float r2 = dot(currentPos, currentPos);
        float r = sqrt(r2);
        minDistanceToBH = min(minDistanceToBH, r);

        // Horizon hit check
        if (r <= rs * 1.005) {
            accumulatedOpacity = 1.0;
            break;
        }

        // Escape check
        if (r > 38.0 && dot(currentVel, currentPos) > 0.0) {
            break;
        }

        // Adaptive Coarse-to-Fine Step Size (Ultra Smooth 120+ FPS)
        float stepSize = max(0.08, 0.14 * (r - rs));
        if (abs(currentPos.y) < u_diskThickness * 2.2 && r < u_diskOuterRadius * 1.15) {
            stepSize = min(stepSize, 0.08); // Fine steps near disk plane
        } else if (r > 10.0) {
            stepSize = min(stepSize, 0.25 * r); // Larger steps when far away
        }

        // Accretion Disk Ray-Plane Sampling
        if (prevPos.y * currentPos.y <= 0.0 && abs(prevPos.y - currentPos.y) > 1e-5) {
            float t = -prevPos.y / (currentPos.y - prevPos.y);
            vec3 hitPos = mix(prevPos, currentPos, t);
            
            vec4 diskSample = sampleDiskEmission(hitPos, currentVel);
            if (diskSample.a > 0.001) {
                float alpha = clamp(diskSample.a * 1.4, 0.0, 0.95);
                accumulatedColor += (1.0 - accumulatedOpacity) * diskSample.rgb * alpha;
                accumulatedOpacity += (1.0 - accumulatedOpacity) * alpha;
            }
        }
        else if (abs(currentPos.y) <= u_diskThickness * 1.2) {
            vec4 diskSample = sampleDiskEmission(currentPos, currentVel);
            if (diskSample.a > 0.001) {
                float alpha = 1.0 - exp(-diskSample.a * stepSize * 2.0);
                accumulatedColor += (1.0 - accumulatedOpacity) * diskSample.rgb * alpha;
                accumulatedOpacity += (1.0 - accumulatedOpacity) * alpha;
            }
        }

        if (accumulatedOpacity >= 0.98) {
            break;
        }

        // Relativistic Light Bending (Only active near Black Hole)
        if (r < 22.0) {
            vec3 L = cross(currentPos, currentVel);
            float L2 = dot(L, L);
            float r5 = r2 * r2 * r;
            vec3 accel = -(1.5 * rs * L2 / r5) * currentPos * u_gravitationalLensing;

            if (abs(u_spin) > 0.01) {
                vec3 spinVec = vec3(0.0, u_spin, 0.0);
                vec3 drag = (2.0 * u_mass * u_spin / (r2 * r)) * cross(spinVec, currentVel);
                accel += drag * u_gravitationalLensing;
            }

            currentVel = normalize(currentVel + accel * stepSize * u_gravitationalDistortion);
        }

        prevPos = currentPos;
        currentPos += currentVel * stepSize;
    }

    // 3. Thin White-Hot Photon Ring
    if (minDistanceToBH > rs && minDistanceToBH < r_photon * 1.30) {
        float distToSphere = abs(minDistanceToBH - r_photon);
        float ringWidth = 0.06 * rs;
        float photonGlow = exp(- (distToSphere * distToSphere) / (ringWidth * ringWidth)) * u_photonRingIntensity;
        vec3 photonRingColor = vec3(3.5, 3.0, 2.2) * photonGlow;
        accumulatedColor += (1.0 - accumulatedOpacity) * photonRingColor;
    }

    // 4. Background Sky
    if (accumulatedOpacity < 1.0) {
        vec3 skyColor = getSkyColor(currentVel);
        accumulatedColor += (1.0 - accumulatedOpacity) * skyColor;
    }

    // 5. Outputs
    FragColor = vec4(accumulatedColor, 1.0);

    float brightness = dot(accumulatedColor, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > u_bloomThreshold) {
        BrightColor = vec4(accumulatedColor, 1.0);
    } else {
        BrightColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
