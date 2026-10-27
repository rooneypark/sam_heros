//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "Custom/Effect/Hc Alpha Blended Wing" {
Properties {

_MainTex ("Particle Texture", 2D) = "white" { }

_ZDepth ("Z Depth", Float) = 1.0

[Toggle(USE_COLOR_AS_DEPTH)] _UseColorAsDepth ("Use Color As Depth", Float) = 0.0

_Color ("Wing Color", Color) = (1,1,1,1)

[Toggle(USE_SECOND_COLOR)] _UseSecondColor ("Use Second Color", Float) = 0.0

_Color2 ("Second Color", Color) = (1,1,1,1)

}
SubShader {
 Tags { "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 Pass {
  Tags { "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 ZTest Less
 ZWrite Off
 Cull Off
  GpuProgramID 31274
}
}
}