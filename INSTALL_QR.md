# Instalación de Librerías para QR

Para implementar la funcionalidad de códigos QR y escáner, necesitas instalar las siguientes librerías:

## 1. Instalar librerías

Ejecuta estos comandos en la terminal:

```bash
# Para generar códigos QR
npx expo install react-native-svg
npx expo install react-native-qrcode-svg

# Para escanear códigos QR
npx expo install expo-camera
```

## 2. Configurar permisos

En tu archivo `app.json`, asegúrate de tener los permisos de cámara:

```json
{
  "expo": {
    "plugins": [
      [
        "expo-camera",
        {
          "cameraPermission": "Permitir que $(PRODUCT_NAME) acceda a tu cámara para escanear códigos QR de mascotas."
        }
      ]
    ]
  }
}
```

## 3. Reconstruir la app

Después de instalar las librerías, necesitas reconstruir la app:

```bash
# Para desarrollo
npx expo start --clear

# Si usas desarrollo local
npx expo run:ios
# o
npx expo run:android
```

## Nota importante

Si estás usando Expo Go, estas librerías deberían funcionar sin problemas. Si estás usando una build personalizada, asegúrate de ejecutar `eas build` después de instalar las dependencias.
