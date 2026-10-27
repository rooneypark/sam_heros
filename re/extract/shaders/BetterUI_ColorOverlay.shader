//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "BetterUI/ColorOverlay" {
Properties {

_MainTex ("Sprite Texture", 2D) = "white" { }

_StencilComp ("Stencil Comparison", Float) = 8.0

_Stencil ("Stencil ID", Float) = 0.0

_StencilOp ("Stencil Operation", Float) = 0.0

_StencilWriteMask ("Stencil Write Mask", Float) = 255.0

_StencilReadMask ("Stencil Read Mask", Float) = 255.0

_ColorMask ("Color Mask", Float) = 15.0

[Toggle(UNITY_UI_ALPHACLIP)] _UseUIAlphaClip ("Use Alpha Clip", Float) = 0.0

SrcBlendMode ("SrcBlendMode", Float) = 5.0

DstBlendMode ("DstBlendMode", Float) = 10.0

[Toggle(COMBINE_ALPHA)] CombineAlpha ("Combine Alpha", Float) = 0.0

[Toggle(FORCE_CLIP)] ForceClip ("Force Clip", Float) = 0.0

ClipThreshold ("Alpha Clip Threshold", Float) = 0.5

}
SubShader {
 Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 Pass {
 Name "ColorOverlay"
  Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 ZTest Off
 ZWrite Off
 Cull Off
  GpuProgramID 49702
}
}
}