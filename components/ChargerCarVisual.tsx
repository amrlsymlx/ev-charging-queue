import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, {
    Easing,
    useAnimatedProps,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";
import Svg, {
    Circle,
    Ellipse,
    G,
    Path,
    Rect,
    Text as SvgText,
} from "react-native-svg";

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Quadratic bezier point for the cable path between the charger nub and the
// car's charging port, used to place the moving "current" dots along it.
function bezierPoint(
  t: number,
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
) {
  "worklet";
  const oneMinusT = 1 - t;
  const x = oneMinusT * oneMinusT * p0.x + 2 * oneMinusT * t * p1.x + t * t * p2.x;
  const y = oneMinusT * oneMinusT * p0.y + 2 * oneMinusT * t * p1.y + t * t * p2.y;
  return { x, y };
}

const CABLE_START = { x: 62, y: 118 };
const CABLE_CONTROL = { x: 80, y: 130 };
const CABLE_END = { x: 96, y: 99 };

// The car is authored in a 1280x853 source coordinate space (the BYD-style
// rear-view illustration) and mapped into our small board viewBox via this
// translate+scale, keeping the whole sedan silhouette proportionally intact.
const CAR_SCALE = 0.1535;
const CAR_TX = 61.76;
const CAR_TY = 20.66;
const CAR_TRANSFORM = `translate(${CAR_TX}, ${CAR_TY}) scale(${CAR_SCALE})`;

function CurrentDot({ phase, active }: { phase: number; active: boolean }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    if (active) {
      progress.value = withRepeat(
        withTiming(1, { duration: 1200, easing: Easing.linear }),
        -1,
        false,
      );
    } else {
      progress.value = 0;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const animatedProps = useAnimatedProps(() => {
    const t = (progress.value + phase) % 1;
    const point = bezierPoint(t, CABLE_START, CABLE_CONTROL, CABLE_END);
    return { cx: point.x, cy: point.y, opacity: active ? 1 : 0 };
  });

  return <AnimatedCircle animatedProps={animatedProps} r={3} fill="#FFD166" />;
}

export default function ChargerCarVisual({
  active,
  colorAccent = "#3CE685",
}: {
  active: boolean;
  colorAccent?: string;
}) {
  const ledOpacity = useSharedValue(0.35);

  useEffect(() => {
    if (active) {
      ledOpacity.value = withRepeat(
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      );
    } else {
      ledOpacity.value = 0.35;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const ledAnimatedProps = useAnimatedProps(() => ({
    opacity: ledOpacity.value,
  }));

  return (
    <View style={styles.wrap}>
      <Svg width="100%" height={160} viewBox="0 0 240 170">
        {/* Backdrop blob + cloud, like a friendly illustration */}
        <Path
          d="M50,16 C18,18 4,52 8,88 C12,126 44,150 100,150 C168,150 218,120 224,78 C228,38 186,8 132,8 C102,8 74,7 50,16 Z"
          fill="#39A0ED"
          opacity={0.16}
        />
        <Circle cx={152} cy={34} r={13} fill="#F4F8FF" opacity={0.18} />
        <Circle cx={167} cy={40} r={9} fill="#F4F8FF" opacity={0.18} />
        <Circle cx={138} cy={40} r={9} fill="#F4F8FF" opacity={0.18} />
        <Rect x={134} y={38} width={38} height={10} rx={5} fill="#F4F8FF" opacity={0.18} />

        {/* Charger pedestal */}
        <Rect x={30} y={148} width={26} height={7} rx={3.5} fill="#0B1424" opacity={0.35} />
        <Rect
          x={38}
          y={68}
          width={20}
          height={82}
          rx={8}
          fill="#DCE4F0"
        />
        <Rect x={42} y={78} width={12} height={11} rx={2} fill="#12213B" />
        <AnimatedCircle
          cx={48}
          cy={73}
          r={2.6}
          fill={active ? "#3CE685" : "#8FA0C4"}
          animatedProps={ledAnimatedProps}
        />
        <Rect x={42} y={93} width={12} height={6} rx={2} fill="#3CE685" opacity={0.85} />
        <Rect x={42} y={102} width={12} height={3} rx={1.5} fill="#AEBBD4" />
        <Circle cx={CABLE_START.x} cy={CABLE_START.y} r={3} fill="#8FA0C4" />

        {/* Cable from charger to car */}
        {active ? (
          <Path
            d={`M${CABLE_START.x},${CABLE_START.y} Q${CABLE_CONTROL.x},${CABLE_CONTROL.y} ${CABLE_END.x},${CABLE_END.y}`}
            stroke="#8FA3C9"
            strokeWidth={3.5}
            fill="none"
            strokeLinecap="round"
          />
        ) : null}
        {active ? (
          <>
            <CurrentDot phase={0} active={active} />
            <CurrentDot phase={0.33} active={active} />
            <CurrentDot phase={0.66} active={active} />
          </>
        ) : null}

        {/* Car - BYD-style rear three-quarter-flat sedan silhouette */}
        {active ? (
          <G transform={CAR_TRANSFORM}>
            <Ellipse cx={640} cy={700} rx={456} ry={14} fill="#000000" opacity={0.25} />

            {/* Tyres */}
            <Path
              d="M 228 588 L 308 588 L 308 668 C 308 682 298 692 284 692 L 252 692 C 238 692 228 682 228 668 Z"
              fill="#0B1424"
            />
            <Path
              d="M 1052 588 L 972 588 L 972 668 C 972 682 982 692 996 692 L 1028 692 C 1042 692 1052 682 1052 668 Z"
              fill="#0B1424"
            />

            {/* Body */}
            <Path
              d="M 640 126
                 C 745 126 830 129 886 137
                 C 946 146 982 195 1006 258
                 C 1029 320 1044 402 1050 484
                 C 1055 552 1056 612 1054 658
                 L 226 658
                 C 224 612 225 552 230 484
                 C 236 402 251 320 274 258
                 C 298 195 334 146 394 137
                 C 450 129 535 126 640 126 Z"
              fill={colorAccent}
            />
            <Path
              d="M 274 258 C 251 320 236 402 230 484 C 225 552 224 612 226 658 L 262 658 C 258 610 259 550 264 486 C 270 406 284 326 305 266 Z"
              fill="#000000"
              opacity={0.18}
            />
            <Path
              d="M 1006 258 C 1029 320 1044 402 1050 484 C 1055 552 1056 612 1054 658 L 1018 658 C 1022 610 1021 550 1016 486 C 1010 406 996 326 975 266 Z"
              fill="#000000"
              opacity={0.18}
            />

            {/* Roof / spoiler lip */}
            <Path
              d="M 452 132 C 560 128 720 128 830 132 L 832 144 C 722 140 560 140 450 144 Z"
              fill="#12213B"
            />

            {/* Rear glass */}
            <Path
              d="M 348 210
                 C 356 180 372 164 398 160
                 C 500 152 780 152 882 160
                 C 908 164 924 180 932 210
                 C 940 252 942 292 940 316
                 C 940 324 934 328 926 328
                 L 354 328
                 C 346 328 340 324 340 316
                 C 338 292 340 252 348 210 Z"
              fill="#12213B"
            />
            <Path
              d="M 400 258
                 L 410 212 C 411 206 415 203 421 203
                 L 506 203 C 512 203 516 207 516 213
                 L 516 236
                 L 558 236 C 564 236 568 232 568 226
                 L 568 210 C 568 204 572 200 578 200
                 L 702 200 C 708 200 712 204 712 210
                 L 712 226 C 712 232 716 236 722 236
                 L 764 236
                 L 764 213 C 764 207 768 203 774 203
                 L 859 203 C 865 203 869 206 870 212
                 L 880 258 Z"
              fill="#59647A"
              opacity={0.85}
            />

            {/* Mirrors */}
            <Path
              d="M 236 252 C 246 240 268 238 288 246 C 300 251 302 262 296 272 C 288 285 268 292 250 288 C 236 285 230 268 236 252 Z"
              fill="#12213B"
            />
            <Path
              d="M 1044 252 C 1034 240 1012 238 992 246 C 980 251 978 262 984 272 C 992 285 1012 292 1030 288 C 1044 285 1050 268 1044 252 Z"
              fill="#12213B"
            />

            {/* Shoulder highlight */}
            <Path
              d="M 296 338 C 420 314 860 314 984 338"
              fill="none"
              stroke="#F4F8FF"
              strokeWidth={5}
              strokeLinecap="round"
              opacity={0.4}
            />

            {/* Tail light bar housing */}
            <Path
              d="M 248 352
                 C 250 344 258 340 268 340
                 L 1012 340
                 C 1022 340 1030 344 1032 352
                 C 1038 368 1038 381 1033 389
                 C 1031 392 1027 394 1020 394
                 L 260 394
                 C 253 394 249 392 247 389
                 C 242 381 242 368 248 352 Z"
              fill="#12213B"
            />
            <Path
              d="M 254 356
                 C 256 348 263 344 272 344
                 L 404 344
                 C 434 344 456 352 468 366
                 L 468 372
                 C 456 384 434 390 404 390
                 L 264 390
                 C 258 390 254 388 252 384
                 C 248 376 249 366 254 356 Z"
              fill="#FF5B5B"
            />
            <Path
              d="M 1026 356
                 C 1024 348 1017 344 1008 344
                 L 876 344
                 C 846 344 824 352 812 366
                 L 812 372
                 C 824 384 846 390 876 390
                 L 1016 390
                 C 1022 390 1026 388 1028 384
                 C 1032 376 1031 366 1026 356 Z"
              fill="#FF5B5B"
            />
            <Path
              d="M 452 353 L 828 353 C 834 353 838 357 838 363 L 838 371 C 838 377 834 381 828 381 L 452 381 C 446 381 442 377 442 371 L 442 363 C 442 357 446 353 452 353 Z"
              fill="#FF5B5B"
            />
            <Path
              d="M 456 359 L 824 359 C 828 359 830 361 830 365 L 830 369 C 830 373 828 375 824 375 L 456 375 C 452 375 450 373 450 369 L 450 365 C 450 361 452 359 456 359 Z"
              fill="#12213B"
            />
            <Path
              d="M 288 358 L 400 358 C 420 358 434 364 442 372 C 445 376 442 381 436 381 L 294 381 C 287 381 283 377 284 371 L 286 361 C 286 359 287 358 288 358 Z"
              fill="#12213B"
            />
            <Path
              d="M 992 358 L 880 358 C 860 358 846 364 838 372 C 835 376 838 381 844 381 L 986 381 C 993 381 997 377 996 371 L 994 361 C 994 359 993 358 992 358 Z"
              fill="#12213B"
            />

            <SvgText
              x={647}
              y={402}
              fontSize={42}
              fontWeight="600"
              fill="#CFD9E2"
              textAnchor="middle"
            >
              BYD
            </SvgText>

            {/* Boot lid seam */}
            <Path
              d="M 351 398
                 C 350 440 353 470 361 494
                 C 365 507 375 513 391 513
                 L 889 513
                 C 905 513 915 507 919 494
                 C 927 470 930 440 929 398"
              fill="none"
              stroke="#000000"
              strokeWidth={2.5}
              strokeLinecap="round"
              opacity={0.25}
            />

            {/* Lower bumper / diffuser */}
            <Path
              d="M 432 512
                 L 848 512
                 C 862 512 874 517 882 526
                 L 1030 590
                 L 1054 590
                 L 1054 658
                 L 226 658
                 L 226 590
                 L 250 590
                 L 398 526
                 C 406 517 418 512 432 512 Z"
              fill="#12213B"
            />

            {/* Corner vents */}
            <Path
              d="M 262 480 C 274 480 284 490 284 502 L 284 524 C 284 532 278 538 270 538 C 262 538 256 532 256 524 L 256 498 C 256 488 256 480 262 480 Z"
              fill="#1B2A46"
            />
            <Path
              d="M 1018 480 C 1006 480 996 490 996 502 L 996 524 C 996 532 1002 538 1010 538 C 1018 538 1024 532 1024 524 L 1024 498 C 1024 488 1024 480 1018 480 Z"
              fill="#1B2A46"
            />

            {/* Parking sensors */}
            <Circle cx={300} cy={546} r={4} fill="#1B2A46" />
            <Circle cx={980} cy={546} r={4} fill="#1B2A46" />

            {/* Rear reflector strips */}
            <Path
              d="M 252 568 L 366 568 L 352 590 L 252 590 C 245 590 242 585 242 579 C 242 573 245 568 252 568 Z"
              fill="#C22A22"
            />
            <Path
              d="M 1028 568 L 914 568 L 928 590 L 1028 590 C 1035 590 1038 585 1038 579 C 1038 573 1035 568 1028 568 Z"
              fill="#C22A22"
            />

            {/* Charging port */}
            <Rect x={210} y={490} width={26} height={36} rx={8} fill="#FFD166" />
          </G>
        ) : null}
      </Svg>
      {!active ? <Text style={styles.idleLabel}>No vehicle connected</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  idleLabel: {
    position: "absolute",
    bottom: 6,
    color: "#8FA0C4",
    fontSize: 12,
    fontStyle: "italic",
  },
});
