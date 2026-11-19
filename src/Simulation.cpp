#include "Simulation.hpp"
#include <iostream>

#include "imgui.h"
#include "backends/imgui_impl_glfw.h"
#include "backends/imgui_impl_opengl3.h"

Simulation* g_SimInstance = nullptr;

Simulation::Simulation() 
    : window(nullptr), windowWidth(1280), windowHeight(720),
      showUI(true), mouseFirst(true), isMouseDragging(false),
      lastMouseX(0.0), lastMouseY(0.0),
      totalTime(0.0f), deltaTime(0.0f), lastFrameTime(0.0f) {
    g_SimInstance = this;
}

Simulation::~Simulation() {
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplGlfw_Shutdown();
    ImGui::DestroyContext();

    if (window) {
        glfwDestroyWindow(window);
        glfwTerminate();
    }
}

bool Simulation::init(int width, int height, const char* title) {
    windowWidth = width;
    windowHeight = height;

    if (!glfwInit()) {
        std::cerr << "Failed to initialize GLFW" << std::endl;
        return false;
    }

    // OpenGL 4.3 Core Profile
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 4);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    glfwWindowHint(GLFW_SAMPLES, 4);

    window = glfwCreateWindow(windowWidth, windowHeight, title, NULL, NULL);
    if (!window) {
        std::cerr << "Failed to create GLFW window" << std::endl;
        glfwTerminate();
        return false;
    }

    glfwMakeContextCurrent(window);
    glfwSwapInterval(0); // 0 = Uncapped (120+ FPS performance mode)

    // Load OpenGL function pointers via GLAD
    if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress)) {
        std::cerr << "Failed to initialize GLAD loader" << std::endl;
        return false;
    }

    // Callbacks
    glfwSetWindowUserPointer(window, this);
    glfwSetFramebufferSizeCallback(window, framebufferSizeCallback);
    glfwSetCursorPosCallback(window, mouseCallback);
    glfwSetScrollCallback(window, scrollCallback);
    glfwSetKeyCallback(window, keyCallback);
    glfwSetMouseButtonCallback(window, mouseButtonCallback);

    // Initialize Camera aspect ratio
    camera.setAspectRatio((float)windowWidth / (float)windowHeight);

    // Initialize Renderer
    if (!renderer.init(windowWidth, windowHeight)) {
        std::cerr << "Failed to initialize Renderer" << std::endl;
        return false;
    }

    // Setup Dear ImGui
    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGuiIO& io = ImGui::GetIO(); (void)io;
    io.ConfigFlags |= ImGuiConfigFlags_NavEnableKeyboard;

    // Dark & Sleek Cinematic ImGui visual theme
    ImGui::StyleColorsDark();
    ImGuiStyle& style = ImGui::GetStyle();
    style.WindowRounding = 8.0f;
    style.FrameRounding = 5.0f;
    style.PopupRounding = 6.0f;
    style.ScrollbarRounding = 6.0f;
    style.GrabRounding = 5.0f;
    style.WindowBorderSize = 1.0f;

    ImVec4* colors = style.Colors;
    colors[ImGuiCol_WindowBg]           = ImVec4(0.06f, 0.07f, 0.10f, 0.88f);
    colors[ImGuiCol_Header]             = ImVec4(0.20f, 0.25f, 0.38f, 0.80f);
    colors[ImGuiCol_HeaderHovered]      = ImVec4(0.28f, 0.35f, 0.52f, 0.90f);
    colors[ImGuiCol_HeaderActive]       = ImVec4(0.36f, 0.45f, 0.65f, 1.00f);
    colors[ImGuiCol_Button]             = ImVec4(0.22f, 0.28f, 0.42f, 0.85f);
    colors[ImGuiCol_ButtonHovered]      = ImVec4(0.32f, 0.40f, 0.60f, 1.00f);
    colors[ImGuiCol_ButtonActive]       = ImVec4(0.40f, 0.50f, 0.72f, 1.00f);
    colors[ImGuiCol_FrameBg]            = ImVec4(0.10f, 0.12f, 0.18f, 0.70f);
    colors[ImGuiCol_FrameBgHovered]     = ImVec4(0.16f, 0.20f, 0.30f, 0.85f);
    colors[ImGuiCol_SliderGrab]         = ImVec4(0.90f, 0.55f, 0.15f, 1.00f);
    colors[ImGuiCol_SliderGrabActive]   = ImVec4(1.00f, 0.70f, 0.25f, 1.00f);
    colors[ImGuiCol_TitleBg]            = ImVec4(0.05f, 0.05f, 0.08f, 0.95f);
    colors[ImGuiCol_TitleBgActive]      = ImVec4(0.10f, 0.14f, 0.22f, 1.00f);

    ImGui_ImplGlfw_InitForOpenGL(window, true);
    ImGui_ImplOpenGL3_Init("#version 430");

    lastFrameTime = (float)glfwGetTime();
    return true;
}

