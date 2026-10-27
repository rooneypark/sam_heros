//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "Custom/Effect/HcAdditive_Wing" {
Properties {

_MainTex ("Particle Texture", 2D) = "white" { }

_ZDepth ("Z Depth", Float) = 1.0

[Toggle(USE_COLOR_AS_DEPTH)] _UseColorAsDepth ("Use Color As Depth", Float) = 0.0

}
SubShader {
 Tags { "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 Pass {
  Tags { "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 ZTest Less
 ZWrite Off
 Cull Off
  GpuProgramID 49754
}
}
}