import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

type LoadingAnimationProps = {
  size?: number;
};

export default function LoadingAnimation({ size = 150 }: LoadingAnimationProps) {
  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color="#3A85C4" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