void Simulation::run() {
    while (!glfwWindowShouldClose(window)) {
        float currentFrame = (float)glfwGetTime();
        deltaTime = currentFrame - lastFrameTime;
        lastFrameTime = currentFrame;

        // Process inputs
        glfwPollEvents();
        processInput(window);

        // Update simulation physics & camera
        update(deltaTime);

        // Render pass
        renderer.render(camera, blackHole, accretionDisk, settings, totalTime);

        // Render UI
        if (showUI) {
            renderUI();
        }

        glfwSwapBuffers(window);
    }
}

void Simulation::processInput(GLFWwindow* window) {
    if (glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);

    // Keyboard navigation
    if (glfwGetKey(window, GLFW_KEY_W) == GLFW_PRESS)
        camera.processKeyboard(FORWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_S) == GLFW_PRESS)
        camera.processKeyboard(BACKWARD, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_A) == GLFW_PRESS)
        camera.processKeyboard(LEFT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_D) == GLFW_PRESS)
        camera.processKeyboard(RIGHT, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_Q) == GLFW_PRESS)
        camera.processKeyboard(UP, deltaTime);
    if (glfwGetKey(window, GLFW_KEY_E) == GLFW_PRESS)
        camera.processKeyboard(DOWN, deltaTime);
}

void Simulation::update(float dt) {
    if (!settings.isPaused) {
        float effectiveDT = dt * settings.timeScale;
        totalTime += effectiveDT;
        blackHole.update(effectiveDT);
        accretionDisk.update(effectiveDT, blackHole.rotationSpeed);
    }
    camera.update(dt);
}

