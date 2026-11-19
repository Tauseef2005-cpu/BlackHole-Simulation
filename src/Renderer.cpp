#include "Renderer.hpp"
#include <iostream>
#include <cstdio>

Renderer::Renderer() 
    : screenWidth(1280), screenHeight(720),
      quadVAO(0), quadVBO(0),
      hdrFBO(0) {
    hdrColorBuffers[0] = hdrColorBuffers[1] = 0;
    pingpongFBO[0] = pingpongFBO[1] = 0;
    pingpongColorbuffers[0] = pingpongColorbuffers[1] = 0;
}

Renderer::~Renderer() {
    cleanup();
}

bool Renderer::init(int width, int height) {
    screenWidth = width;
    screenHeight = height;

    setupQuad();

    if (!loadShaderWithFallback(blackHoleShader, "blackhole", "blackhole")) {
        std::cerr << "Failed to load blackhole shader program." << std::endl;
        return false;
    }

    if (!loadShaderWithFallback(bloomShader, "bloom", "bloom")) {
        std::cerr << "Failed to load bloom shader program." << std::endl;
        return false;
    }

    if (!loadShaderWithFallback(compositeShader, "composite", "composite")) {
        std::cerr << "Failed to load composite shader program." << std::endl;
        return false;
    }

    setupFramebuffers(screenWidth, screenHeight);
    return true;
}

void Renderer::setupQuad() {
    float quadVertices[] = {
        // positions   // texCoords
        -1.0f,  1.0f,  0.0f, 1.0f,
        -1.0f, -1.0f,  0.0f, 0.0f,
         1.0f, -1.0f,  1.0f, 0.0f,

        -1.0f,  1.0f,  0.0f, 1.0f,
         1.0f, -1.0f,  1.0f, 0.0f,
         1.0f,  1.0f,  1.0f, 1.0f
    };

    glGenVertexArrays(1, &quadVAO);
    glGenBuffers(1, &quadVBO);
    glBindVertexArray(quadVAO);
    glBindBuffer(GL_ARRAY_BUFFER, quadVBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quadVertices), &quadVertices, GL_STATIC_DRAW);

    glEnableVertexAttribArray(0);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)0);
    glEnableVertexAttribArray(1);
    glVertexAttribPointer(1, 2, GL_FLOAT, GL_FALSE, 4 * sizeof(float), (void*)(2 * sizeof(float)));

    glBindVertexArray(0);
}

void Renderer::setupFramebuffers(int width, int height) {
    deleteFramebuffers();

    // 1. HDR Framebuffer (2 color attachments: 0=scene, 1=bright threshold for bloom)
    glGenFramebuffers(1, &hdrFBO);
    glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);

    glGenTextures(2, hdrColorBuffers);
    for (int i = 0; i < 2; i++) {
        glBindTexture(GL_TEXTURE_2D, hdrColorBuffers[i]);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, width, height, 0, GL_RGBA, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0 + i, GL_TEXTURE_2D, hdrColorBuffers[i], 0);
    }

    GLenum attachments[2] = { GL_COLOR_ATTACHMENT0, GL_COLOR_ATTACHMENT1 };
    glDrawBuffers(2, attachments);

    if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
        std::cerr << "HDR Framebuffer not complete!" << std::endl;
    }

    // 2. Ping-pong Framebuffers for Blur
    glGenFramebuffers(2, pingpongFBO);
    glGenTextures(2, pingpongColorbuffers);
    for (int i = 0; i < 2; i++) {
        glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[i]);
        glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[i]);
        glTexImage2D(GL_TEXTURE_2D, 0, GL_RGBA16F, width / 2, height / 2, 0, GL_RGBA, GL_FLOAT, NULL);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
        glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
        glFramebufferTexture2D(GL_FRAMEBUFFER, GL_COLOR_ATTACHMENT0, GL_TEXTURE_2D, pingpongColorbuffers[i], 0);

        if (glCheckFramebufferStatus(GL_FRAMEBUFFER) != GL_FRAMEBUFFER_COMPLETE) {
            std::cerr << "PingPong Framebuffer " << i << " not complete!" << std::endl;
        }
    }

    glBindFramebuffer(GL_FRAMEBUFFER, 0);
}

void Renderer::deleteFramebuffers() {
    if (hdrFBO != 0) {
        glDeleteFramebuffers(1, &hdrFBO);
        glDeleteTextures(2, hdrColorBuffers);
        hdrFBO = 0;
    }
    if (pingpongFBO[0] != 0) {
        glDeleteFramebuffers(2, pingpongFBO);
        glDeleteTextures(2, pingpongColorbuffers);
        pingpongFBO[0] = pingpongFBO[1] = 0;
    }
}

void Renderer::resize(int width, int height) {
    if (width <= 0 || height <= 0) return;
    screenWidth = width;
    screenHeight = height;
    setupFramebuffers(width, height);
}

void Renderer::renderQuad() {
    glBindVertexArray(quadVAO);
    glDrawArrays(GL_TRIANGLES, 0, 6);
    glBindVertexArray(0);
}

