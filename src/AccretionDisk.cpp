#include "AccretionDisk.hpp"

AccretionDisk::AccretionDisk()
    : innerRadiusRatio(1.0f),
      outerRadius(14.0f),
      thickness(0.45f),
      brightness(2.2f),
      temperature(1.0f),
      turbulence(1.2f),
      density(1.0f),
      dopplerStrength(1.0f),
      time(0.0f) {}

void AccretionDisk::update(float deltaTime, float rotationSpeed) {
    time += deltaTime * rotationSpeed;
}
