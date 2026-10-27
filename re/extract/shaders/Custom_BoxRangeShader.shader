//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "Custom/BoxRangeShader" {
Properties {

[Header(Base)] _Color ("Color", Color) = (1,1,1,1)

_MainTex ("MainTex", 2D) = "white" { }

_Intensity ("Intensity", Float) = 1.0

_Outline ("Outline", Range(0, 5)) = 0.3499999940395355

_OutlineAlpha ("Outline Alpha", Range(0, 1)) = 0.5

[MaterialToggle] _Indicator ("Indicator", Float) = 1.0

[Header(Flow)] _FlowColor ("Flow Color", Color) = (1,1,1,1)

_FlowFade ("Fade", Range(0, 1)) = 1.0

_Duration ("Duration", Range(0, 1)) = 0.0

[Header(Blend)] [Enum(UnityEngine.Rendering.BlendMode)] _SrcBlend ("Src Blend Mode", Float) = 1.0

[Enum(UnityEngine.Rendering.BlendMode)] _DstBlend ("Dst Blend Mode", Float) = 1.0

}
SubShader {
 Tags { "IGNOREPROJECTOR" = "true" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 Pass {
  Tags { "IGNOREPROJECTOR" = "true" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 ZTest Always
 ZWrite Off
  GpuProgramID 59450
}
}
}