//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "Custom/BgOpaque" {
Properties {

_MainTex ("Sprite Texture", 2D) = "white" { }

_Color ("Tint", Color) = (1,1,1,1)

[MaterialToggle] PixelSnap ("Pixel snap", Float) = 0.0

_RendererColor ("RendererColor", Color) = (1,1,1,1)

_Flip ("Flip", Vector) = (1,1,1,1)

_AlphaTex ("External Alpha", 2D) = "white" { }

_EnableExternalAlpha ("Enable External Alpha", Float) = 0.0

}
SubShader {
 Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Geometry" "RenderType" = "Opaque" }
 Pass {
  Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Geometry" "RenderType" = "Opaque" }
 ZTest Always
 ZWrite Off
  GpuProgramID 25384
}
}
}