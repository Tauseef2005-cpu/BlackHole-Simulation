#ifndef CAMERA_HPP
#define CAMERA_HPP

#include <glm/glm.hpp>
#include <glm/gtc/matrix_transform.hpp>

enum CameraMovement {
    FORWARD,
    BACKWARD,
    LEFT,
    RIGHT,
    UP,
    DOWN
};

class Camera {
public:
    // Camera Attributes
    glm::vec3 position;
    glm::vec3 target;
    glm::vec3 front;
    glm::vec3 up;
    glm::vec3 right;
    glm::vec3 worldUp;

    // Euler Angles & Orbital params
    float yaw;
    float pitch;
    float distance;
    float targetDistance;
    float targetYaw;
    float targetPitch;
    glm::vec3 targetPos;

    // Camera options
    float movementSpeed;
    float mouseSensitivity;
    float zoom;
    float targetZoom;
    float aspectRatio;

    Camera(glm::vec3 position = glm::vec3(0.0f, 2.5f, 12.0f), 
           glm::vec3 up = glm::vec3(0.0f, 1.0f, 0.0f), 
           float yaw = -90.0f, 
           float pitch = -10.0f);

    glm::mat4 getViewMatrix() const;
    glm::mat4 getProjectionMatrix() const;

    void processKeyboard(CameraMovement direction, float deltaTime);
    void processMouseMovement(float xoffset, float yoffset, bool constrainPitch = true);
    void processMouseScroll(float yoffset);
    void reset();
    void update(float deltaTime);

    void setAspectRatio(float aspect) { aspectRatio = aspect; }

private:
    void updateCameraVectors();
};

#endif
