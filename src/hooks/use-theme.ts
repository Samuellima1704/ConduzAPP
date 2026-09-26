/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';

// O ConduzAPP segue sempre a identidade visual clara validada na Banca de Qualificação,
// independente do tema do sistema operacional.
export function useTheme() {
  return Colors.light;
}
