export const intersectionGLSL = {name:"struct_intersection", code:`
#ifdef USE_INTERSECTION
#else
struct intersectionResult
{
    int hit;
    float t;
    vec3 point;
    vec3 normal;
};

struct ray
{
    vec3 origin;
    vec3 direction;
};

struct plane
{
    vec3 normal;
    vec3 point;
};

struct triangle
{
    vec3 v0;
    vec3 v1;
    vec3 v2;
};
#endif
`};