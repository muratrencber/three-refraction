export const refractionVertexGLSL = {name: "refractionVertex", code: `
in vec3 position;
in vec3 normal;
in vec2 uv;
uniform mat4 modelViewMatrix;
uniform mat4 modelMatrix;
uniform mat4 projectionMatrix;

out vec2 texUV;
out vec3 vNormal;
out vec3 localPosition;
out mat4 mWorldMatrix;

void main() {
    vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * modelViewPosition; 
    texUV = uv;
    vNormal = normalize(normal);
    localPosition = position;
    mWorldMatrix = modelMatrix;
}
`};