import { router } from "expo-router";
import React, { useState } from "react";
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { supabase } from "../../lib/supabase";
import LoadingAnimation from "@/components/LoadingAnimation";

const { width, height } = Dimensions.get("window");

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [city, setCity] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    try {
      setLoading(true);

      // 1️⃣ Crear usuario en Auth
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) throw error;
      const user = data.user;
      if (!user) throw new Error("No se pudo crear el usuario.");

      // 2️⃣ Guardar o actualizar perfil en "profiles"
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert([
          {
            id: user.id,
            email: email,
            name: name,
            phone: phoneNumber,
            city: city,
          },
        ]);

      if (profileError) {
        console.error("Error guardando perfil:", profileError.message);
        throw profileError;
      }

      // 3️⃣ Cerrar sesión inmediatamente
      await supabase.auth.signOut();

      // 4️⃣ Redirigir al login
      alert("✅ Usuario creado con éxito, inicia sesión.");
      router.replace("/(auth)/login");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Logo Section */}
        <View style={styles.logoContainer}>
          <Image
            source={require("../../assets/images/logo.jpg")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        {/* Form Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Create Account</Text>

          {/* Name Input */}
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#B0B0B0"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
          />

          {/* Email Input */}
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#B0B0B0"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          {/* Phone Number Input */}
          <TextInput
            style={styles.input}
            placeholder="Phone number"
            placeholderTextColor="#B0B0B0"
            value={phoneNumber}
            onChangeText={setPhoneNumber}
            keyboardType="phone-pad"
          />

          {/* City Input */}
          <TextInput
            style={styles.input}
            placeholder="City"
            placeholderTextColor="#B0B0B0"
            value={city}
            onChangeText={setCity}
            autoCapitalize="words"
          />

          {/* Password Input */}
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#B0B0B0"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          {/* Register Button */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <LoadingAnimation size={80} />
              <Text style={styles.loadingText}>Creating account...</Text>
            </View>
          ) : (
            <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
              <Text style={styles.buttonText}>Register</Text>
            </TouchableOpacity>
          )}

          {/* Forgot Password Link */}
          <TouchableOpacity
            style={styles.forgotContainer}
            onPress={() => router.push("/(auth)/reset")}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Login Link */}
        <View style={styles.loginContainer}>
          <Text style={styles.loginText}>
            Already have an account?{" "}
            <Text
              style={styles.loginLink}
              onPress={() => router.push("/(auth)/login")}
            >
              Log in
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#3A85C4",
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 30,
    paddingVertical: 40,
    minHeight: height,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logo: {
    width: 200,
    height: 100,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 30,
    paddingVertical: 40,
    paddingHorizontal: 30,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    textAlign: 'center',
    marginBottom: 30,
    color: "#212121",
  },
  input: {
    borderWidth: 2,
    borderColor: "#3A85C4",
    borderRadius: 15,
    paddingVertical: 15,
    paddingHorizontal: 20,
    fontSize: 16,
    marginBottom: 20,
    backgroundColor: "#FFFFFF",
    color: "#000",
  },
  registerButton: {
    backgroundColor: "#3A85C4",
    borderRadius: 20,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 20,
    shadowColor: "#3A85C4",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 18,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    marginTop: 10,
    marginBottom: 20,
  },
  loadingText: {
    marginTop: 10,
    color: "#3A85C4",
    fontSize: 16,
    fontWeight: "600",
  },
  forgotContainer: {
    alignItems: 'center',
  },
  forgotText: {
    color: "#212121",
    fontSize: 15,
    fontWeight: "500",
  },
  loginContainer: {
    alignItems: 'center',
  },
  loginText: {
    color: "#FFFFFF",
    fontSize: 16,
    textAlign: 'center',
  },
  loginLink: {
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
