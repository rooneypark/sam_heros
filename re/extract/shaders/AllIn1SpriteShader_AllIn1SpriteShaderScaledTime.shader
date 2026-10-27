//////////////////////////////////////////
//
// NOTE: This is *not* a valid shader file
//
///////////////////////////////////////////
Shader "AllIn1SpriteShader/AllIn1SpriteShaderScaledTime" {
Properties {

_MainTex ("Main Texture", 2D) = "white" { }

_Color ("Main Color", Color) = (1,1,1,1)

_Alpha ("General Alpha", Range(0, 1)) = 1.0

_GlowColor ("Glow Color", Color) = (1,1,1,1)

_Glow ("Glow Color Intensity", Range(0, 100)) = 10.0

_GlowGlobal ("Global Glow Intensity", Range(1, 100)) = 1.0

_GlowTex ("Glow Texture", 2D) = "white" { }

_FadeTex ("Fade Texture", 2D) = "white" { }

_FadeAmount ("Fade Amount", Range(-0.1, 1)) = -0.10000000149011612

_FadeBurnWidth ("Fade Burn Width", Range(0, 1)) = 0.02500000037252903

_FadeBurnTransition ("Burn Transition", Range(0.01, 0.5)) = 0.07500000298023224

_FadeBurnColor ("Fade Burn Color", Color) = (1,1,0,1)

_FadeBurnTex ("Fade Burn Texture", 2D) = "white" { }

_FadeBurnGlow ("Fade Burn Glow", Range(1, 250)) = 2.0

_OutlineColor ("Outline Base Color", Color) = (1,1,1,1)

_OutlineAlpha ("Outline Base Alpha", Range(0, 1)) = 1.0

_OutlineGlow ("Outline Base Glow", Range(1, 100)) = 1.5

_OutlineWidth ("Outline Base Width", Range(0, 0.2)) = 0.004000000189989805

_OutlinePixelWidth ("Outline Base Pixel Width", Float) = 1.0

[Space] _OutlineTex ("Outline Texture", 2D) = "white" { }

_OutlineTexXSpeed ("Texture scroll speed X", Range(-50, 50)) = 10.0

_OutlineTexYSpeed ("Texture scroll speed Y", Range(-50, 50)) = 0.0

[Space] _OutlineDistortTex ("Outline Distortion Texture", 2D) = "white" { }

_OutlineDistortAmount ("Outline Distortion Amount", Range(0, 2)) = 0.5

_OutlineDistortTexXSpeed ("Distortion scroll speed X", Range(-50, 50)) = 5.0

_OutlineDistortTexYSpeed ("Distortion scroll speed Y", Range(-50, 50)) = 5.0

_AlphaOutlineColor ("Color", Color) = (1,1,1,1)

_AlphaOutlineGlow ("Outline Glow", Range(1, 100)) = 5.0

_AlphaOutlinePower ("Power", Range(0, 5)) = 1.0

_AlphaOutlineMinAlpha ("Min Alpha", Range(0, 1)) = 0.0

_AlphaOutlineBlend ("Blend", Range(0, 1)) = 1.0

_GradBlend ("Gradient Blend", Range(0, 1)) = 1.0

_GradTopLeftCol ("Top Color", Color) = (1,0,0,1)

_GradTopRightCol ("Top Color 2", Color) = (1,1,0,1)

_GradBotLeftCol ("Bot Color", Color) = (0,0,1,1)

_GradBotRightCol ("Bot Color 2", Color) = (0,1,0,1)

_ColorSwapTex ("Color Swap Texture", 2D) = "black" { }

_ColorSwapRed ("Red Channel", Color) = (1,1,1,1)

_ColorSwapRedLuminosity ("Red luminosity", Range(-1, 1)) = 0.5

_ColorSwapGreen ("Green Channel", Color) = (1,1,1,1)

_ColorSwapGreenLuminosity ("Green luminosity", Range(-1, 1)) = 0.5

_ColorSwapBlue ("Blue Channel", Color) = (1,1,1,1)

_ColorSwapBlueLuminosity ("Blue luminosity", Range(-1, 1)) = 0.5

_HsvShift ("Hue Shift", Range(0, 360)) = 180.0

_HsvSaturation ("Saturation", Range(0, 2)) = 1.0

_HsvBright ("Brightness", Range(0, 2)) = 1.0

_HitEffectColor ("Hit Effect Color", Color) = (1,1,1,1)

_HitEffectGlow ("Glow Intensity", Range(1, 100)) = 5.0

[Space] _HitEffectBlend ("Hit Effect Blend", Range(0, 1)) = 1.0

_NegativeAmount ("Negative Amount", Range(0, 1)) = 1.0

_PixelateSize ("Pixelate size", Range(4, 512)) = 32.0

_ColorRampTex ("Color ramp Texture", 2D) = "white" { }

_ColorRampLuminosity ("Color ramp luminosity", Range(-1, 1)) = 0.0

[Toggle()] _ColorRampOutline ("Affects everything?", Float) = 0.0

_GreyscaleLuminosity ("Greyscale luminosity", Range(-1, 1)) = 0.0

[Toggle()] _GreyscaleOutline ("Affects everything?", Float) = 0.0

_GreyscaleTintColor ("Greyscale Tint Color", Color) = (1,1,1,1)

_PosterizeNumColors ("Number of Colors", Range(0, 100)) = 8.0

_PosterizeGamma ("Posterize Amount", Range(0.1, 10)) = 0.75

[Toggle()] _PosterizeOutline ("Affects everything?", Float) = 0.0

_BlurIntensity ("Blur Intensity", Range(0, 100)) = 10.0

[Toggle()] _BlurHD ("Blur is Low Res?", Float) = 0.0

_MotionBlurAngle ("Motion Blur Angle", Range(-1, 1)) = 0.10000000149011612

_MotionBlurDist ("Motion Blur Distance", Range(-3, 3)) = 1.25

_GhostColorBoost ("Ghost Color Boost", Range(0, 5)) = 1.0

_GhostTransparency ("Ghost Transparency", Range(0, 1)) = 0.0

_InnerOutlineColor ("Inner Outline Color", Color) = (1,0,0,1)

_InnerOutlineThickness ("Outline Thickness", Range(0, 3)) = 1.0

_InnerOutlineAlpha ("Inner Outline Alpha", Range(0, 1)) = 1.0

_InnerOutlineGlow ("Inner Outline Glow", Range(1, 250)) = 4.0

_AlphaCutoffValue ("Alpha cutoff value", Range(0, 1)) = 0.25

[Toggle()] _OnlyOutline ("Only render outline?", Float) = 0.0

[Toggle()] _OnlyInnerOutline ("Only render inner outline?", Float) = 0.0

_HologramStripesAmount ("Stripes Amount", Range(0, 1)) = 0.10000000149011612

_HologramUnmodAmount ("Unchanged Amount", Range(0, 1)) = 0.0

_HologramStripesSpeed ("Stripes Speed", Range(-20, 20)) = 4.5

_HologramMinAlpha ("Min Alpha", Range(0, 1)) = 0.10000000149011612

_HologramMaxAlpha ("Max Alpha", Range(0, 100)) = 0.75

_ChromAberrAmount ("ChromAberr Amount", Range(0, 1)) = 1.0

_ChromAberrAlpha ("ChromAberr Alpha", Range(0, 1)) = 0.4000000059604645

_GlitchAmount ("Glitch Amount", Range(0, 20)) = 3.0

_FlickerPercent ("Flicker Percent", Range(0, 1)) = 0.05000000074505806

_FlickerFreq ("Flicker Frequency", Range(0, 5)) = 0.20000000298023224

_FlickerAlpha ("Flicker Alpha", Range(0, 1)) = 0.0

_ShadowX ("Shadow X Axis", Range(-0.5, 0.5)) = 0.10000000149011612

_ShadowY ("Shadow Y Axis", Range(-0.5, 0.5)) = -0.05000000074505806

_ShadowAlpha ("Shadow Alpha", Range(0, 1)) = 0.5

_ShadowColor ("Shadow Color", Color) = (0,0,0,1)

_HandDrawnAmount ("Hand Drawn Amount", Range(0, 20)) = 10.0

_HandDrawnSpeed ("Hand Drawn Speed", Range(1, 15)) = 5.0

_GrassSpeed ("Speed", Range(0, 50)) = 2.0

_GrassWind ("Bend amount", Range(0, 50)) = 20.0

[Space] [Toggle()] _GrassManualToggle ("Manually animated?", Float) = 0.0

_GrassManualAnim ("Manual Anim Value", Range(-1, 1)) = 1.0

_WaveAmount ("Wave Amount", Range(0, 25)) = 7.0

_WaveSpeed ("Wave Speed", Range(0, 25)) = 10.0

_WaveStrength ("Wave Strength", Range(0, 25)) = 7.5

_WaveX ("Wave X Axis", Range(0, 1)) = 0.0

_WaveY ("Wave Y Axis", Range(0, 1)) = 0.5

_RectSize ("Rect Size", Range(1, 4)) = 1.0

_OffsetUvX ("X axis", Range(-1, 1)) = 0.0

_OffsetUvY ("Y axis", Range(-1, 1)) = 0.0

_ClipUvLeft ("Clipping Left", Range(0, 1)) = 0.0

_ClipUvRight ("Clipping Right", Range(0, 1)) = 0.0

_ClipUvUp ("Clipping Up", Range(0, 1)) = 0.0

_ClipUvDown ("Clipping Down", Range(0, 1)) = 0.0

_TextureScrollXSpeed ("Speed X Axis", Range(-5, 5)) = 1.0

_TextureScrollYSpeed ("Speed Y Axis", Range(-5, 5)) = 0.0

_ZoomUvAmount ("Zoom Amount", Range(0.1, 5)) = 0.5

_DistortTex ("Distortion Texture", 2D) = "white" { }

_DistortAmount ("Distortion Amount", Range(0, 2)) = 0.5

_DistortTexXSpeed ("Scroll speed X", Range(-50, 50)) = 5.0

_DistortTexYSpeed ("Scroll speed Y", Range(-50, 50)) = 5.0

_TwistUvAmount ("Twist Amount", Range(0, 3.1416)) = 1.0

_TwistUvPosX ("Twist Pos X Axis", Range(0, 1)) = 0.5

_TwistUvPosY ("Twist Pos Y Axis", Range(0, 1)) = 0.5

_TwistUvRadius ("Twist Radius", Range(0, 3)) = 0.75

_RotateUvAmount ("Rotate Angle(radians)", Range(0, 6.2831)) = 0.0

_FishEyeUvAmount ("Fish Eye Amount", Range(0, 0.5)) = 0.3499999940395355

_PinchUvAmount ("Pinch Amount", Range(0, 0.5)) = 0.3499999940395355

_ShakeUvSpeed ("Shake Speed", Range(0, 20)) = 2.5

_ShakeUvX ("X Multiplier", Range(0, 5)) = 1.5

_ShakeUvY ("Y Multiplier", Range(0, 5)) = 1.0

_ColorChangeTolerance ("Tolerance", Range(0, 1)) = 0.25

_ColorChangeTarget ("Color to change", Color) = (1,0,0,1)

_ColorChangeNewCol ("New Color", Color) = (1,1,0,1)

_ColorChangeLuminosity ("New Color Luminosity", Range(0, 1)) = 0.0

_RoundWaveStrength ("Wave Strength", Range(0, 1)) = 0.699999988079071

_RoundWaveSpeed ("Wave Speed", Range(0, 5)) = 2.0

[Toggle()] _BillboardY ("Billboard on both axis?", Float) = 0.0

_ZWrite ("Depth Write", Float) = 0.0

_MySrcMode ("SrcMode", Float) = 5.0

_MyDstMode ("DstMode", Float) = 10.0

_ShineColor ("Shine Color", Color) = (1,1,1,1)

_ShineLocation ("Shine Location", Range(0, 1)) = 0.5

_ShineRotate ("Rotate Angle(radians)", Range(0, 6.2831)) = 0.0

_ShineWidth ("Shine Width", Range(0.05, 1)) = 0.10000000149011612

_ShineGlow ("Shine Glow", Range(0, 100)) = 1.0

_ShineMask ("Shine Mask", 2D) = "white" { }

_GlitchSize ("Glitch Size", Range(0.25, 5)) = 1.0

_HologramStripeColor ("Stripes Color", Color) = (0,1,1,1)

_GradBoostX ("Boost X axis", Range(0.1, 5)) = 1.2000000476837158

_GradBoostY ("Boost Y axis", Range(0.1, 5)) = 1.2000000476837158

[Toggle()] _GradIsRadial ("Radial Gradient?", Float) = 0.0

_AlphaRoundThreshold ("Round Threshold", Range(0.005, 1)) = 0.5

_GrassRadialBend ("Radial Bend", Range(0, 5)) = 0.10000000149011612

_ColorChangeTolerance2 ("Tolerance 2", Range(0, 1)) = 0.25

_ColorChangeTarget2 ("Color to change 2", Color) = (1,0,0,1)

_ColorChangeNewCol2 ("New Color 2", Color) = (1,1,0,1)

_ColorChangeTolerance3 ("Tolerance 3", Range(0, 1)) = 0.25

_ColorChangeTarget3 ("Color to change 3", Color) = (1,0,0,1)

_ColorChangeNewCol3 ("New Color 3", Color) = (1,1,0,1)

_Contrast ("Contrast", Range(0, 6)) = 1.0

_Brightness ("Brightness", Range(-1, 1)) = 0.0

_ColorSwapBlend ("Color Swap Blend", Range(0, 1)) = 1.0

_ColorRampBlend ("Color Ramp Blend", Range(0, 1)) = 1.0

_GreyscaleBlend ("Greyscale Blend", Range(0, 1)) = 1.0

_GhostBlend ("Ghost Blend", Range(0, 1)) = 1.0

_HologramBlend ("Hologram Blend", Range(0, 1)) = 1.0

[AllIn1ShaderGradient] _ColorRampTexGradient ("Color ramp Gradient", 2D) = "white" { }

_OverlayTex ("Overlay Texture", 2D) = "white" { }

_OverlayColor ("Overlay Color", Color) = (1,1,1,1)

_OverlayGlow ("Overlay Glow", Range(0, 25)) = 1.0

_OverlayBlend ("Overlay Blend", Range(0, 1)) = 1.0

_ZTestMode ("Z Test Mode", Float) = 4.0

_CullingOption ("Culling Option", Float) = 0.0

_MinXUV ("_MinXUV", Range(0, 1)) = 0.0

_MaxXUV ("_MaxXUV", Range(0, 1)) = 1.0

_MinYUV ("_MinYUV", Range(0, 1)) = 0.0

_MaxYUV ("_MaxYUV", Range(0, 1)) = 1.0

_RandomSeed ("_MaxYUV", Range(0, 10000)) = 0.0

_EditorDrawers ("Editor Drawers", Float) = 6.0

}
SubShader {
 Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 Pass {
  Tags { "CanUseSpriteAtlas" = "true" "IGNOREPROJECTOR" = "true" "PreviewType" = "Plane" "QUEUE" = "Transparent" "RenderType" = "Transparent" }
 ZTest Off
 ZWrite Off
 Cull Off
  GpuProgramID 47770
}
}
CustomEditor "AllIn1SpriteShaderMaterialInspector"
}