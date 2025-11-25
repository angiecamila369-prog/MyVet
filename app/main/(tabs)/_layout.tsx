import { AntDesign, FontAwesome, Ionicons, MaterialIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#ffffffff",
        tabBarInactiveTintColor: "#fbfcffff",
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          bottom: 20,
          left: '10%',
          right: '10%',
          elevation: 8,
          backgroundColor: '#3A85C4',
          borderRadius: 30,
          height: 70,
          paddingBottom: 10,
          paddingTop: 10,
          borderTopWidth: 0,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: 10,
          },
          shadowOpacity: 0.3,
          shadowRadius: 20,
        },
        tabBarShowLabel: false,
      }}
    >
      {/* Pantalla principal */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={24} name="home" color={color} />
          ),
        }}
      />

         {/* GPS Tracker */}
      <Tabs.Screen
        name="gps"
        options={{
          title: "GPS Tracker",
          tabBarIcon: ({ color }) => (
            <MaterialIcons name="location-on" size={24} color={color} />
          ),
        }}
      />

      {/* Logbook */}
      <Tabs.Screen
        name="logbook"
        options={{
          title: "logbook",
          tabBarIcon: ({ color }) => (
            <Ionicons name="book" size={24} color={color} />
          ),
        }}
      />
  {/* chats */}
        <Tabs.Screen
                name="chats"
                options={{
                    title: 'chats',
                    tabBarIcon: ({ color, size }) => (
                        <AntDesign name="wechat" size={24} color={color} />
                    ),
                    tabBarStyle: { display: 'none' },
                }}
            />
      {/* Perfil */}
      <Tabs.Screen
        name="perfil"
        options={{
          title: "Perfil",
          tabBarIcon: ({ color }) => (
            <FontAwesome size={24} name="user-circle" color={color} />
          ),
        }}
      />
    

    </Tabs>
  );
}
