#ifndef ACCRETIONDISK_HPP
#define ACCRETIONDISK_HPP

class AccretionDisk {
public:
    float innerRadiusRatio; // Multiplier on ISCO
    float outerRadius;      // Outer disk extent
    float thickness;        // Disk vertical thickness
    float brightness;       // Overall emissive intensity
    float temperature;      // Temperature color multiplier
    float turbulence;       // Procedural noise frequency & depth
    float density;          // Volumetric absorption & scattering density
    float dopplerStrength;  // Relativistic Doppler effect intensity
    float time;             // Animated temporal offset

    AccretionDisk();

    void update(float deltaTime, float rotationSpeed);
};

#endif
