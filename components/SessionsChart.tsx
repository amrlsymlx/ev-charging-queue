import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Polyline, Text as SvgText } from "react-native-svg";

type Props = {
  bays: { id: string; name: string }[];
  sessions: { bayId: string; createdAt: string }[];
};

const CHART_COLORS = [
  "#7CFFBA",
  "#F2C94C",
  "#849EFF",
  "#FF6B6B",
  "#39A0ED",
  "#F26419",
];

const TOTAL_SERIES_ID = "__total__";
const TOTAL_COLOR = "#F8FBFF";

const PADDING_LEFT = 36;
const PADDING_RIGHT = 16;
const PADDING_TOP = 16;
const PADDING_BOTTOM = 30;
const POINT_SPACING = 64;
const CHART_HEIGHT = 220;
const TICK_COUNT = 4;

// Local (not UTC) YYYY-MM-DD so a session logged late at night groups under
// the day the manager actually saw it happen.
function toDateKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export default function SessionsChart({ bays, sessions }: Props) {
  const { dates, series, maxCount } = useMemo(() => {
    const countsByBayDate = new Map<string, Map<string, number>>();
    const dateSet = new Set<string>();

    for (const session of sessions) {
      const dateKey = toDateKey(session.createdAt);
      dateSet.add(dateKey);
      if (!countsByBayDate.has(session.bayId)) {
        countsByBayDate.set(session.bayId, new Map());
      }
      const bayMap = countsByBayDate.get(session.bayId)!;
      bayMap.set(dateKey, (bayMap.get(dateKey) ?? 0) + 1);
    }

    const sortedDates = Array.from(dateSet).sort();

    const bayseries = bays.map((bay, idx) => ({
      bayId: bay.id,
      name: bay.name,
      color: CHART_COLORS[idx % CHART_COLORS.length],
      dashed: false,
      counts: sortedDates.map(
        (dateKey) => countsByBayDate.get(bay.id)?.get(dateKey) ?? 0,
      ),
    }));

    const totalSeries = {
      bayId: TOTAL_SERIES_ID,
      name: "Total (all bays)",
      color: TOTAL_COLOR,
      dashed: true,
      counts: sortedDates.map((_, idx) =>
        bayseries.reduce((sum, s) => sum + s.counts[idx], 0),
      ),
    };

    const series = [...bayseries, totalSeries];

    const maxCount = Math.max(1, ...series.flatMap((s) => s.counts));

    return { dates: sortedDates, series, maxCount };
  }, [bays, sessions]);

  if (dates.length === 0) {
    return <Text style={styles.emptyText}>No session data yet.</Text>;
  }

  const innerHeight = CHART_HEIGHT - PADDING_TOP - PADDING_BOTTOM;
  const chartWidth =
    PADDING_LEFT + PADDING_RIGHT + Math.max(1, dates.length - 1) * POINT_SPACING;

  const xFor = (idx: number) =>
    dates.length > 1
      ? PADDING_LEFT + idx * POINT_SPACING
      : PADDING_LEFT + (chartWidth - PADDING_LEFT - PADDING_RIGHT) / 2;

  const yFor = (count: number) =>
    PADDING_TOP + innerHeight - (count / maxCount) * innerHeight;

  // Dedupe: when maxCount is small (e.g. 1), evenly-spaced steps round to the
  // same integer more than once, which would draw overlapping gridlines.
  const ticks = Array.from(
    new Set(
      Array.from({ length: TICK_COUNT + 1 }, (_, i) =>
        Math.round((maxCount * i) / TICK_COUNT),
      ),
    ),
  );

  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <Svg width={chartWidth} height={CHART_HEIGHT}>
          {ticks.map((tick, idx) => (
            <Line
              key={`gridline-${idx}`}
              x1={PADDING_LEFT}
              x2={chartWidth - PADDING_RIGHT}
              y1={yFor(tick)}
              y2={yFor(tick)}
              stroke="rgba(255,255,255,0.1)"
              strokeWidth={1}
            />
          ))}
          {ticks.map((tick, idx) => (
            <SvgText
              key={`label-${idx}`}
              x={PADDING_LEFT - 8}
              y={yFor(tick) + 4}
              fontSize={10}
              fill="#9FB0CD"
              textAnchor="end"
            >
              {tick}
            </SvgText>
          ))}

          {dates.map((dateKey, idx) => (
            <SvgText
              key={dateKey}
              x={xFor(idx)}
              y={CHART_HEIGHT - PADDING_BOTTOM + 18}
              fontSize={10}
              fill="#9FB0CD"
              textAnchor="middle"
            >
              {formatDateLabel(dateKey)}
            </SvgText>
          ))}

          {series.map((s) => (
            <Polyline
              key={s.bayId}
              points={s.counts.map((c, idx) => `${xFor(idx)},${yFor(c)}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={s.dashed ? 3 : 2}
              strokeDasharray={s.dashed ? "6,4" : undefined}
            />
          ))}
          {series.map((s) =>
            s.counts.map((c, idx) => (
              <Circle
                key={`${s.bayId}-${idx}`}
                cx={xFor(idx)}
                cy={yFor(c)}
                r={3}
                fill={s.color}
              />
            )),
          )}
        </Svg>
      </ScrollView>

      <View style={styles.legendRow}>
        {series.map((s) => (
          <View key={s.bayId} style={styles.legendItem}>
            <View style={[styles.legendSwatch, { backgroundColor: s.color }]} />
            <Text style={styles.legendText}>{s.name}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  emptyText: { color: "#9FB0CD", paddingVertical: 12, textAlign: "center" },
  legendRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 14,
    marginTop: 10,
  },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendSwatch: { width: 10, height: 10, borderRadius: 5 },
  legendText: { color: "#D1DCF3", fontSize: 12, fontWeight: "600" },
});
