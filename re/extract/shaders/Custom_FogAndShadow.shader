//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "Custom/FogAndShadow" {
Properties {

_MainTex ("Sprite Texture", 2D) = "white" { }

_Color ("Tint", Color) = (1,1,1,1)

_ShadowColor ("ShadowTint", Color) = (1,1,1,1)

_Flip ("Flip", Vector) = (1,1,1,1)

}
SubShader {
 Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent+10" "RenderType" = "Opaque" }
 Pass {
  Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent+10" "RenderType" = "Opaque" }
 ZTest Always
 ZWrite Off
  GpuProgramID 32936
}
 Pass {
  Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent+10" "RenderType" = "Opaque" }
 ZTest Off
 ZWrite Off
  GpuProgramID 115587
}
}
Fall back "Transparent"
}