export const xbrUpscaleFragmentGLSL = {name:"xbrUpscaleFragmentGLSL", code:`
precision highp float;

out vec4 fragColor;
void main()
{
    fragColor = col;
}
`};