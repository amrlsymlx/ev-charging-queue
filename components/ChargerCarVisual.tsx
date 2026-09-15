import { Image } from "expo-image";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withDelay,
    withRepeat,
    withSequence,
    withTiming,
} from "react-native-reanimated";
import Svg, { Line, Path } from "react-native-svg";

import { SessionPhase } from "@/lib/eta";
import { ChargingBayOrientation } from "@/types/domain";

type IllustrationState =
  | "idle"
  | "starting-charge"
  | "charging"
  | "finished-charging"
  | "disabled";

// Filenames encode which side the charger unit sits on: "charger-left"
// pairs with a bay whose orientation is "left" (charger to the left of the
// vehicle), "charger-right" with "right".
const GIFS: Record<ChargingBayOrientation, Record<IllustrationState, any>> = {
  left: {
    idle: require("@/assets/images/charger/charger-left_bay-right_1-idle.gif"),
    "starting-charge": require("@/assets/images/charger/charger-left_bay-right_2-starting-charge.gif"),
    charging: require("@/assets/images/charger/charger-left_bay-right_3-charging.gif"),
    "finished-charging": require("@/assets/images/charger/charger-left_bay-right_4-finished-charging.gif"),
    disabled: require("@/assets/images/charger/charger-left_bay-right_5-disabled.gif"),
  },
  right: {
    idle: require("@/assets/images/charger/charger-right_bay-left_1-idle.gif"),
    "starting-charge": require("@/assets/images/charger/charger-right_bay-left_2-starting-charge.gif"),
    charging: require("@/assets/images/charger/charger-right_bay-left_3-charging.gif"),
    "finished-charging": require("@/assets/images/charger/charger-right_bay-left_4-finished-charging.gif"),
    disabled: require("@/assets/images/charger/charger-right_bay-left_5-disabled.gif"),
  },
};

const AnimatedLine = Animated.createAnimatedComponent(Line);
const AnimatedPath = Animated.createAnimatedComponent(Path);

const RAINDROPS = [
  { x: 24, y: -10, delay: 0 },
  { x: 58, y: -30, delay: 220 },
  { x: 92, y: -6, delay: 480 },
  { x: 126, y: -22, delay: 120 },
  { x: 160, y: -8, delay: 360 },
  { x: 194, y: -26, delay: 600 },
  { x: 210, y: -4, delay: 260 },
];

function Raindrop({ x, y, delay }: { x: number; y: number; delay: number }) {
  const fall = useSharedValue(0);

  useEffect(() => {
    fall.value = withDelay(
      delay,
      withRepeat(withTiming(1, { duration: 900, easing: Easing.linear }), -1, false),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedProps = useAnimatedProps(() => {
    const ty = fall.value * 190;
    const opacity = fall.value > 0.85 ? (1 - fall.value) / 0.15 : 1;
    return {
      x1: x,
      x2: x - 4,
      y1: y + ty,
      y2: y + ty + 12,
      opacity,
    };
  });

  return (
    <AnimatedLine
      animatedProps={animatedProps}
      stroke="#9FD3FF"
      strokeWidth={2}
      strokeLinecap="round"
    />
  );
}

function LightningBolt() {
  const flash = useSharedValue(0);

  useEffect(() => {
    flash.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 90 }),
        withTiming(0.15, { duration: 90 }),
        withTiming(1, { duration: 70 }),
        withTiming(0, { duration: 500 }),
        withTiming(0, { duration: 1800 }),
      ),
      -1,
      false,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const animatedProps = useAnimatedProps(() => ({
    opacity: flash.value,
  }));

  return (
    <AnimatedPath
      animatedProps={animatedProps}
      d="M148,4 L128,44 L142,44 L124,84 L158,38 L144,38 Z"
      fill="#FFE066"
    />
  );
}

// Overlaid on top of the GIF illustration, sharing its old 240x170
// coordinate space, to show heavy rain + intermittent lightning regardless
// of the bay's charging state underneath.
function RainOverlay() {
  return (
    <Svg
      style={StyleSheet.absoluteFill}
      viewBox="0 0 240 170"
      preserveAspectRatio="none"
    >
      <LightningBolt />
      {RAINDROPS.map((drop, i) => (
        <Raindrop key={i} x={drop.x} y={drop.y} delay={drop.delay} />
      ))}
    </Svg>
  );
}

export default function ChargerCarVisual({
  active,
  disabled = false,
  phase = null,
  orientation = "left",
  raining = false,
}: {
  active: boolean;
  disabled?: boolean;
  /** Session phase while a vehicle is connected; ignored when `active` is false. */
  phase?: SessionPhase | null;
  orientation?: ChargingBayOrientation;
  /** Overlays falling rain + intermittent lightning to indicate heavy rain mode. */
  raining?: boolean;
}) {
  // A bay that's mid-session when it gets disabled should keep showing the
  // session, the same way the old hazard-tape graphic only appeared while idle.
  const showDisabledGraphic = disabled && !active;

  const state: IllustrationState = showDisabledGraphic
    ? "disabled"
    : !active
      ? "idle"
      : phase === "grace"
        ? "starting-charge"
        : phase === "charging"
          ? "charging"
          : "finished-charging";

  return (
    <View style={styles.wrap}>
      <Image
        source={GIFS[orientation][state]}
        style={styles.gif}
        contentFit="contain"
        autoplay
      />
      {raining ? <RainOverlay /> : null}
      {raining ? (
        <Text style={styles.rainLabel}>⛈ Heavy rain</Text>
      ) : showDisabledGraphic ? (
        <Text style={styles.disabledLabel}>Bay disabled</Text>
      ) : !active ? (
        <Text style={styles.idleLabel}>No vehicle connected</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  gif: {
    width: "100%",
    height: 160,
  },
  idleLabel: {
    position: "absolute",
    bottom: 6,
    color: "#8FA0C4",
    fontSize: 12,
    fontStyle: "italic",
  },
  rainLabel: {
    position: "absolute",
    bottom: 6,
    color: "#9FD3FF",
    fontSize: 12,
    fontWeight: "700",
  },
  disabledLabel: {
    position: "absolute",
    bottom: 6,
    color: "#FF9B8A",
    fontSize: 12,
    fontWeight: "700",
  },
});
