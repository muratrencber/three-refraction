export const envMapUtilsGLSL = {name:"envMapUtils", code:`
#ifdef USE_ENV_MAP
#else
#define USE_ENV_MAP
uniform samplerCube envMap;
vec4 sampleEnvMap(vec3 direction) {
    direction.x = -direction.x;
    return texture(envMap, direction);
}
#endif
`};