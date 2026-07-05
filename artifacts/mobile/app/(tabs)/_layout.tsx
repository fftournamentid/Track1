import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { Feather } from "@expo/vector-icons";
import React, { useRef, useEffect } from "react";
import { Platform, StyleSheet, View, useColorScheme, Animated } from "react-native";
import { useColors } from "@/hooks/useColors";

// ─── Glow tab icon — renders the icon with an animated background glow ────────

function GlowTabIcon({
  featherName,
  color,
  focused,
}: {
  featherName: keyof typeof Feather.glyphMap;
  color: string;
  focused: boolean;
}) {
  const glowOpacity = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const glowScale = useRef(new Animated.Value(focused ? 1 : 0.6)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(glowOpacity, {
        toValue: focused ? 1 : 0,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
      Animated.spring(glowScale, {
        toValue: focused ? 1 : 0.6,
        useNativeDriver: true,
        tension: 300,
        friction: 10,
      }),
    ]).start();
  }, [focused, glowOpacity, glowScale]);

  return (
    <View style={iconStyles.wrap}>
      {/* Animated glow pill */}
      <Animated.View
        style={[
          iconStyles.glow,
          {
            backgroundColor: color + "20",
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      {/* Active indicator dot above icon */}
      {focused && (
        <Animated.View
          style={[
            iconStyles.dot,
            { backgroundColor: color, opacity: glowOpacity },
          ]}
        />
      )}
      <Feather name={featherName} size={22} color={color} />
    </View>
  );
}

const iconStyles = StyleSheet.create({
  wrap: {
    width: 44,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  glow: {
    position: "absolute",
    width: 44,
    height: 34,
    borderRadius: 12,
  },
  dot: {
    position: "absolute",
    top: -1,
    width: 18,
    height: 3,
    borderRadius: 2,
  },
});

// ─── Native tab layout (iOS Liquid Glass) ─────────────────────────────────────

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="invoices">
        <Icon sf={{ default: "doc.text", selected: "doc.text.fill" }} />
        <Label>Invoices</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="tools">
        <Icon sf={{ default: "wrench.and.screwdriver", selected: "wrench.and.screwdriver.fill" }} />
        <Label>Tools</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon sf={{ default: "person.circle", selected: "person.circle.fill" }} />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

// ─── Classic tab layout (Android / Web / older iOS) ──────────────────────────

function ClassicTabLayout() {
  const colors = useColors();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  const tabBarBg = isIOS ? "transparent" : "#FFFFFF";
  const activeColor = "#2563EB";
  const inactiveColor = "#94A3B8";

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: activeColor,
        tabBarInactiveTintColor: inactiveColor,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: tabBarBg,
          borderTopWidth: 0,
          elevation: 0,
          height: isWeb ? 72 : 60,
          paddingTop: 4,
          // Premium shadow
          shadowColor: "#0F172A",
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 16,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView
              intensity={90}
              tint={isDark ? "dark" : "extraLight"}
              style={[StyleSheet.absoluteFill, tabStyles.iosTabBg]}
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, tabStyles.androidTabBg]} />
          ),
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "700",
          letterSpacing: 0.2,
          marginTop: -2,
        },
        tabBarItemStyle: {
          paddingVertical: 4,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, focused }) => (
            <GlowTabIcon featherName="home" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="invoices"
        options={{
          title: "Invoices",
          tabBarIcon: ({ color, focused }) => (
            <GlowTabIcon featherName="file-text" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="tools"
        options={{
          title: "Tools",
          tabBarIcon: ({ color, focused }) => (
            <GlowTabIcon featherName="tool" color={color} focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="premium"
        options={{
          title: "Premium",
          tabBarIcon: ({ color, focused }) => (
            <GlowTabIcon featherName="star" color={color} focused={focused} />
          ),
          href: null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          tabBarIcon: ({ color, focused }) => (
            <GlowTabIcon featherName="user" color={color} focused={focused} />
          ),
        }}
      />
    </Tabs>
  );
}

const tabStyles = StyleSheet.create({
  iosTabBg: {
    borderTopWidth: 0.5,
    borderTopColor: "rgba(0,0,0,0.1)",
    borderRadius: 0,
  },
  androidTabBg: {
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },
});

// ─── Root export ──────────────────────────────────────────────────────────────

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
