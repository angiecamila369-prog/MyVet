import { AuthProvider } from "@/contexts/AuthContext";
import { Stack } from "expo-router";



export default function RootLayout(){
  return (
    <AuthProvider>
      <Stack
      screenOptions={{
        headerShown: false
      }}
      >

        <Stack.Screen
          name="index"/>
          <Stack.Screen
          name="(auth)"/>
          <Stack.Screen
          name="main"/>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      </Stack>
    </AuthProvider>
  );
}