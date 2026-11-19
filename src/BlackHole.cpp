#include "BlackHole.hpp"
#include <cmath>
#include <algorithm>

BlackHole::BlackHole(float m, float s, float rot)
    : mass(m), spin(s), rotationSpeed(rot) {}

float BlackHole::getSchwarzschildRadius() const {
    // In simulation units (G = 1, c = 1), Rs = 2M
    return 2.0f * mass;
}

float BlackHole::getPhotonSphereRadius() const {
    // For Schwarzschild (spin=0), R_photon = 3M = 1.5 * Rs.
    // For Kerr spin a: R_photon prograde = 2M * (1 + cos(2/3 * acos(-a)))
    float a = std::clamp(spin, -0.998f, 0.998f);
    float r_p = 2.0f * mass * (1.0f + std::cos((2.0f / 3.0f) * std::acos(-a)));
    return r_p;
}

float BlackHole::getISCORadius() const {
    // Kerr ISCO formula
    float a = std::clamp(spin, -0.998f, 0.998f);
    float absA = std::abs(a);
    float z1 = 1.0f + std::pow(1.0f - absA * absA, 1.0f / 3.0f) * 
               (std::pow(1.0f + absA, 1.0f / 3.0f) + std::pow(1.0f - absA, 1.0f / 3.0f));
    float z2 = std::sqrt(3.0f * absA * absA + z1 * z1);
    float s = (a >= 0.0f) ? 1.0f : -1.0f;
    float r_isco = mass * (3.0f + z2 - s * std::sqrt((3.0f - z1) * (3.0f + z1 + 2.0f * z2)));
    return r_isco;
}

void BlackHole::update(float deltaTime) {
    // Keep spin within physical Kerr bound (|a| <= 1)
    spin = std::clamp(spin, -0.998f, 0.998f);
}
