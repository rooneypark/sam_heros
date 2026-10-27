//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "Custom/SuperBlurPostEffect" {
Properties {

_MainTex ("", 2D) = "white" { }

}
SubShader {
 Pass {
 ZTest Always
 ZWrite Off
 Cull Off
  GpuProgramID 40808
}
 Pass {
 ZTest Always
 ZWrite Off
 Cull Off
  GpuProgramID 86259
}
 Pass {
 ZTest Always
 ZWrite Off
 Cull Off
  GpuProgramID 171792
}
 Pass {
 ZTest Always
 ZWrite Off
 Cull Off
  GpuProgramID 217950
}
 Pass {
 ZTest Always
 ZWrite Off
 Cull Off
  GpuProgramID 300377
}
 Pass {
 ZTest Always
 ZWrite Off
 Cull Off
  GpuProgramID 393183
}
 Pass {
 ZTest Always
 ZWrite Off
 Cull Off
  GpuProgramID 405578
}
}
}