void Simulation::renderUI() {
    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplGlfw_NewFrame();
    ImGui::NewFrame();

    // 1. Cinematic Title HUD Overlay
    ImGui::SetNextWindowPos(ImVec2(20.0f, 20.0f), ImGuiCond_Always);
    ImGui::SetNextWindowBgAlpha(0.35f);
    ImGui::Begin("TitleHUD", nullptr, ImGuiWindowFlags_NoDecoration | ImGuiWindowFlags_AlwaysAutoResize | ImGuiWindowFlags_NoSavedSettings | ImGuiWindowFlags_NoFocusOnAppearing | ImGuiWindowFlags_NoNav);
    ImGui::TextColored(ImVec4(1.0f, 0.8f, 0.3f, 1.0f), "BLACK HOLE");
    ImGui::TextColored(ImVec4(0.7f, 0.8f, 1.0f, 0.8f), "RELATIVISTIC SIMULATION");
    ImGui::Separator();
    ImGui::TextDisabled("TAB: UI | SPACE: Pause | R: Reset Camera");
    ImGui::Text("FPS: %.1f (%.2f ms/frame)", ImGui::GetIO().Framerate, 1000.0f / ImGui::GetIO().Framerate);
    ImGui::End();

    // 2. Main Interactive Control Panel
    ImGui::SetNextWindowPos(ImVec2(20.0f, 145.0f), ImGuiCond_FirstUseEver);
    ImGui::SetNextWindowSize(ImVec2(390.0f, 540.0f), ImGuiCond_FirstUseEver);

    if (ImGui::Begin("Simulation Control Panel", &showUI)) {
        
        // Quick Reset Button to reference cinematic parameters
        if (ImGui::Button("RESET TO CINEMATIC", ImVec2(-1, 28))) {
            blackHole = BlackHole(1.0f, 0.85f, 1.0f);
            accretionDisk = AccretionDisk();
            settings = SimulationSettings();
            camera.reset();
        }
        ImGui::Spacing();

        if (ImGui::BeginTabBar("ControlTabs")) {
            
            // TAB 1: BLACK HOLE
            if (ImGui::BeginTabItem("Black Hole")) {
                ImGui::Spacing();
                ImGui::TextColored(ImVec4(1.0f, 0.75f, 0.2f, 1.0f), "Event Horizon & Spin");
                ImGui::SliderFloat("Mass", &blackHole.mass, 0.5f, 3.0f, "%.2f");
                ImGui::SliderFloat("Spin", &blackHole.spin, -0.998f, 0.998f, "%.3f");
                ImGui::SliderFloat("Rotation Speed", &blackHole.rotationSpeed, 0.0f, 5.0f, "%.2f");

                ImGui::Spacing();
                ImGui::Separator();
                ImGui::TextDisabled("Calculated Metrics:");
                ImGui::Text("  Event Horizon Radius (Rs): %.2f", blackHole.getSchwarzschildRadius());
                ImGui::Text("  Photon Sphere Radius:      %.2f", blackHole.getPhotonSphereRadius());
                ImGui::Text("  ISCO Radius (R_isco):      %.2f", blackHole.getISCORadius());
                
                ImGui::EndTabItem();
            }

            // TAB 2: GRAVITATIONAL LENSING
            if (ImGui::BeginTabItem("Gravitational Lensing")) {
                ImGui::Spacing();
                ImGui::TextColored(ImVec4(1.0f, 0.75f, 0.2f, 1.0f), "Light Bending & Photon Ring");
                ImGui::SliderFloat("Lens Strength", &settings.gravitationalLensing, 0.0f, 3.0f, "%.2f");
                ImGui::SliderFloat("Photon Ring Intensity", &settings.photonRingIntensity, 0.0f, 10.0f, "%.2f");
                ImGui::SliderFloat("Distortion Factor", &settings.gravitationalDistortion, 0.0f, 2.0f, "%.2f");
                ImGui::SliderFloat("Doppler Beaming", &settings.dopplerEffect, 0.0f, 2.0f, "%.2f");
                
                ImGui::EndTabItem();
            }

            // TAB 3: ACCRETION DISK
            if (ImGui::BeginTabItem("Accretion Disk")) {
                ImGui::Spacing();
                ImGui::TextColored(ImVec4(1.0f, 0.75f, 0.2f, 1.0f), "Volumetric Lensed Disk");
                ImGui::SliderFloat("Inner Radius Ratio", &accretionDisk.innerRadiusRatio, 0.8f, 2.5f, "%.2f");
                ImGui::SliderFloat("Outer Radius", &accretionDisk.outerRadius, 6.0f, 25.0f, "%.1f");
                ImGui::SliderFloat("Thickness", &accretionDisk.thickness, 0.05f, 1.5f, "%.2f");
                ImGui::SliderFloat("Brightness", &accretionDisk.brightness, 0.2f, 10.0f, "%.2f");
                ImGui::SliderFloat("Temperature", &accretionDisk.temperature, 0.2f, 3.0f, "%.2f");
                ImGui::SliderFloat("Turbulence", &accretionDisk.turbulence, 0.1f, 4.0f, "%.2f");
                
                ImGui::EndTabItem();
            }

            // TAB 4: RENDERING & QUALITY
            if (ImGui::BeginTabItem("Rendering")) {
                ImGui::Spacing();
                ImGui::TextColored(ImVec4(1.0f, 0.75f, 0.2f, 1.0f), "Performance & 120 FPS Controls");
                
                const char* qualityNames[] = { "FAST (24 steps)", "HIGH PERFORMANCE (48 steps - Max FPS)", "HIGH (64 steps)", "ULTRA (96 steps)" };
                if (ImGui::Combo("Quality Preset", &settings.qualityPreset, qualityNames, 4)) {
                    if (settings.qualityPreset == 0) settings.maxRaySteps = 24;
                    else if (settings.qualityPreset == 1) settings.maxRaySteps = 48;
                    else if (settings.qualityPreset == 2) settings.maxRaySteps = 64;
                    else if (settings.qualityPreset == 3) settings.maxRaySteps = 96;
                }
                ImGui::SliderInt("Ray Steps", &settings.maxRaySteps, 16, 192);

                if (ImGui::Checkbox("Enable VSync (Cap at 60 FPS)", &settings.enableVSync)) {
                    glfwSwapInterval(settings.enableVSync ? 1 : 0);
                }

                ImGui::Spacing();
                ImGui::SliderFloat("Star Density", &settings.starDensity, 0.0f, 2.0f, "%.2f");
                ImGui::SliderFloat("Background Brightness", &settings.backgroundBrightness, 0.0f, 2.0f, "%.2f");
                ImGui::SliderFloat("Bloom Threshold", &settings.bloomThreshold, 0.5f, 3.0f, "%.2f");
                ImGui::SliderFloat("Bloom Intensity", &settings.bloomIntensity, 0.0f, 3.0f, "%.2f");

                ImGui::Spacing();
                ImGui::SliderFloat("Time Scale", &settings.timeScale, 0.0f, 5.0f, "%.2f");
                ImGui::Checkbox("Pause Simulation (SPACE)", &settings.isPaused);
                
                ImGui::EndTabItem();
            }

            // TAB 5: CAMERA
            if (ImGui::BeginTabItem("Camera")) {
                ImGui::Spacing();
                ImGui::TextColored(ImVec4(1.0f, 0.75f, 0.2f, 1.0f), "View Controls");
                ImGui::SliderFloat("Distance", &camera.targetDistance, 3.0f, 40.0f, "%.1f");
                ImGui::SliderFloat("FOV", &camera.targetZoom, 15.0f, 90.0f, "%.1f");
                ImGui::SliderFloat("Speed", &camera.movementSpeed, 1.0f, 20.0f, "%.1f");
                
                if (ImGui::Button("Reset Camera (R)", ImVec2(-1, 0))) {
                    camera.reset();
                }
                
                ImGui::EndTabItem();
            }

            ImGui::EndTabBar();
        }
    }
    ImGui::End();

    ImGui::Render();
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
}

