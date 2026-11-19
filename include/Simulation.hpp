#ifndef SIMULATION_HPP
#define SIMULATION_HPP

#include <glad/glad.h>
#include <GLFW/glfw3.h>

#include "Camera.hpp"
#include "BlackHole.hpp"
#include "AccretionDisk.hpp"
#include "Renderer.hpp"

class Simulation {
public:
    Simulation();
    ~Simulation();

    bool init(int width = 1280, int height = 720, const char* title = "Black Hole Relativistic Simulation");
    void run();

private:
    GLFWwindow* window;
    int windowWidth;
    int windowHeight;

    Camera camera;
    BlackHole blackHole;
    AccretionDisk accretionDisk;
    Renderer renderer;
    SimulationSettings settings;

    // Input state
    bool showUI;
    bool mouseFirst;
    bool isMouseDragging;
    double lastMouseX;
    double lastMouseY;
    float totalTime;
    float deltaTime;
    float lastFrameTime;

    void processInput(GLFWwindow* window);
    void update(float dt);
    void renderUI();

    // Callbacks
    static void framebufferSizeCallback(GLFWwindow* window, int width, int height);
    static void mouseCallback(GLFWwindow* window, double xpos, double ypos);
    static void scrollCallback(GLFWwindow* window, double xoffset, double yoffset);
    static void keyCallback(GLFWwindow* window, int key, int scancode, int action, int mods);
    static void mouseButtonCallback(GLFWwindow* window, int button, int action, int mods);
};

#endif
