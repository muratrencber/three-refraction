export const exampleFragmentGLSL = {name:"exampleFragment", code:`
precision highp float;

in vec4 vertexColor;
in vec3 localNormal;
in vec2 uvResult;

uniform sampler2D targetTex;
#ifndef HW_FILTERING
#ifdef PRESERVE_NORMALS
#endif
#endif

layout(location=0) out vec4 fragColor;
#ifndef HW_FILTERING
    layout(location=1) out vec4 normalsOrMask;
#endif
void main()
{
    fragColor = texture(targetTex, uvResult);
#ifndef HW_FILTERING
#ifdef PRESERVE_NORMALS
    normalsOrMask = vec4((localNormal.xyz + 1.) / 2., 0.);
#else
    normalsOrMask = vec4(0.);
#endif
#endif
}
`};