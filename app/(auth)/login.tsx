import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import LoadingAnimation from "@/components/LoadingAnimation";
import { useAuth } from "@/contexts/AuthContext";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { login } = useAuth();

  const handleLogin = async () => {
    try {
      setLoading(true);
      await login(email, password);
      router.replace("/main");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* LOGO */}
      <View style={styles.logoContainer}>
        <Image
          source={require("../../assets/images/logo.jpg")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* LOGIN CARD */}
      <View style={styles.card}>
        <Text style={styles.title}>Log In</Text>

        {/* EMAIL */}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#A0A0A0"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        {/* PASSWORD */}
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#A0A0A0"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

    
        {/* LOGIN BUTTON */}
        {loading ? (
          <View style={styles.loadingButton}>
            <LoadingAnimation size={80} />
            <Text style={styles.loadingText}>Signing in...</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.button} onPress={handleLogin}>
            <Text style={styles.buttonText}>Log In</Text>
          </TouchableOpacity>
        )}
            {/* Forgot Password */}
        <TouchableOpacity
          style={styles.forgotButton}
          onPress={() => router.push("/(auth)/reset")}
        >
          <Text style={styles.forgotText}>Forgot password?</Text>
        </TouchableOpacity>

      </View>

      {/* REGISTER LINK */}
      <View style={styles.bottomTextContainer}>
        <Text style={styles.bottomText}>
         
          <Text
            style={styles.link}
            onPress={() => router.push("/(auth)/register")}
          >
            CREATE ACCOUNT
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // MAIN SCREEN
  container: {
    flex: 1,
    backgroundColor: "#3A85C4", // Morado principal
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },

  // LOGO
  logoContainer: {
    marginBottom: 40,
    alignItems: "center",
  },
  logo: {
    width: 160,
    height: 80,
  },

  // CARD
  card: {
    width: "100%",
    backgroundColor: "#FFFFFF",
    borderRadius: 25,
    paddingVertical: 30,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderColor: "#7FD0FF",
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 25,
    color: "#212121",
  },

  // INPUTS
  input: {
    borderWidth: 1.8,
    borderColor: "#3A85C4",
    borderRadius: 15,
    paddingVertical: 14,
    paddingHorizontal: 15,
    fontSize: 15,
    marginBottom: 15,
    backgroundColor: "#FFFFFF",
    color: "#000",
  },

  // FORGOT PASSWORD
 forgotButton: {
  width: "100%",
  alignItems: "center",
  marginBottom: 20,
},

  forgotText: {
    color: "#3A85C4",
    fontWeight: "600",
    fontSize: 13,
  },

  // MAIN BUTTON
  button: {
    backgroundColor: "#3A85C4",
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  // LOADING STATE
  loadingButton: {
    paddingVertical: 15,
    borderRadius: 15,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
  },
  loadingText: {
    color: "#fff",
    fontSize: 16,
    marginLeft: 10,
  },

  // REGISTER LINK
  bottomTextContainer: {
    marginTop: 25,
  },
  bottomText: {
    color: "#FFFFFF",
    fontSize: 15,
    textAlign: "center",
  },
  link: {
    fontWeight: "700",
    textDecorationLine: "underline",
  },
});
