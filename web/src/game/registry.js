// Global singletons (MonoSingleton<T>.Instance equivalents).
export const G = {
  assets: null,
  MapManager: null,
  HeroManager: null,
  UnitManager: null,
  UnitManagerStatic: { MoveColliderSize: 0.35, IdleColliderSize: 0.3, MY_BT_TIME: 0.07, BT_TIME: 0.1 },
  CameraManager: null,
  PrologueManager: null,
  Physics: null,
  Effects: null,
  Bullets: null,
  WorldUI: null,
  Sound: null,
  UI: null,
  GameState: null,
  User: { isPrologue: true, instantInvincibility: true },
  // ColorSet.cctor @0x23696f8: UnitDamage "FF5A5A", UnitHeal "5AFF5A"
  ColorSet: { UnitDamage: [1, 90 / 255, 90 / 255, 1], Heal: [90 / 255, 1, 90 / 255, 1] },
};
