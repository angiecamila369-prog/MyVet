import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

type EmptyAnimationProps = {
  size?: number;
};

export default function EmptyAnimation({ size = 150 }: EmptyAnimationProps) {
  return (
    <View style={styles.container}>
      <MaterialIcons name="inbox" size={size / 2} color="#d1d5db" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
