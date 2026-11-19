#include "Shader.hpp"
#include <fstream>
#include <sstream>
#include <iostream>
#include <glm/gtc/type_ptr.hpp>

Shader::Shader() : id(0) {}

Shader::Shader(const char* vertexPath, const char* fragmentPath) : id(0) {
    loadFromFiles(vertexPath, fragmentPath);
}

Shader::~Shader() {
    if (id != 0) {
        glDeleteProgram(id);
    }
}

bool Shader::loadFromFiles(const char* vertexPath, const char* fragmentPath) {
    std::string vertexCode;
    std::string fragmentCode;
    std::ifstream vShaderFile;
    std::ifstream fShaderFile;

    vShaderFile.exceptions(std::ifstream::failbit | std::ifstream::badbit);
    fShaderFile.exceptions(std::ifstream::failbit | std::ifstream::badbit);

    try {
        vShaderFile.open(vertexPath);
        fShaderFile.open(fragmentPath);
        std::stringstream vShaderStream, fShaderStream;
        vShaderStream << vShaderFile.rdbuf();
        fShaderStream << fShaderFile.rdbuf();
        vShaderFile.close();
        fShaderFile.close();
        vertexCode = vShaderStream.str();
        fragmentCode = fShaderStream.str();
    } catch (const std::ifstream::failure &e) {
        std::cerr << "ERROR::SHADER::FILE_NOT_SUCCESSFULLY_READ: " << e.what() 
                  << "\n  Vertex path: " << vertexPath 
                  << "\n  Fragment path: " << fragmentPath << std::endl;
        return false;
    }

    const char* vShaderCode = vertexCode.c_str();
    const char* fShaderCode = fragmentCode.c_str();

    GLuint vertex = glCreateShader(GL_VERTEX_SHADER);
    glShaderSource(vertex, 1, &vShaderCode, NULL);
    glCompileShader(vertex);
    if (!checkCompileErrors(vertex, "VERTEX")) return false;

    GLuint fragment = glCreateShader(GL_FRAGMENT_SHADER);
    glShaderSource(fragment, 1, &fShaderCode, NULL);
    glCompileShader(fragment);
    if (!checkCompileErrors(fragment, "FRAGMENT")) return false;

    if (id != 0) {
        glDeleteProgram(id);
    }

    id = glCreateProgram();
    glAttachShader(id, vertex);
    glAttachShader(id, fragment);
    glLinkProgram(id);
    if (!checkCompileErrors(id, "PROGRAM")) return false;

    glDeleteShader(vertex);
    glDeleteShader(fragment);

    uniformLocationCache.clear();
    return true;
}

void Shader::use() const {
    if (id != 0) {
        glUseProgram(id);
    }
}

GLint Shader::getUniformLocation(const std::string &name) const {
    if (uniformLocationCache.find(name) != uniformLocationCache.end()) {
        return uniformLocationCache[name];
    }
    GLint location = glGetUniformLocation(id, name.c_str());
    uniformLocationCache[name] = location;
    return location;
}

void Shader::setBool(const std::string &name, bool value) const {
    glUniform1i(getUniformLocation(name), (int)value);
}

void Shader::setInt(const std::string &name, int value) const {
    glUniform1i(getUniformLocation(name), value);
}

void Shader::setFloat(const std::string &name, float value) const {
    glUniform1f(getUniformLocation(name), value);
}

void Shader::setVec2(const std::string &name, const glm::vec2 &value) const {
    glUniform2f(getUniformLocation(name), value.x, value.y);
}

void Shader::setVec2(const std::string &name, float x, float y) const {
    glUniform2f(getUniformLocation(name), x, y);
}

void Shader::setVec3(const std::string &name, const glm::vec3 &value) const {
    glUniform3f(getUniformLocation(name), value.x, value.y, value.z);
}

void Shader::setVec3(const std::string &name, float x, float y, float z) const {
    glUniform3f(getUniformLocation(name), x, y, z);
}

void Shader::setVec4(const std::string &name, const glm::vec4 &value) const {
    glUniform4f(getUniformLocation(name), value.x, value.y, value.z, value.w);
}

void Shader::setMat4(const std::string &name, const glm::mat4 &mat) const {
    glUniformMatrix4fv(getUniformLocation(name), 1, GL_FALSE, glm::value_ptr(mat));
}

bool Shader::checkCompileErrors(GLuint shader, const std::string &type) {
    GLint success;
    GLchar infoLog[1024];
    if (type != "PROGRAM") {
        glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
        if (!success) {
            glGetShaderInfoLog(shader, 1024, NULL, infoLog);
            std::cerr << "ERROR::SHADER_COMPILATION_ERROR of type: " << type << "\n" << infoLog << "\n -- --------------------------------------------------- -- " << std::endl;
            return false;
        }
    } else {
        glGetProgramiv(shader, GL_LINK_STATUS, &success);
        if (!success) {
            glGetProgramInfoLog(shader, 1024, NULL, infoLog);
            std::cerr << "ERROR::PROGRAM_LINKING_ERROR of type: " << type << "\n" << infoLog << "\n -- --------------------------------------------------- -- " << std::endl;
            return false;
        }
    }
    return true;
}
