#include "Simulation.hpp"
#include <iostream>

int main(int argc, char** argv) {
    std::cout << "========================================================\n"
              << "       BLACK HOLE RELATIVISTIC SIMULATION (C++)\n"
              << "========================================================\n"
              << "Initializing OpenGL 4.3 rendering context & graphics...\n"
              << std::endl;

    Simulation sim;
    if (!sim.init(1280, 720, "Black Hole Relativistic Simulation")) {
        std::cerr << "Failed to initialize Black Hole Simulation application!" << std::endl;
        return -1;
    }

    std::cout << "Simulation initialized successfully.\n"
              << "Controls:\n"
              << "  [W][A][S][D] - Orbit / Move Camera\n"
              << "  [Q][E]       - Move Camera Vertically\n"
              << "  Mouse Drag   - Look around\n"
              << "  Mouse Scroll - Zoom (FOV)\n"
              << "  [TAB]        - Toggle ImGui Control Panel\n"
              << "  [R]          - Reset Camera Position\n"
              << "  [ESC]        - Exit\n"
              << std::endl;

    sim.run();

    std::cout << "Exiting simulation. Clean shutdown completed." << std::endl;
    return 0;
}
