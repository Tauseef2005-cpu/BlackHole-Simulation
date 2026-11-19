#ifndef BLACKHOLE_HPP
#define BLACKHOLE_HPP

class BlackHole {
public:
    float mass;           // Black hole mass (M)
    float spin;           // Dimensionless spin parameter a (-0.998 to 0.998)
    float rotationSpeed;  // Disk / Spin temporal rotation multiplier

    BlackHole(float m = 1.0f, float s = 0.85f, float rot = 1.0f);

    float getSchwarzschildRadius() const;
    float getPhotonSphereRadius() const;
    float getISCORadius() const;
    
    void update(float deltaTime);
};

#endif
