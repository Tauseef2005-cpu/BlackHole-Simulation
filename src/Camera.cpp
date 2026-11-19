#include "Camera.hpp"
#include <algorithm>
#include <cmath>

Camera::Camera(glm::vec3 startPos, glm::vec3 startUp, float startYaw, float startPitch)
    : position(startPos), worldUp(startUp), yaw(startYaw), pitch(startPitch),
      movementSpeed(6.0f), mouseSensitivity(0.12f), zoom(45.0f), targetZoom(45.0f),
      aspectRatio(16.0f / 9.0f) {
    
    target = glm::vec3(0.0f, 0.0f, 0.0f);
    distance = 11.5f;
    targetDistance = distance;
    targetYaw = -90.0f;
    targetPitch = -8.0f;
    yaw = targetYaw;
    pitch = targetPitch;

    updateCameraVectors();
}

glm::mat4 Camera::getViewMatrix() const {
    return glm::lookAt(position, target, up);
}

glm::mat4 Camera::getProjectionMatrix() const {
    return glm::perspective(glm::radians(zoom), aspectRatio, 0.1f, 500.0f);
}

void Camera::processKeyboard(CameraMovement direction, float deltaTime) {
    float velocity = movementSpeed * deltaTime;
    if (direction == FORWARD)
        targetDistance -= velocity * 2.0f;
    if (direction == BACKWARD)
        targetDistance += velocity * 2.0f;
    if (direction == LEFT)
        targetYaw -= velocity * 15.0f;
    if (direction == RIGHT)
        targetYaw += velocity * 15.0f;
    if (direction == UP)
        targetPitch += velocity * 15.0f;
    if (direction == DOWN)
        targetPitch -= velocity * 15.0f;

    targetDistance = std::clamp(targetDistance, 2.5f, 60.0f);
    targetPitch = std::clamp(targetPitch, -89.0f, 89.0f);
}

void Camera::processMouseMovement(float xoffset, float yoffset, bool constrainPitch) {
    xoffset *= mouseSensitivity;
    yoffset *= mouseSensitivity;

    targetYaw += xoffset;
    targetPitch += yoffset;

    if (constrainPitch) {
        targetPitch = std::clamp(targetPitch, -89.0f, 89.0f);
    }
}

void Camera::processMouseScroll(float yoffset) {
    targetZoom -= yoffset * 2.0f;
    targetZoom = std::clamp(targetZoom, 15.0f, 90.0f);
}

void Camera::reset() {
    targetYaw = -90.0f;
    targetPitch = -8.0f;
    targetDistance = 11.5f;
    targetZoom = 45.0f;
    target = glm::vec3(0.0f, 0.0f, 0.0f);
}

void Camera::update(float deltaTime) {
    // Exponential smoothing for silky-smooth 120+ FPS motion
    float damp = 1.0f - std::exp(-16.0f * deltaTime);
    damp = std::clamp(damp, 0.0f, 1.0f);

    yaw += (targetYaw - yaw) * damp;
    pitch += (targetPitch - pitch) * damp;
    distance += (targetDistance - distance) * damp;
    zoom += (targetZoom - zoom) * damp;

    // Calculate position from orbital angles
    float radYaw = glm::radians(yaw);
    float radPitch = glm::radians(pitch);

    position.x = target.x + distance * cos(radPitch) * cos(radYaw);
    position.y = target.y + distance * sin(radPitch);
    position.z = target.z + distance * cos(radPitch) * sin(radYaw);

    updateCameraVectors();
}

void Camera::updateCameraVectors() {
    front = glm::normalize(target - position);
    right = glm::normalize(glm::cross(front, worldUp));
    up    = glm::normalize(glm::cross(right, front));
}
