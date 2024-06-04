export const screenSizeGLSL = {name:"screenSize", code:`
#ifdef USE_SCREEN_SIZE
#else
#define USE_SCREEN_SIZE
uniform vec2 screenSize;
uniform vec2 lowResScreenSize;
#endif
`};