// Static Callbacks
void Simulation::framebufferSizeCallback(GLFWwindow* window, int width, int height) {
    if (g_SimInstance && width > 0 && height > 0) {
        g_SimInstance->windowWidth = width;
        g_SimInstance->windowHeight = height;
        g_SimInstance->camera.setAspectRatio((float)width / (float)height);
        g_SimInstance->renderer.resize(width, height);
    }
}

void Simulation::mouseCallback(GLFWwindow* window, double xpos, double ypos) {
    if (!g_SimInstance) return;

    ImGuiIO& io = ImGui::GetIO();
    if (io.WantCaptureMouse) return;

    if (g_SimInstance->isMouseDragging) {
        if (g_SimInstance->mouseFirst) {
            g_SimInstance->lastMouseX = xpos;
            g_SimInstance->lastMouseY = ypos;
            g_SimInstance->mouseFirst = false;
        }

        float xoffset = (float)(xpos - g_SimInstance->lastMouseX);
        float yoffset = (float)(g_SimInstance->lastMouseY - ypos);

        g_SimInstance->lastMouseX = xpos;
        g_SimInstance->lastMouseY = ypos;

        g_SimInstance->camera.processMouseMovement(xoffset, yoffset);
    }
}

void Simulation::scrollCallback(GLFWwindow* window, double xoffset, double yoffset) {
    if (!g_SimInstance) return;

    ImGuiIO& io = ImGui::GetIO();
    if (io.WantCaptureMouse) return;

    g_SimInstance->camera.processMouseScroll((float)yoffset);
}

void Simulation::mouseButtonCallback(GLFWwindow* window, int button, int action, int mods) {
    if (!g_SimInstance) return;

    ImGuiIO& io = ImGui::GetIO();
    if (io.WantCaptureMouse) return;

    if (button == GLFW_MOUSE_BUTTON_LEFT) {
        if (action == GLFW_PRESS) {
            g_SimInstance->isMouseDragging = true;
            g_SimInstance->mouseFirst = true;
        } else if (action == GLFW_RELEASE) {
            g_SimInstance->isMouseDragging = false;
        }
    }
}

void Simulation::keyCallback(GLFWwindow* window, int key, int scancode, int action, int mods) {
    if (!g_SimInstance) return;

    if (key == GLFW_KEY_TAB && action == GLFW_PRESS) {
        g_SimInstance->showUI = !g_SimInstance->showUI;
    }
    if (key == GLFW_KEY_SPACE && action == GLFW_PRESS) {
        g_SimInstance->settings.isPaused = !g_SimInstance->settings.isPaused;
    }
    if (key == GLFW_KEY_R && action == GLFW_PRESS) {
        g_SimInstance->camera.reset();
    }
}
