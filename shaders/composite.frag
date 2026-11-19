#version 430 core

out vec4 FragColor;
in vec2 v_TexCoord;

uniform sampler2D u_hdrScene;
uniform sampler2D u_bloomBlur;
uniform float u_bloomIntensity;

// ACES Filmic Tone Mapping operator
vec3 ACESFilm(vec3 x) {
    float a = 2.51;
    float b = 0.03;
    float c = 2.43;
    float d = 0.59;
    float e = 0.14;
    return clamp((x * (a * x + b)) / (x * (c * x + d) + e), 0.0, 1.0);
}

void main() {
    vec3 hdrColor = texture(u_hdrScene, v_TexCoord).rgb;
    vec3 bloomColor = texture(u_bloomBlur, v_TexCoord).rgb;

    // Additive Bloom blend
    vec3 combined = hdrColor + bloomColor * u_bloomIntensity;

    // ACES Tone Mapping
    vec3 mapped = ACESFilm(combined);

    // Gamma Correction (gamma = 2.2)
    mapped = pow(mapped, vec3(1.0 / 2.2));

    FragColor = vec4(mapped, 1.0);
}
