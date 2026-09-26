import { useState } from 'react';
import { StyleSheet, TextInput, TextInputProps, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type InputProps = TextInputProps & {
  label?: string;
  icon?: string;
  error?: string;
  isPassword?: boolean;
};

export function Input({ label, icon, error, isPassword, style, ...rest }: InputProps) {
  const theme = useTheme();
  const [hidden, setHidden] = useState(!!isPassword);

  return (
    <View style={styles.wrapper}>
      {label ? <ThemedText style={[styles.label, { color: theme.textSecondary }]}>{label}</ThemedText> : null}
      <View
        style={[
          styles.container,
          { backgroundColor: theme.surface, borderColor: error ? theme.danger : theme.border },
        ]}>
        {icon ? <ThemedText style={styles.icon}>{icon}</ThemedText> : null}
        <TextInput
          style={[styles.input, { color: theme.text }, style]}
          placeholderTextColor={theme.textSecondary}
          secureTextEntry={hidden}
          {...rest}
        />
        {isPassword ? (
          <TouchableOpacity onPress={() => setHidden((h) => !h)} hitSlop={10}>
            <ThemedText style={styles.icon}>{hidden ? '🙈' : '👁'}</ThemedText>
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <ThemedText style={[styles.error, { color: theme.danger }]}>{error}</ThemedText> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600' },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  icon: { fontSize: 16 },
  input: { flex: 1, paddingVertical: 15, fontSize: 16 },
  error: { fontSize: 12, marginLeft: 4 },
});
