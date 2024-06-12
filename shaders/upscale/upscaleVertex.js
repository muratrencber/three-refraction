export const upscaleVertexGLSL = {name:"upscaleVertex", code:`
in vec3 position;
in vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
uniform mat4 modelMatrix;
out vec3 localNormal;
out mat4 worldMatrix;
out vec3 localPosition;
void main() {
  vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewPosition; 
  localNormal = normalize( normal );
  worldMatrix = modelMatrix;
  localPosition = position;
}
`};