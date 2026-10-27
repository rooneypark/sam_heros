//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "Spine/Skeleton" {
Properties {

_Cutoff ("Shadow alpha cutoff", Range(0, 1)) = 0.10000000149011612

_MainTex ("Main Texture", 2D) = "black" { }

[Toggle(_STRAIGHT_ALPHA_INPUT)] _StraightAlphaInput ("Straight Alpha Texture", Float) = 0.0

_StencilRef ("Stencil Reference", Float) = 1.0

[Enum(UnityEngine.Rendering.CompareFunction)] _StencilComp ("Stencil Comparison", Float) = 8.0

_OutlineWidth ("Outline Width", Range(0, 8)) = 3.0

_OutlineColor ("Outline Color", Color) = (1,1,0,1)

_OutlineReferenceTexWidth ("Reference Texture Width", Float) = 1024.0

_ThresholdEnd ("Outline Threshold", Range(0, 1)) = 0.25

_OutlineSmoothness ("Outline Smoothness", Range(0, 1)) = 1.0

[MaterialToggle(_USE8NEIGHBOURHOOD_ON)] _Use8Neighbourhood ("Sample 8 Neighbours", Float) = 1.0

_OutlineOpaqueAlpha ("Opaque Alpha", Range(0, 1)) = 1.0

_OutlineMipLevel ("Outline Mip Level", Range(0, 3)) = 0.0

}
SubShader {
 Tags { "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 Pass {
 Name "Normal"
  Tags { "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 ZWrite Off
 Cull Off
  GpuProgramID 11731
}
 Pass {
 Name "Caster"
  Tags { "IGNOREPROJECTOR" = "true" "LIGHTMODE" = "SHADOWCASTER" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" "SHADOWSUPPORT" = "true" }
 Cull Off
 Offset 1.0, 1.0
  GpuProgramID 87978
}
}
CustomEditor "SpineShaderWithOutlineGUI"
}