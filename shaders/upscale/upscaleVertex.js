export const upscaleVertexGLSL = {name:"upscaleVertex", code:`
in vec3 position;
in vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
#ifdef PRESERVE_NORMALS
out vec3 localNormal;
#endif
void main() {
  vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewPosition; 
#ifdef PRESERVE_NORMALS
  localNormal = normalize( normal );
#endif
}
`};