//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "Hidden/Internal-DeferredShading" {
Properties {

_LightTexture0 ("", any) = "" { }

_LightTextureB0 ("", 2D) = "" { }

_ShadowMapTexture ("", any) = "" { }

_SrcBlend ("", Float) = 1.0

_DstBlend ("", Float) = 1.0

}
SubShader {
 Pass {
  Tags { "SHADOWSUPPORT" = "true" }
 ZWrite Off
  GpuProgramID 7517
}
 Pass {
 ZTest Always
 ZWrite Off
 Cull Off
  GpuProgramID 129378
}
}
}