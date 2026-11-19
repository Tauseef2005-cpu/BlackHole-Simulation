/**
 * Photorealistic 3D Relativistic Black Hole Simulation (WebGL 2.0)
 * Geodesic Ray Marching, Volumetric Accretion Disk, Doppler Boosting, Lensing, HDR Bloom & ACES Tone Mapping.
 */

// --- Shaders ---
const vsQuad = `#version 300 es
in vec2 a_position;
out vec2 v_texCoord;
void main() {
    v_texCoord = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const fsBlackHole = `#version 300 es
precision highp float;

layout(location = 0) out vec4 FragColor;
layout(location = 1) out vec4 BrightColor;

in vec2 v_texCoord;

// Uniforms
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_camPos;
uniform mat3 u_invViewRot;
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

// Relativistic Effects
uniform float u_dopplerEffect;
uniform float u_gravitationalLensing;
uniform float u_photonRingIntensity;
uniform float u_gravitationalDistortion;
uniform int u_maxRaySteps;
uniform float u_bloomThreshold;

// Environment
uniform float u_starDensity;
uniform float u_nebulaIntensity;
uniform float u_backgroundBrightness;

#define PI 3.14159265359

// Fast Hash & Noise
float hash13(vec3 p3) {
    p3 = fract(p3 * 0.1031);
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

// Temperature Color Ramp
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

// Starfield Sky
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

// Disk Sample
vec4 sampleDiskEmission(vec3 pos, vec3 rayVel) {
    float r = length(pos);
    float r_isco = u_diskInnerRadius;
    float r_outer = u_diskOuterRadius;

    if (r < r_isco || r > r_outer) return vec4(0.0);

    float normR = (r - r_isco) / (r_outer - r_isco);
    float radialProfile = sin(normR * PI) * exp(-1.2 * normR);
    float distFromPlane = abs(pos.y);
    float maxH = u_diskThickness * exp(- normR * 1.5);
    float verticalProfile = exp(-4.0 * (distFromPlane / maxH) * (distFromPlane / maxH));
    float profileFactor = radialProfile * verticalProfile;

    if (profileFactor < 0.002) return vec4(0.0);

    float angle = atan(pos.z, pos.x);
    float keplerSpeed = (1.8 / pow(r, 0.75)) * u_diskTime;
    float rotAngle = angle - keplerSpeed;

    vec3 noisePos = vec3(r * cos(rotAngle), pos.y * 3.5, r * sin(rotAngle)) * u_diskTurbulence;
    float noiseVal = fastNoise3D(noisePos);

    float density = noiseVal * profileFactor * u_diskDensity;
    if (density < 0.01) return vec4(0.0);

    vec3 baseColor = getDiskColor(normR, u_diskTemperature);

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
    vec2 ndc = (gl_FragCoord.xy / u_resolution.xy) * 2.0 - 1.0;
    ndc.x *= (u_resolution.x / u_resolution.y);

    float tanHalfFov = tan(radians(u_fov * 0.5));
    vec3 rayDirLocal = normalize(vec3(ndc.x * tanHalfFov, ndc.y * tanHalfFov, -1.0));
    vec3 rayDir = normalize(u_invViewRot * rayDirLocal);
    vec3 rayPos = u_camPos;

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

    vec3 accumulatedColor = vec3(0.0);
    float accumulatedOpacity = 0.0;
    float minDistanceToBH = 1e6;

    float rs = u_rs;
    float r_photon = u_r_photon;

    vec3 currentPos = rayPos;
    vec3 currentVel = rayDir;
    vec3 prevPos = currentPos;

    int steps = u_maxRaySteps;

    for (int i = 0; i < 192; i++) {
        if (i >= steps) break;

        float r2 = dot(currentPos, currentPos);
        float r = sqrt(r2);
        minDistanceToBH = min(minDistanceToBH, r);

        if (r <= rs * 1.005) {
            accumulatedOpacity = 1.0;
            break;
        }

        if (r > 38.0 && dot(currentVel, currentPos) > 0.0) {
            break;
        }

        float stepSize = max(0.08, 0.14 * (r - rs));
        if (abs(currentPos.y) < u_diskThickness * 2.2 && r < u_diskOuterRadius * 1.15) {
            stepSize = min(stepSize, 0.08);
        } else if (r > 10.0) {
            stepSize = min(stepSize, 0.25 * r);
        }

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

        if (accumulatedOpacity >= 0.98) break;

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

    if (minDistanceToBH > rs && minDistanceToBH < r_photon * 1.30) {
        float distToSphere = abs(minDistanceToBH - r_photon);
        float ringWidth = 0.06 * rs;
        float photonGlow = exp(- (distToSphere * distToSphere) / (ringWidth * ringWidth)) * u_photonRingIntensity;
        vec3 photonRingColor = vec3(3.5, 3.0, 2.2) * photonGlow;
        accumulatedColor += (1.0 - accumulatedOpacity) * photonRingColor;
    }

    if (accumulatedOpacity < 1.0) {
        vec3 skyColor = getSkyColor(currentVel);
        accumulatedColor += (1.0 - accumulatedOpacity) * skyColor;
    }

    FragColor = vec4(accumulatedColor, 1.0);

    float brightness = dot(accumulatedColor, vec3(0.2126, 0.7152, 0.0722));
    if (brightness > u_bloomThreshold) {
        BrightColor = vec4(accumulatedColor, 1.0);
    } else {
        BrightColor = vec4(0.0, 0.0, 0.0, 1.0);
    }
}
`;

const fsBloom = `#version 300 es
precision highp float;
out vec4 FragColor;
in vec2 v_texCoord;

uniform sampler2D u_image;
uniform bool u_horizontal;

const float weight[5] = float[](0.227027, 0.1945946, 0.1216216, 0.054054, 0.016216);

void main() {
    vec2 tex_offset = 1.0 / vec2(textureSize(u_image, 0));
    vec3 result = texture(u_image, v_texCoord).rgb * weight[0];
    if(u_horizontal) {
        for(int i = 1; i < 5; ++i) {
            result += texture(u_image, v_texCoord + vec2(tex_offset.x * float(i), 0.0)).rgb * weight[i];
            result += texture(u_image, v_texCoord - vec2(tex_offset.x * float(i), 0.0)).rgb * weight[i];
        }
    } else {
        for(int i = 1; i < 5; ++i) {
            result += texture(u_image, v_texCoord + vec2(0.0, tex_offset.y * float(i))).rgb * weight[i];
            result += texture(u_image, v_texCoord - vec2(0.0, tex_offset.y * float(i))).rgb * weight[i];
        }
    }
    FragColor = vec4(result, 1.0);
}
`;

const fsComposite = `#version 300 es
precision highp float;
out vec4 FragColor;
in vec2 v_texCoord;

uniform sampler2D u_hdrScene;
uniform sampler2D u_bloomBlur;
uniform float u_bloomIntensity;

vec3 acesFilmic(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec3 hdrColor = texture(u_hdrScene, v_texCoord).rgb;
    vec3 bloomColor = texture(u_bloomBlur, v_texCoord).rgb;
    
    vec3 color = hdrColor + bloomColor * u_bloomIntensity;
    vec3 mapped = acesFilmic(color);
    mapped = pow(mapped, vec3(1.0 / 2.2)); // Gamma correction

    FragColor = vec4(mapped, 1.0);
}
`;

// --- Simulation State ---
const state = {
    // Black Hole
    mass: 1.0,
    spin: 0.85,
    rotationSpeed: 1.0,

    // Accretion Disk
    innerRadiusRatio: 1.0,
    outerRadius: 14.0,
    thickness: 0.35,
    brightness: 2.2,
    temperature: 1.0,
    turbulence: 1.0,
    density: 1.0,
    dopplerStrength: 1.0,
    diskTime: 0.0,

    // Relativistic & Rendering
    gravitationalLensing: 1.0,
    photonRingIntensity: 2.5,
    gravitationalDistortion: 1.0,
    dopplerEffect: 1.0,
    maxRaySteps: 48,
    bloomThreshold: 1.2,
    bloomIntensity: 1.5,
    starDensity: 1.0,
    nebulaIntensity: 1.0,
    backgroundBrightness: 1.0,

    // Controls
    timeScale: 1.0,
    isPaused: false,
    showUI: true,

    // Camera Orbit matching original C++ Camera
    camDist: 11.5,
    targetDist: 11.5,
    yaw: -90.0,
    targetYaw: -90.0,
    pitch: -8.0,
    targetPitch: -8.0,
    fov: 45.0,

    // Performance tracking
    fps: 60,
    frameTime: 16.6
};

// --- WebGL Engine Class ---
class WebGLBlackHoleEngine {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = canvas.getContext('webgl2');

        if (!this.gl) {
            alert('WebGL 2.0 is not supported by your browser.');
            return;
        }

        const extColorBufferFloat = this.gl.getExtension('EXT_color_buffer_float');
        this.supportsFloat = !!extColorBufferFloat;

        this.initShaders();
        this.initQuad();
        this.initFramebuffers();

        this.lastTime = performance.now();
        this.totalTime = 0;
        this.frameCount = 0;
        this.fpsTime = 0;
    }

    createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.error('Shader compilation error:', gl.getShaderInfoLog(shader));
            gl.deleteShader(shader);
            return null;
        }
        return shader;
    }

    createProgram(gl, vsSource, fsSource) {
        const vs = this.createShader(gl, gl.VERTEX_SHADER, vsSource);
        const fs = this.createShader(gl, gl.FRAGMENT_SHADER, fsSource);
        const program = gl.createProgram();

        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            console.error('Program linking error:', gl.getProgramInfoLog(program));
            return null;
        }
        return program;
    }

    initShaders() {
        const gl = this.gl;
        this.progBH = this.createProgram(gl, vsQuad, fsBlackHole);
        this.progBloom = this.createProgram(gl, vsQuad, fsBloom);
        this.progComposite = this.createProgram(gl, vsQuad, fsComposite);
    }

    initQuad() {
        const gl = this.gl;
        const quadVertices = new Float32Array([
            -1,  1,
            -1, -1,
             1, -1,
            -1,  1,
             1, -1,
             1,  1
        ]);

        this.quadVAO = gl.createVertexArray();
        gl.bindVertexArray(this.quadVAO);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, quadVertices, gl.STATIC_DRAW);

        gl.enableVertexAttribArray(0);
        gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

        gl.bindVertexArray(null);
    }

    initFramebuffers() {
        const gl = this.gl;
        const w = this.canvas.width || 1280;
        const h = this.canvas.height || 720;

        // Texture format
        const internalFormat = this.supportsFloat ? gl.RGBA16F : gl.RGBA8;
        const type = this.supportsFloat ? gl.HALF_FLOAT : gl.UNSIGNED_BYTE;

        // 1. HDR FBO
        this.hdrFBO = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFBO);

        this.hdrTextures = [gl.createTexture(), gl.createTexture()];
        for (let i = 0; i < 2; i++) {
            gl.bindTexture(gl.TEXTURE_2D, this.hdrTextures[i]);
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, w, h, 0, gl.RGBA, type, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0 + i, gl.TEXTURE_2D, this.hdrTextures[i], 0);
        }

        gl.drawBuffers([gl.COLOR_ATTACHMENT0, gl.COLOR_ATTACHMENT1]);

        // 2. Ping-Pong Blur FBOs
        this.pingpongFBOs = [gl.createFramebuffer(), gl.createFramebuffer()];
        this.pingpongTextures = [gl.createTexture(), gl.createTexture()];

        const blurW = Math.max(1, Math.floor(w / 2));
        const blurH = Math.max(1, Math.floor(h / 2));

        for (let i = 0; i < 2; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingpongFBOs[i]);
            gl.bindTexture(gl.TEXTURE_2D, this.pingpongTextures[i]);
            gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, blurW, blurH, 0, gl.RGBA, type, null);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
            gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
            gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pingpongTextures[i], 0);
        }

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    }

    resize(w, h) {
        if (this.canvas.width === w && this.canvas.height === h) return;
        this.canvas.width = w;
        this.canvas.height = h;
        this.initFramebuffers();
    }

    getKerrMetrics() {
        const M = state.mass;
        const a = state.spin;
        const Rs = 2.0 * M;

        // Photon Sphere
        const r_photon = 2.0 * M * (1.0 + Math.cos((2.0 / 3.0) * Math.acos(-a)));

        // ISCO calculation
        const z1 = 1.0 + Math.cbrt(1.0 - a * a) * (Math.cbrt(1.0 + a) + Math.cbrt(1.0 - a));
        const z2 = Math.sqrt(3.0 * a * a + z1 * z1);
        const signA = a >= 0 ? 1.0 : -1.0;
        const r_isco = M * (3.0 + z2 - signA * Math.sqrt((3.0 - z1) * (3.0 + z1 + 2.0 * z2)));

        return { Rs, r_photon, r_isco };
    }

    render(dt) {
        const gl = this.gl;
        const w = this.canvas.width;
        const h = this.canvas.height;

        if (!state.isPaused) {
            const effectiveDT = dt * state.timeScale;
            this.totalTime += effectiveDT;
            state.diskTime += effectiveDT * state.rotationSpeed;
        }

        // Camera smooth interpolation
        const damp = Math.min(1.0, 1.0 - Math.exp(-16.0 * dt));
        state.yaw += (state.targetYaw - state.yaw) * damp;
        state.pitch += (state.targetPitch - state.pitch) * damp;
        state.camDist += (state.targetDist - state.camDist) * damp;

        const metrics = this.getKerrMetrics();

        // Position from orbital Euler angles (matching C++ Camera.cpp)
        const radYaw = state.yaw * Math.PI / 180.0;
        const radPitch = state.pitch * Math.PI / 180.0;

        const camX = state.camDist * Math.cos(radPitch) * Math.cos(radYaw);
        const camY = state.camDist * Math.sin(radPitch);
        const camZ = state.camDist * Math.cos(radPitch) * Math.sin(radYaw);

        const camPos = [camX, camY, camZ];
        const target = [0.0, 0.0, 0.0];

        // Front vector = normalize(target - position)
        let fx = target[0] - camX;
        let fy = target[1] - camY;
        let fz = target[2] - camZ;
        const lenF = Math.hypot(fx, fy, fz) || 1.0;
        fx /= lenF; fy /= lenF; fz /= lenF;

        // worldUp = [0, 1, 0]
        // Right vector = normalize(cross(front, worldUp))
        let rx = -fz;
        let ry = 0.0;
        let rz = fx;
        const lenR = Math.hypot(rx, ry, rz) || 1.0;
        rx /= lenR; ry /= lenR; rz /= lenR;

        // Up vector = normalize(cross(right, front))
        let ux = ry * fz - rz * fy;
        let uy = rz * fx - rx * fz;
        let uz = rx * fy - ry * fx;
        const lenU = Math.hypot(ux, uy, uz) || 1.0;
        ux /= lenU; uy /= lenU; uz /= lenU;

        // Column-major mat3 for WebGL (Col 0: Right, Col 1: Up, Col 2: -Front)
        const invViewRot = [
            rx, ry, rz,       // Column 0
            ux, uy, uz,       // Column 1
            -fx, -fy, -fz     // Column 2
        ];

        // --- Pass 1: Primary Ray Marching Shader ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.hdrFBO);
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.progBH);
        gl.bindVertexArray(this.quadVAO);

        gl.uniform2f(gl.getUniformLocation(this.progBH, "u_resolution"), w, h);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_time"), this.totalTime);
        gl.uniform3fv(gl.getUniformLocation(this.progBH, "u_camPos"), camPos);
        gl.uniformMatrix3fv(gl.getUniformLocation(this.progBH, "u_invViewRot"), false, invViewRot);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_fov"), state.fov);

        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_mass"), state.mass);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_spin"), state.spin);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_rs"), metrics.Rs);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_r_photon"), metrics.r_photon);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_r_isco"), metrics.r_isco);

        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_diskInnerRadius"), metrics.r_isco * state.innerRadiusRatio);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_diskOuterRadius"), state.outerRadius);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_diskThickness"), state.thickness);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_diskBrightness"), state.brightness);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_diskTemperature"), state.temperature);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_diskTurbulence"), state.turbulence);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_diskDensity"), state.density);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_diskTime"), state.diskTime);

        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_dopplerEffect"), state.dopplerEffect * state.dopplerStrength);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_gravitationalLensing"), state.gravitationalLensing);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_photonRingIntensity"), state.photonRingIntensity);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_gravitationalDistortion"), state.gravitationalDistortion);
        gl.uniform1i(gl.getUniformLocation(this.progBH, "u_maxRaySteps"), state.maxRaySteps);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_bloomThreshold"), state.bloomThreshold);

        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_starDensity"), state.starDensity);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_nebulaIntensity"), state.nebulaIntensity);
        gl.uniform1f(gl.getUniformLocation(this.progBH, "u_backgroundBrightness"), state.backgroundBrightness);

        gl.drawArrays(gl.TRIANGLES, 0, 6);

        // --- Pass 2: Ping-Pong Blur for Bright Pass ---
        let horizontal = true, firstIteration = true;
        const blurAmount = 4;
        gl.useProgram(this.progBloom);
        gl.viewport(0, 0, Math.floor(w / 2), Math.floor(h / 2));

        for (let i = 0; i < blurAmount; i++) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, this.pingpongFBOs[horizontal ? 1 : 0]);
            gl.uniform1i(gl.getUniformLocation(this.progBloom, "u_horizontal"), horizontal ? 1 : 0);

            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, firstIteration ? this.hdrTextures[1] : this.pingpongTextures[horizontal ? 0 : 1]);
            gl.uniform1i(gl.getUniformLocation(this.progBloom, "u_image"), 0);

            gl.drawArrays(gl.TRIANGLES, 0, 6);

            horizontal = !horizontal;
            if (firstIteration) firstIteration = false;
        }

        // --- Pass 3: Composite ACES Tone Mapping ---
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, w, h);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.progComposite);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, this.hdrTextures[0]);
        gl.uniform1i(gl.getUniformLocation(this.progComposite, "u_hdrScene"), 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.pingpongTextures[horizontal ? 0 : 1]);
        gl.uniform1i(gl.getUniformLocation(this.progComposite, "u_bloomBlur"), 1);

        gl.uniform1f(gl.getUniformLocation(this.progComposite, "u_bloomIntensity"), state.bloomIntensity);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}

// --- Audio Ambience Synth ---
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.isPlaying = false;
    }

    toggle() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.ctx = new AudioContext();
            
            // Sub-bass rumble
            this.osc1 = this.ctx.createOscillator();
            this.osc1.type = 'sine';
            this.osc1.frequency.setValueAtTime(45, this.ctx.currentTime);

            // Shimmering harmonic
            this.osc2 = this.ctx.createOscillator();
            this.osc2.type = 'triangle';
            this.osc2.frequency.setValueAtTime(90, this.ctx.currentTime);

            const gain = this.ctx.createGain();
            gain.gain.setValueAtTime(0.12, this.ctx.currentTime);

            const filter = this.ctx.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(220, this.ctx.currentTime);

            this.osc1.connect(filter);
            this.osc2.connect(filter);
            filter.connect(gain);
            gain.connect(this.ctx.destination);

            this.osc1.start();
            this.osc2.start();
            this.isPlaying = true;
            return true;
        }

        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
            this.isPlaying = true;
            return true;
        } else if (this.ctx.state === 'running') {
            this.ctx.suspend();
            this.isPlaying = false;
            return false;
        }
    }
}

// --- Main Application Setup ---
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gl-canvas');
    const engine = new WebGLBlackHoleEngine(canvas);
    const audio = new AudioEngine();

    // Auto-resize
    const handleResize = () => {
        engine.resize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    // DOM UI Elements & Binding
    const bindInput = (id, prop, isFloat = true) => {
        const el = document.getElementById(id);
        const valEl = document.getElementById(`${id}-val`);
        if (!el) return;

        el.addEventListener('input', (e) => {
            const val = isFloat ? parseFloat(e.target.value) : parseInt(e.target.value);
            state[prop] = val;
            if (valEl) valEl.textContent = isFloat ? val.toFixed(2) : val;
        });
    };

    // Black Hole
    bindInput('mass', 'mass');
    bindInput('spin', 'spin');
    bindInput('rot-speed', 'rotationSpeed');

    // Lensing
    bindInput('lens-str', 'gravitationalLensing');
    bindInput('ring-int', 'photonRingIntensity');
    bindInput('dist-fac', 'gravitationalDistortion');
    bindInput('doppler', 'dopplerEffect');

    // Accretion Disk
    bindInput('disk-inner', 'innerRadiusRatio');
    bindInput('disk-outer', 'outerRadius');
    bindInput('disk-thick', 'thickness');
    bindInput('disk-bright', 'brightness');
    bindInput('disk-temp', 'temperature');
    bindInput('disk-turb', 'turbulence');

    // Rendering & Quality
    bindInput('ray-steps', 'maxRaySteps', false);
    bindInput('bloom-thresh', 'bloomThreshold');
    bindInput('bloom-int', 'bloomIntensity');
    bindInput('star-dens', 'starDensity');
    bindInput('bg-bright', 'backgroundBrightness');
    bindInput('time-scale', 'timeScale');

    // Quality Presets
    const presetSel = document.getElementById('quality-preset');
    if (presetSel) {
        presetSel.addEventListener('change', (e) => {
            const v = parseInt(e.target.value);
            if (v === 0) state.maxRaySteps = 24;
            else if (v === 1) state.maxRaySteps = 48;
            else if (v === 2) state.maxRaySteps = 64;
            else if (v === 3) state.maxRaySteps = 96;
            document.getElementById('ray-steps').value = state.maxRaySteps;
            document.getElementById('ray-steps-val').textContent = state.maxRaySteps;
        });
    }

    // Checkboxes & Buttons
    document.getElementById('pause-chk').addEventListener('change', (e) => {
        state.isPaused = e.target.checked;
    });

    document.getElementById('btn-reset').addEventListener('click', () => {
        state.mass = 1.0;
        state.spin = 0.85;
        state.rotationSpeed = 1.0;
        state.innerRadiusRatio = 1.0;
        state.outerRadius = 14.0;
        state.thickness = 0.35;
        state.brightness = 2.2;
        state.temperature = 1.0;
        state.turbulence = 1.0;
        state.targetDist = 11.5;
        state.targetYaw = -90.0;
        state.targetPitch = -8.0;
        state.fov = 45.0;
        updateUIValues();
    });

    document.getElementById('btn-sound').addEventListener('click', () => {
        const active = audio.toggle();
        document.getElementById('btn-sound').textContent = active ? "🔊 Mute Audio" : "🎵 Space Audio";
    });

    // Preset Views
    const applyCinematicPreset = (name) => {
        if (name === 'gargantua') {
            state.mass = 1.0; state.spin = 0.99; state.outerRadius = 18.0;
            state.brightness = 3.5; state.temperature = 1.1; state.photonRingIntensity = 3.5;
            state.targetDist = 11.5; state.targetYaw = -90.0; state.targetPitch = -3.0;
        } else if (name === 'kerr') {
            state.mass = 1.2; state.spin = 0.998; state.outerRadius = 12.0;
            state.brightness = 4.0; state.temperature = 1.4; state.photonRingIntensity = 4.5;
            state.targetDist = 9.5; state.targetYaw = -45.0; state.targetPitch = -12.0;
        } else if (name === 'lensing') {
            state.mass = 1.5; state.spin = 0.0; state.gravitationalLensing = 2.2;
            state.outerRadius = 16.0; state.targetDist = 16.0; state.targetYaw = -90.0; state.targetPitch = -85.0;
        }
        updateUIValues();
    };

    const presetBtn = document.getElementById('preset-select');
    if (presetBtn) {
        presetBtn.addEventListener('change', (e) => applyCinematicPreset(e.target.value));
    }

    const updateUIValues = () => {
        const updateVal = (id, val, isFloat = true) => {
            const input = document.getElementById(id);
            const span = document.getElementById(`${id}-val`);
            if (input) input.value = val;
            if (span) span.textContent = isFloat ? val.toFixed(2) : val;
        };

        updateVal('mass', state.mass);
        updateVal('spin', state.spin);
        updateVal('rot-speed', state.rotationSpeed);
        updateVal('disk-inner', state.innerRadiusRatio);
        updateVal('disk-outer', state.outerRadius, false);
        updateVal('disk-thick', state.thickness);
        updateVal('disk-bright', state.brightness);
        updateVal('disk-temp', state.temperature);
        updateVal('disk-turb', state.turbulence);
    };

    // Tab Navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const target = btn.getAttribute('data-tab');
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(`tab-${target}`).classList.add('active');
        });
    });

    // Mouse & Touch Camera Controls
    let isDragging = false;
    let lastMouseX = 0, lastMouseY = 0;

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0) {
            isDragging = true;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;
        }
    });

    window.addEventListener('mouseup', () => { isDragging = false; });

    canvas.addEventListener('mousemove', (e) => {
        if (isDragging) {
            const dx = e.clientX - lastMouseX;
            const dy = e.clientY - lastMouseY;
            lastMouseX = e.clientX;
            lastMouseY = e.clientY;

            state.targetYaw += dx * 0.15;
            state.targetPitch += dy * 0.15;

            // Clamp vertical rotation pitch (matching C++ Camera.cpp)
            state.targetPitch = Math.max(-89.0, Math.min(89.0, state.targetPitch));
        }
    });

    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        state.targetDist += e.deltaY * 0.015;
        state.targetDist = Math.max(2.5, Math.min(60.0, state.targetDist));
    }, { passive: false });

    // Touch controls for mobile devices (1 finger rotate, 2 finger pinch-to-zoom)
    let touchStartX = 0, touchStartY = 0;
    let initialPinchDist = 0;
    let initialTargetDist = state.targetDist;

    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            initialPinchDist = Math.hypot(dx, dy);
            initialTargetDist = state.targetDist;
        }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
        if (e.touches.length === 1) {
            const dx = e.touches[0].clientX - touchStartX;
            const dy = e.touches[0].clientY - touchStartY;
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;

            state.targetYaw += dx * 0.25;
            state.targetPitch += dy * 0.25;
            state.targetPitch = Math.max(-89.0, Math.min(89.0, state.targetPitch));
        } else if (e.touches.length === 2 && initialPinchDist > 0) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const currentDist = Math.hypot(dx, dy);
            const factor = initialPinchDist / Math.max(currentDist, 1.0);
            state.targetDist = Math.max(2.5, Math.min(60.0, initialTargetDist * factor));
        }
    }, { passive: true });

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            state.showUI = !state.showUI;
            const panel = document.getElementById('control-panel');
            if (panel) panel.classList.toggle('hidden', !state.showUI);
        } else if (e.key === ' ') {
            e.preventDefault();
            state.isPaused = !state.isPaused;
            document.getElementById('pause-chk').checked = state.isPaused;
        } else if (e.key.toLowerCase() === 'r') {
            state.targetDist = 11.5;
            state.targetYaw = -90.0;
            state.targetPitch = -8.0;
        } else if (e.key.toLowerCase() === 'w') {
            state.targetDist = Math.max(2.5, state.targetDist - 0.5);
        } else if (e.key.toLowerCase() === 's') {
            state.targetDist = Math.min(60.0, state.targetDist + 0.5);
        } else if (e.key.toLowerCase() === 'a') {
            state.targetYaw -= 2.5;
        } else if (e.key.toLowerCase() === 'd') {
            state.targetYaw += 2.5;
        } else if (e.key.toLowerCase() === 'q') {
            state.targetPitch = Math.min(89.0, state.targetPitch + 2.5);
        } else if (e.key.toLowerCase() === 'e') {
            state.targetPitch = Math.max(-89.0, state.targetPitch - 2.5);
        }
    });

    // Update HUD Metrics
    const fpsValEl = document.getElementById('hud-fps');
    const rsValEl = document.getElementById('metric-rs');
    const rphotValEl = document.getElementById('metric-rphot');
    const riscoValEl = document.getElementById('metric-risco');

    let lastFrameTime = performance.now();

    // Render Loop
    function frame(now) {
        const dt = (now - lastFrameTime) / 1000.0;
        lastFrameTime = now;

        // Performance tracking
        engine.frameCount++;
        engine.fpsTime += dt;
        if (engine.fpsTime >= 0.5) {
            state.fps = (engine.frameCount / engine.fpsTime).toFixed(1);
            state.frameTime = (1000 / state.fps).toFixed(1);
            if (fpsValEl) fpsValEl.textContent = `${state.fps} FPS (${state.frameTime}ms)`;
            engine.frameCount = 0;
            engine.fpsTime = 0;
        }

        // Metrics update
        const metrics = engine.getKerrMetrics();
        if (rsValEl) rsValEl.textContent = metrics.Rs.toFixed(2);
        if (rphotValEl) rphotValEl.textContent = metrics.r_photon.toFixed(2);
        if (riscoValEl) riscoValEl.textContent = metrics.r_isco.toFixed(2);

        engine.render(dt);
        requestAnimationFrame(frame);
    }

    requestAnimationFrame(frame);
});
