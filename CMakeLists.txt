cmake_minimum_required(VERSION 3.20)
project(BlackHoleSimulation VERSION 1.0.0 LANGUAGES C CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Optimization flags
if(MSVC)
    add_compile_options(/W4 /O2)
else()
    add_compile_options(-Wall -Wextra -O3 -ffast-math -Wno-array-bounds -Wno-stringop-overflow)
endif()

# Find dependencies
find_package(OpenGL REQUIRED)
find_package(glfw3 CONFIG REQUIRED)
find_package(glm CONFIG REQUIRED)

# Include directories
include_directories(
    ${CMAKE_CURRENT_SOURCE_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/src/imgui
    ${CMAKE_CURRENT_SOURCE_DIR}/src/imgui/backends
)

# Source files
set(SOURCES
    src/main.cpp
    src/BlackHole.cpp
    src/AccretionDisk.cpp
    src/Camera.cpp
    src/Renderer.cpp
    src/Shader.cpp
    src/Simulation.cpp
    src/glad.c
    
    # Dear ImGui sources
    src/imgui/imgui.cpp
    src/imgui/imgui_draw.cpp
    src/imgui/imgui_widgets.cpp
    src/imgui/imgui_tables.cpp
    src/imgui/imgui_demo.cpp
    src/imgui/backends/imgui_impl_glfw.cpp
    src/imgui/backends/imgui_impl_opengl3.cpp
)

# Executable target
add_executable(BlackHoleSimulation ${SOURCES})

# Link libraries
target_link_libraries(BlackHoleSimulation PRIVATE
    OpenGL::GL
    glfw
    glm::glm
)

# Copy shaders to output binary directory post-build
add_custom_command(TARGET BlackHoleSimulation POST_BUILD
    COMMAND ${CMAKE_COMMAND} -E copy_directory
        ${CMAKE_CURRENT_SOURCE_DIR}/shaders
        $<TARGET_FILE_DIR:BlackHoleSimulation>/shaders
)

message(STATUS "Black Hole Simulation configured successfully.")