void Renderer::render(const Camera &camera, 
                      const BlackHole &blackHole, 
                      const AccretionDisk &disk, 
                      const SimulationSettings &settings,
                      float totalTime) {

    // --- Pass 1: Primary Geodesic Ray Marching into HDR Framebuffer ---
    glBindFramebuffer(GL_FRAMEBUFFER, hdrFBO);
    glViewport(0, 0, screenWidth, screenHeight);
    glClear(GL_COLOR_BUFFER_BIT | GL_DEPTH_BUFFER_BIT);

    blackHoleShader.use();
    
    // View & Matrix
    blackHoleShader.setVec2("u_resolution", (float)screenWidth, (float)screenHeight);
    blackHoleShader.setFloat("u_time", totalTime);
    blackHoleShader.setVec3("u_camPos", camera.position);
    blackHoleShader.setVec3("u_camTarget", camera.target);
    blackHoleShader.setMat4("u_view", camera.getViewMatrix());
    blackHoleShader.setMat4("u_projection", camera.getProjectionMatrix());
    blackHoleShader.setFloat("u_fov", camera.zoom);

    // Black Hole parameters
    blackHoleShader.setFloat("u_mass", blackHole.mass);
    blackHoleShader.setFloat("u_spin", blackHole.spin);
    blackHoleShader.setFloat("u_rs", blackHole.getSchwarzschildRadius());
    blackHoleShader.setFloat("u_r_photon", blackHole.getPhotonSphereRadius());
    blackHoleShader.setFloat("u_r_isco", blackHole.getISCORadius());

    // Accretion Disk parameters
    blackHoleShader.setFloat("u_diskInnerRadius", blackHole.getISCORadius() * disk.innerRadiusRatio);
    blackHoleShader.setFloat("u_diskOuterRadius", disk.outerRadius);
    blackHoleShader.setFloat("u_diskThickness", disk.thickness);
    blackHoleShader.setFloat("u_diskBrightness", disk.brightness);
    blackHoleShader.setFloat("u_diskTemperature", disk.temperature);
    blackHoleShader.setFloat("u_diskTurbulence", disk.turbulence);
    blackHoleShader.setFloat("u_diskDensity", disk.density);
    blackHoleShader.setFloat("u_diskTime", disk.time);

    // Relativistic & Ray Marching Quality
    blackHoleShader.setFloat("u_dopplerEffect", settings.dopplerEffect * disk.dopplerStrength);
    blackHoleShader.setFloat("u_gravitationalLensing", settings.gravitationalLensing);
    blackHoleShader.setFloat("u_photonRingIntensity", settings.photonRingIntensity);
    blackHoleShader.setFloat("u_gravitationalDistortion", settings.gravitationalDistortion);
    blackHoleShader.setInt("u_maxRaySteps", settings.maxRaySteps);
    blackHoleShader.setFloat("u_bloomThreshold", settings.bloomThreshold);

    // Environment
    blackHoleShader.setFloat("u_starDensity", settings.starDensity);
    blackHoleShader.setFloat("u_nebulaIntensity", settings.nebulaIntensity);
    blackHoleShader.setFloat("u_backgroundBrightness", settings.backgroundBrightness);

    renderQuad();

    // --- Pass 2: Multi-Pass Gaussian Blur on Bright Pass ---
    bool horizontal = true, first_iteration = true;
    int blurAmount = 6;
    bloomShader.use();
    glViewport(0, 0, screenWidth / 2, screenHeight / 2);

    for (int i = 0; i < blurAmount; i++) {
        glBindFramebuffer(GL_FRAMEBUFFER, pingpongFBO[horizontal]);
        bloomShader.setInt("u_horizontal", horizontal);
        
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, first_iteration ? hdrColorBuffers[1] : pingpongColorbuffers[!horizontal]);
        bloomShader.setInt("u_image", 0);

        renderQuad();

        horizontal = !horizontal;
        if (first_iteration) first_iteration = false;
    }

    // --- Pass 3: Composite HDR Tone Mapping & Bloom ---
    glBindFramebuffer(GL_FRAMEBUFFER, 0);
    glViewport(0, 0, screenWidth, screenHeight);
    glClear(GL_COLOR_BUFFER_BIT);

    compositeShader.use();
    glActiveTexture(GL_TEXTURE0);
    glBindTexture(GL_TEXTURE_2D, hdrColorBuffers[0]);
    compositeShader.setInt("u_hdrScene", 0);

    glActiveTexture(GL_TEXTURE1);
    glBindTexture(GL_TEXTURE_2D, pingpongColorbuffers[!horizontal]);
    compositeShader.setInt("u_bloomBlur", 1);

    compositeShader.setFloat("u_bloomIntensity", settings.bloomIntensity);

    renderQuad();
}

void Renderer::cleanup() {
    deleteFramebuffers();
    if (quadVAO != 0) {
        glDeleteVertexArrays(1, &quadVAO);
        glDeleteBuffers(1, &quadVBO);
        quadVAO = quadVBO = 0;
    }
}

bool Renderer::loadShaderWithFallback(Shader &shader, const char* vertBase, const char* fragBase) {
    // Try multiple paths: shaders/, build/shaders/, and ../shaders/
    const char* paths[] = { 
        "shaders/", 
        "build/shaders/",
        "../shaders/"
    };
    
    char vertPath[256];
    char fragPath[256];
    
    for (const char* basePath : paths) {
        snprintf(vertPath, sizeof(vertPath), "%s%s.vert", basePath, vertBase);
        snprintf(fragPath, sizeof(fragPath), "%s%s.frag", basePath, fragBase);
        
        if (shader.loadFromFiles(vertPath, fragPath)) {
            std::cout << "Successfully loaded shaders from: " << basePath << std::endl;
            return true;
        }
    }
    
    std::cerr << "Failed to load shader '" << vertBase << "' from all tried paths." << std::endl;
    return false;
}
