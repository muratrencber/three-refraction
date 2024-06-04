export const exampleVertexGLSL = {name:"exampleVertex", code:`
in vec3 position;
in vec3 normal;
in vec3 color;
in vec2 uv;

uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
out vec3 localNormal;
out vec2 uvResult;
#ifdef PRESERVE_NORMALS
#endif
out vec4 vertexColor;
void main() {
  uvResult = uv;
  vertexColor = vec4(color, 1.);
  vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * modelViewPosition; 
  localNormal = normalize( normal );
#ifdef PRESERVE_NORMALS
#endif
}
`};