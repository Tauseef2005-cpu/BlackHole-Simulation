#ifndef RENDERER_HPP
#define RENDERER_HPP

#include <glad/glad.h>
#include <GLFW/glfw3.h>
#include "Shader.hpp"
#include "Camera.hpp"
#include "BlackHole.hpp"
#include "AccretionDisk.hpp"

struct SimulationSettings {
    // Relativistic toggles & factors
    float gravitationalLensing = 1.0f;
    float dopplerEffect = 1.0f;
    float photonRingIntensity = 2.5f;
    float gravitationalDistortion = 1.0f;

    // Environment
    float starDensity = 1.0f;
    float nebulaIntensity = 1.0f;
    float backgroundBrightness = 1.0f;

    // Simulation
    float timeScale = 1.0f;
    bool isPaused = false;
    bool enableVSync = false; // false = Uncapped / 120+ FPS mode!
    int qualityPreset = 1; // 0: FAST (24 steps), 1: HIGH PERFORMANCE (48 steps - Max FPS), 2: MAXIMUM (64 steps), 3: ULTRA (96 steps)
    int maxRaySteps = 48;
    
    // Bloom
    float bloomThreshold = 1.2f;
    float bloomIntensity = 0.8f;
};

class Renderer {
public:
    Renderer();
    ~Renderer();

    bool init(int width, int height);
    void resize(int width, int height);
    
    void render(const Camera &camera, 
                const BlackHole &blackHole, 
                const AccretionDisk &disk, 
                const SimulationSettings &settings,
                float totalTime);

    void cleanup();

private:
    int screenWidth;
    int screenHeight;

    // VAO/VBO for screen-space quad
    GLuint quadVAO, quadVBO;

    // Framebuffers
    GLuint hdrFBO;
    GLuint hdrColorBuffers[2]; // 0: Scene, 1: Bright Threshold
    GLuint pingpongFBO[2];
    GLuint pingpongColorbuffers[2];

    // Shaders
    Shader blackHoleShader;
    Shader bloomShader;
    Shader compositeShader;

    void setupQuad();
    void setupFramebuffers(int width, int height);
    void deleteFramebuffers();
    void renderQuad();
    bool loadShaderWithFallback(Shader &shader, const char* vertBase, const char* fragBase);
};

#endif
