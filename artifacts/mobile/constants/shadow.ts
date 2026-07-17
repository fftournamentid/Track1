import { Platform } from 'react-native';

export type ShadowLevel = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const shadows: Record<ShadowLevel, {
  ios: object;
  android: object;
  web: object;
}> = {
  xs: {
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 2 },
    android: { elevation: 1 },
    web:     { boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  },
  sm: {
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 4 },
    android: { elevation: 2 },
    web:     { boxShadow: '0 2px 4px rgba(0,0,0,0.06)' },
  },
  md: {
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12 },
    android: { elevation: 4 },
    web:     { boxShadow: '0 4px 12px rgba(0,0,0,0.08)' },
  },
  lg: {
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.10, shadowRadius: 20 },
    android: { elevation: 8 },
    web:     { boxShadow: '0 8px 20px rgba(0,0,0,0.10)' },
  },
  xl: {
    ios:     { shadowColor: '#000', shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.12, shadowRadius: 32 },
    android: { elevation: 12 },
    web:     { boxShadow: '0 16px 32px rgba(0,0,0,0.12)' },
  },
};

export function shadow(level: ShadowLevel = 'md'): object {
  if (Platform.OS === 'web') return shadows[level].web;
  if (Platform.OS === 'android') return shadows[level].android;
  return shadows[level].ios;
}

export function cardShadow(): object {
  return shadow('sm');
}

export function modalShadow(): object {
  return shadow('lg');
}
