import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { OwnerLotsPopupLot } from "./OwnerLotsPopup";
import { getActualHistoryForLot, getParkingLot } from "../../services/parkingLots.service";
import type { BookingHistorySnapshot } from "../../services/users.service";
import "./OwnerLotAnalytics.css";

type RangeUnit = "day" | "week" | "month" | "year";

type SeriesPoint = {
  label: string;
  value: number;
};

type ChartPalette = {
  primary: string;
  secondary: string;
  grid: string;
  label: string;
  surface: string;
};

const rangeUnitOptions: Array<{ value: RangeUnit; label: string }> = [
  { value: "day", label: "יום" },
  { value: "week", label: "שבוע" },
  { value: "month", label: "חודש" },
  { value: "year", label: "שנה" },
];

const rangeUnitLabels: Record<RangeUnit, { singular: string; plural: string }> = {
  day: { singular: "יום", plural: "ימים" },
  week: { singular: "שבוע", plural: "שבועות" },
  month: { singular: "חודש", plural: "חודשים" },
  year: { singular: "שנה", plural: "שנים" },
};

const rangeAmountLimits: Record<RangeUnit, { min: number; max: number }> = {
  day: { min: 1, max: 31 },
  week: { min: 1, max: 52 },
  month: { min: 1, max: 24 },
  year: { min: 1, max: 10 },
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("he-IL").format(Math.round(value));
}

function addRangeUnit(date: Date, unit: RangeUnit, amount: number) {
  const next = new Date(date);

  if (unit === "day") {
    next.setDate(next.getDate() + amount);
  } else if (unit === "week") {
    next.setDate(next.getDate() + amount * 7);
  } else if (unit === "month") {
    next.setMonth(next.getMonth() + amount);
  } else {
    next.setFullYear(next.getFullYear() + amount);
  }

  return next;
}

function startOfRangeUnit(date: Date, unit: RangeUnit) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);

  if (unit === "day") {
    return next;
  }

  if (unit === "week") {
    const dayOfWeek = next.getDay();
    const distanceFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    next.setDate(next.getDate() - distanceFromMonday);
    return next;
  }

  if (unit === "month") {
    next.setDate(1);
    return next;
  }

  next.setMonth(0, 1);
  return next;
}

function formatDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat("he-IL", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatRangeSummary(unit: RangeUnit, amount: number) {
  const labels = rangeUnitLabels[unit];
  return `${amount} ${amount === 1 ? labels.singular : labels.plural}`;
}

function clampRangeAmount(unit: RangeUnit, amount: number) {
  const { min, max } = rangeAmountLimits[unit];
  return clamp(amount, min, max);
}

function buildSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const controlX = (current.x + next.x) / 2;

    path += ` C ${controlX} ${current.y}, ${controlX} ${next.y}, ${next.x} ${next.y}`;
  }

  return path;
}

function shouldShowAxisLabel(index: number, total: number) {
  if (total >= 24) {
    return index % 6 === 0 || index === total - 1;
  }

  if (total <= 6) {
    return true;
  }

  if (index === 0 || index === total - 1) {
    return true;
  }

  const step = Math.ceil(total / 5);
  return index % step === 0;
}

function formatAxisLabel(label: string, total: number) {
  if (total >= 24 && label.includes(":")) {
    return label.slice(0, 2);
  }

  return label;
}

function buildRangeChartData(bookings: Array<BookingHistorySnapshot & { spaceId: string; date: string }>, unit: RangeUnit, amount: number) {
  const safeAmount = Math.max(1, amount);
  const now = new Date();
  const currentPeriodStart = startOfRangeUnit(now, unit);

  if (unit === "day") {
    const firstDayStart = addRangeUnit(currentPeriodStart, "day", -(safeAmount - 1));
    const totalHours = safeAmount * 24;
    const hourlyPoints = Array.from({ length: totalHours }, (_, index) => {
      const hourDate = new Date(firstDayStart);
      hourDate.setHours(hourDate.getHours() + index);

      return {
        label: `${formatDateKey(hourDate)} ${String(hourDate.getHours()).padStart(2, "0")}:00`,
        shortLabel: `${String(hourDate.getHours()).padStart(2, "0")}:00`,
        timestamp: hourDate.getTime(),
        value: 0,
      };
    });

    const rangeEnd = addRangeUnit(firstDayStart, "day", safeAmount);

    bookings.forEach((booking) => {
      const bookingDate = new Date(`${booking.date}T00:00:00`);
      if (bookingDate < firstDayStart || bookingDate >= rangeEnd) {
        return;
      }

      const startHour = Number.parseInt(booking.startTime.split(":")[0] ?? "0", 10);
      const durationHours = Math.max(1, Math.ceil(booking.durationHours || 1));

      if (!Number.isFinite(startHour) || startHour < 0 || startHour > 23) {
        return;
      }

      const bookingStart = new Date(bookingDate);
      bookingStart.setHours(startHour, 0, 0, 0);

      for (let offset = 0; offset < durationHours; offset += 1) {
        const hourDate = new Date(bookingStart);
        hourDate.setHours(hourDate.getHours() + offset);

        if (hourDate < firstDayStart || hourDate >= rangeEnd) {
          continue;
        }

        const hourIndex = Math.floor((hourDate.getTime() - firstDayStart.getTime()) / (60 * 60 * 1000));
        if (hourIndex >= 0 && hourIndex < hourlyPoints.length) {
          hourlyPoints[hourIndex].value += 1;
        }
      }
    });

    if (hourlyPoints.length <= 24) {
      return hourlyPoints.map(({ shortLabel, value }) => ({
        label: shortLabel,
        value,
      }));
    }

    const bucketSize = Math.ceil(hourlyPoints.length / 24);
    const compressed: SeriesPoint[] = [];

    for (let index = 0; index < hourlyPoints.length; index += bucketSize) {
      const bucket = hourlyPoints.slice(index, index + bucketSize);
      compressed.push({
        label: `${bucket[0].shortLabel} - ${bucket[bucket.length - 1].shortLabel}`,
        value: bucket.reduce((sum, point) => sum + point.value, 0),
      });
    }

    return compressed;
  }

  const periodStarts = Array.from({ length: safeAmount }, (_, index) => {
    const offset = index - (safeAmount - 1);
    return addRangeUnit(currentPeriodStart, unit, offset);
  });

  const counts = new Map<string, number>();
  bookings.forEach((booking) => {
    if (booking.date) {
      counts.set(booking.date, (counts.get(booking.date) ?? 0) + 1);
    }
  });

  if (unit === "week" || unit === "month") {
    const firstPeriodStart = addRangeUnit(currentPeriodStart, unit, -(safeAmount - 1));
    const rangeEnd = addRangeUnit(firstPeriodStart, unit, safeAmount);
    const dailyPoints: SeriesPoint[] = [];

    for (let cursor = new Date(firstPeriodStart); cursor < rangeEnd; cursor = addRangeUnit(cursor, "day", 1)) {
      dailyPoints.push({
        label: formatDayLabel(cursor),
        value: counts.get(formatDateKey(cursor)) ?? 0,
      });
    }

    return dailyPoints;
  }

  const rawPoints = periodStarts.map((periodStart, index) => {
    const periodEnd = index === periodStarts.length - 1 ? addRangeUnit(periodStart, unit, 1) : periodStarts[index + 1];
    let value = 0;

    counts.forEach((count, dateKey) => {
      const bookingDate = new Date(`${dateKey}T00:00:00`);
      if (bookingDate >= periodStart && bookingDate < periodEnd) {
        value += count;
      }
    });

    return {
      label: formatDateKey(periodStart),
      value,
    };
  });

  if (rawPoints.length <= 12) {
    return rawPoints;
  }

  const bucketSize = Math.ceil(rawPoints.length / 12);
  const compressed: SeriesPoint[] = [];

  for (let index = 0; index < rawPoints.length; index += bucketSize) {
    const bucket = rawPoints.slice(index, index + bucketSize);
    compressed.push({
      label: `${bucket[0].label} - ${bucket[bucket.length - 1].label}`,
      value: bucket.reduce((sum, point) => sum + point.value, 0),
    });
  }

  return compressed;
}

function parseHourlyHistory(history: Record<string, number> | undefined) {
  if (!history) {
    return [] as Array<{ date: Date; count: number }>;
  }

  return Object.entries(history)
    .map(([key, count]) => {
      const [datePart, hourPart = "00"] = key.split("_");
      return {
        date: new Date(`${datePart}T${hourPart.padStart(2, "0")}:00:00`),
        count,
      };
    })
    .filter((entry) => Number.isFinite(entry.date.getTime()) && typeof entry.count === "number" && entry.count > 0);
}

function buildHourlyHistorySeries(history: Record<string, number> | undefined, unit: RangeUnit, amount: number) {
  const entries = parseHourlyHistory(history);
  if (entries.length === 0) {
    return [] as SeriesPoint[];
  }

  const safeAmount = Math.max(1, amount);
  const now = new Date();
  const currentPeriodStart = startOfRangeUnit(now, unit);

  if (unit === "day") {
    const firstDayStart = addRangeUnit(currentPeriodStart, "day", -(safeAmount - 1));
    const totalHours = safeAmount * 24;
    const hourlyPoints = Array.from({ length: totalHours }, (_, index) => {
      const hourDate = new Date(firstDayStart);
      hourDate.setHours(hourDate.getHours() + index);
      return {
        label: `${formatDateKey(hourDate)} ${String(hourDate.getHours()).padStart(2, "0")}:00`,
        shortLabel: `${String(hourDate.getHours()).padStart(2, "0")}:00`,
        value: 0,
      };
    });

    const rangeEnd = addRangeUnit(firstDayStart, "day", safeAmount);
    entries.forEach((entry) => {
      if (entry.date < firstDayStart || entry.date >= rangeEnd) {
        return;
      }

      const hourIndex = Math.floor((entry.date.getTime() - firstDayStart.getTime()) / (60 * 60 * 1000));
      if (hourIndex >= 0 && hourIndex < hourlyPoints.length) {
        hourlyPoints[hourIndex].value += entry.count;
      }
    });

    if (hourlyPoints.length <= 24) {
      return hourlyPoints.map(({ shortLabel, value }) => ({ label: shortLabel, value }));
    }

    const bucketSize = Math.ceil(hourlyPoints.length / 24);
    const compressed: SeriesPoint[] = [];
    for (let index = 0; index < hourlyPoints.length; index += bucketSize) {
      const bucket = hourlyPoints.slice(index, index + bucketSize);
      compressed.push({
        label: `${bucket[0].shortLabel} - ${bucket[bucket.length - 1].shortLabel}`,
        value: bucket.reduce((sum, point) => sum + point.value, 0),
      });
    }

    return compressed;
  }

  if (unit === "week" || unit === "month") {
    const firstPeriodStart = addRangeUnit(currentPeriodStart, unit, -(safeAmount - 1));
    const rangeEnd = addRangeUnit(firstPeriodStart, unit, safeAmount);
    const dailyPoints: SeriesPoint[] = [];

    for (let cursor = new Date(firstPeriodStart); cursor < rangeEnd; cursor = addRangeUnit(cursor, "day", 1)) {
      const dayStart = new Date(cursor);
      const dayEnd = addRangeUnit(dayStart, "day", 1);
      const count = entries.reduce((sum, entry) => (entry.date >= dayStart && entry.date < dayEnd ? sum + entry.count : sum), 0);
      dailyPoints.push({
        label: formatDayLabel(cursor),
        value: count,
      });
    }

    return dailyPoints;
  }

  const periodStarts = Array.from({ length: safeAmount }, (_, index) => {
    const offset = index - (safeAmount - 1);
    return addRangeUnit(currentPeriodStart, unit, offset);
  });

  const rawPoints = periodStarts.map((periodStart, index) => {
    const periodEnd = index === periodStarts.length - 1 ? addRangeUnit(periodStart, unit, 1) : periodStarts[index + 1];
    const count = entries.reduce((sum, entry) => (entry.date >= periodStart && entry.date < periodEnd ? sum + entry.count : sum), 0);
    return {
      label: formatDateKey(periodStart),
      value: count,
    };
  });

  if (rawPoints.length <= 12) {
    return rawPoints;
  }

  const bucketSize = Math.ceil(rawPoints.length / 12);
  const compressed: SeriesPoint[] = [];
  for (let index = 0; index < rawPoints.length; index += bucketSize) {
    const bucket = rawPoints.slice(index, index + bucketSize);
    compressed.push({
      label: `${bucket[0].label} - ${bucket[bucket.length - 1].label}`,
      value: bucket.reduce((sum, point) => sum + point.value, 0),
    });
  }

  return compressed;
}



function MiniLineChart({
  data,
  palette,
  onWheel,
  title,
  valueSuffix,
}: {
  data: SeriesPoint[];
  palette: ChartPalette;
  onWheel?: (event: React.WheelEvent<HTMLElement>) => void;
  title: string;
  valueSuffix: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const chartId = useId().replace(/:/g, "");
  const width = 220;
  const height = 116;
  const padding = 14;
  const tooltipHalfWidth = 64;
  const maxValue = Math.max(...data.map((point) => point.value), 1);
  const totalValue = data.reduce((sum, point) => sum + point.value, 0);
  const stepX = data.length > 1 ? (width - padding * 2) / (data.length - 1) : 0;

  const points = data.map((point, index) => {
    const x = padding + stepX * index;
    const y = height - padding - ((height - padding * 2) * point.value) / maxValue;
    return { x, y };
  });

  const linePath = buildSmoothPath(points);
  const areaPath = `${linePath} L ${points[points.length - 1]?.x ?? padding} ${height - padding} L ${points[0]?.x ?? padding} ${height - padding} Z`;
  const peakPoint = data.reduce(
    (best, point, index) => {
      if (point.value > best.value) {
        return { value: point.value, index, label: point.label };
      }

      return best;
    },
    { value: -1, index: 0, label: "" }
  );
  const activeIndex = hoveredIndex;
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const chartAnimationKey = data.map((point) => `${point.label}:${point.value}`).join("|");
  const tooltipLeft = activePoint ? clamp(activePoint.x, tooltipHalfWidth, width - tooltipHalfWidth) : width / 2;
  const tooltipShouldFlip = activePoint ? activePoint.y < 42 : false;
  const lineGradientId = `owner-lot-analytics-line-gradient-${chartId}`;
  const areaGradientId = `owner-lot-analytics-area-gradient-${chartId}`;
  const lineShadowId = `owner-lot-analytics-line-shadow-${chartId}`;

  return (
    <div
      className="owner-lot-analytics__chart-card owner-lot-analytics__chart-card--enhanced"
      style={{
        ["--chart-primary" as string]: palette.primary,
        ["--chart-secondary" as string]: palette.secondary,
        ["--chart-surface" as string]: palette.surface,
      }}
      onWheel={onWheel}
      onMouseLeave={() => setHoveredIndex(null)}
    >
      <div className="owner-lot-analytics__chart-header">
        <strong>{title}</strong>
        <span>{hoveredIndex === null ? `שיא: ${formatNumber(peakPoint.value)}` : `ערך: ${formatNumber(data[hoveredIndex]?.value ?? 0)}`}</span>
      </div>
      <div className="owner-lot-analytics__chart-total">
        <span>סה״כ בטווח שנבחר</span>
        <strong>{formatNumber(totalValue)} {valueSuffix}</strong>
      </div>
      <div className="owner-lot-analytics__chart-meta">
        <span>טווח תצוגה: {formatNumber(data.length)} נקודות</span>
        <span>{hoveredIndex === null ? peakPoint.label : data[hoveredIndex]?.label}</span>
      </div>
      {activePoint ? (
        <div
          className={`owner-lot-analytics__chart-tooltip ${tooltipShouldFlip ? "owner-lot-analytics__chart-tooltip--below" : ""}`}
          style={{
            left: `${tooltipLeft}px`,
            top: tooltipShouldFlip ? `${activePoint.y + 28}px` : `${Math.max(18, activePoint.y - 18)}px`,
          }}
        >
          <strong>{data[activeIndex]?.label}</strong>
          <span>{formatNumber(data[activeIndex]?.value ?? 0)} {valueSuffix}</span>
        </div>
      ) : null}
      <svg
        key={chartAnimationKey}
        className="owner-lot-analytics__chart owner-lot-analytics__chart--line"
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="רמת ביקוש לפי תקופה"
      >
        <defs>
          <linearGradient id={lineGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={palette.primary} />
            <stop offset="100%" stopColor={palette.secondary} />
          </linearGradient>
          <linearGradient id={areaGradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={palette.secondary} stopOpacity="0.26" />
            <stop offset="100%" stopColor={palette.secondary} stopOpacity="0.02" />
          </linearGradient>
          <filter id={lineShadowId} x="-20%" y="-20%" width="140%" height="160%">
            <feDropShadow dx="0" dy="10" stdDeviation="8" floodColor={palette.primary} floodOpacity="0.18" />
          </filter>
        </defs>
        {[0, 1, 2, 3].map((row) => (
          <line
            key={row}
            x1={padding}
            y1={padding + ((height - padding * 2) / 3) * row}
            x2={width - padding}
            y2={padding + ((height - padding * 2) / 3) * row}
            stroke={palette.grid}
            strokeWidth="1"
            strokeDasharray="4 8"
          />
        ))}
        {activePoint ? <line className="owner-lot-analytics__chart-guide" x1={activePoint.x} y1={padding} x2={activePoint.x} y2={height - padding} style={{ stroke: palette.primary }} /> : null}
        <path className="owner-lot-analytics__chart-area" d={areaPath} fill={`url(#${areaGradientId})`} />
        <path className="owner-lot-analytics__chart-line" d={linePath} fill="none" stroke={`url(#${lineGradientId})`} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" filter={`url(#${lineShadowId})`} />
        {points.map((point, index) => {
          const isPeak = index === peakPoint.index;
          const isActive = activeIndex !== null && index === activeIndex;

          return (
            <g key={index} onMouseEnter={() => setHoveredIndex(index)}>
              {isPeak || isActive ? <circle className="owner-lot-analytics__chart-point-glow" cx={point.x} cy={point.y} r={isActive ? "10" : "8"} fill={palette.secondary} opacity={isActive ? "0.24" : "0.18"} /> : null}
              <circle
                className={`owner-lot-analytics__chart-point ${isActive ? "owner-lot-analytics__chart-point--active" : ""}`}
                cx={point.x}
                cy={point.y}
                r={isActive ? "4.8" : isPeak ? "4.5" : "3.5"}
                fill="#ffffff"
                stroke={isActive || isPeak ? palette.secondary : palette.primary}
                strokeWidth={isActive ? "2.8" : isPeak ? "2.5" : "2"}
              />
              <circle className="owner-lot-analytics__chart-hitbox" cx={point.x} cy={point.y} r="11" fill="transparent" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function OwnerLotAnalytics({ lot }: { lot: OwnerLotsPopupLot }) {
  const [selectedUnit, setSelectedUnit] = useState<RangeUnit>("day");
  const [selectedAmount, setSelectedAmount] = useState(1);
  const [isRangePickerOpen, setIsRangePickerOpen] = useState(false);
  const rangePickerRef = useRef<HTMLDivElement | null>(null);
  const [liveLot, setLiveLot] = useState(lot);
  const [historicalData, setHistoricalData] = useState<Array<BookingHistorySnapshot & { spaceId: string; date: string }>>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isDisposed = false;

    const loadAnalyticsData = async (showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const [historyResult, latestLot] = await Promise.all([
          getActualHistoryForLot(lot.id),
          getParkingLot(lot.id),
        ]);

        if (isDisposed) {
          return;
        }

        setHistoricalData(historyResult.allBookings);
        setLiveLot((current) => ({
          ...current,
          ...lot,
          ...(latestLot ?? {}),
        }));
      } catch (error) {
        if (isDisposed) {
          return;
        }

        console.error("Failed to fetch historical data:", error);
        setHistoricalData([]);
        setLiveLot(lot);
      } finally {
        if (!isDisposed && showLoading) {
          setIsLoading(false);
        }
      }
    };

    setLiveLot(lot);
    void loadAnalyticsData(true);

    const intervalId = window.setInterval(() => {
      void loadAnalyticsData(false);
    }, 60_000);

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
    };
  }, [lot.id]);

  useEffect(() => {
    if (!isRangePickerOpen) {
      return;
    }

    const handlePointerDownOutside = (event: MouseEvent) => {
      if (!rangePickerRef.current?.contains(event.target as Node)) {
        setIsRangePickerOpen(false);
      }
    };

    window.addEventListener("mousedown", handlePointerDownOutside);

    return () => {
      window.removeEventListener("mousedown", handlePointerDownOutside);
    };
  }, [isRangePickerOpen]);

  const palette = useMemo<ChartPalette>(() => {
    return {
      primary: "#0a79b3",
      secondary: "#45b3ff",
      grid: "rgba(8, 80, 120, 0.08)",
      label: "#245f84",
      surface: "rgba(69, 179, 255, 0.16)",
    };
  }, []);

  const cardChecksPalette = useMemo<ChartPalette>(() => {
    return {
      primary: "#0f766e",
      secondary: "#2dd4bf",
      grid: "rgba(15, 118, 110, 0.1)",
      label: "#0f5f5a",
      surface: "rgba(45, 212, 191, 0.14)",
    };
  }, []);

  const recommendationsPalette = useMemo<ChartPalette>(() => {
    return {
      primary: "#c2410c",
      secondary: "#fb923c",
      grid: "rgba(194, 65, 12, 0.1)",
      label: "#9a3412",
      surface: "rgba(251, 146, 60, 0.16)",
    };
  }, []);

  const metrics = useMemo(() => {
    const occupancyRate = liveLot.totalSpaces > 0 ? Math.round(((liveLot.occupiedSpaces + liveLot.reservedSpaces * 0.7) / liveLot.totalSpaces) * 100) : 0;
    const reviewCount = Math.max(0, liveLot.recommendationCount ?? 0);
    const examinedCount = Math.max(0, liveLot.cardChecksCount ?? 0);

    return { occupancyRate, reviewCount, examinedCount };
  }, [liveLot]);

  const updateSelectedAmount = (nextAmount: number) => {
    setSelectedAmount(clampRangeAmount(selectedUnit, nextAmount));
  };

  const handleRangeWheel = (event: React.WheelEvent<HTMLElement>) => {
    event.preventDefault();
    const delta = event.deltaY < 0 ? -1 : 1;
    setSelectedAmount((current) => clampRangeAmount(selectedUnit, current + delta));
  };

  const selectedRangeLabel = useMemo(() => formatRangeSummary(selectedUnit, selectedAmount), [selectedAmount, selectedUnit]);

  const trendSeries = useMemo(() => {
    if (isLoading || historicalData.length === 0) {
      return [];
    }

    return buildRangeChartData(historicalData, selectedUnit, selectedAmount);
  }, [historicalData, isLoading, selectedAmount, selectedUnit]);

  const cardChecksSeries = useMemo(() => {
    return buildHourlyHistorySeries(liveLot.cardChecksHistoryByHour, selectedUnit, selectedAmount);
  }, [liveLot.cardChecksHistoryByHour, selectedAmount, selectedUnit]);

  const recommendationSeries = useMemo(() => {
    return buildHourlyHistorySeries(liveLot.recommendationHistoryByHour, selectedUnit, selectedAmount);
  }, [liveLot.recommendationHistoryByHour, selectedAmount, selectedUnit]);

  return (
    <div className="owner-lot-analytics">
      <div className="owner-lot-analytics__topbar">
        <div>
          <p className="owner-lot-analytics__eyebrow">Lot analytics</p>
          <h3>{liveLot.name}</h3>
          <p className="owner-lot-analytics__description">נתוני החניון מוצגים בהתבסס על היסטוריית הזמנות אמיתית שנשמרה במערכת.</p>
        </div>
        <div className="owner-lot-analytics__range-picker" ref={rangePickerRef}>
          <button
            type="button"
            className={`owner-lot-analytics__range-trigger ${isRangePickerOpen ? "owner-lot-analytics__range-trigger--active" : ""}`}
            onClick={() => setIsRangePickerOpen((current) => !current)}
            aria-expanded={isRangePickerOpen}
            aria-haspopup="dialog"
          >
            <span>הצגת נתונים לפי</span>
            <strong>{selectedRangeLabel}</strong>
          </button>
          {isRangePickerOpen ? (
            <div className="owner-lot-analytics__range-panel" role="dialog" aria-label="בחירת טווח זמן">
              <label className="owner-lot-analytics__range-field">
                <span>יחידת זמן</span>
                <select
                  value={selectedUnit}
                  onChange={(event) => {
                    const nextUnit = event.target.value as RangeUnit;
                    setSelectedUnit(nextUnit);
                    setSelectedAmount((current) => clampRangeAmount(nextUnit, current));
                  }}
                >
                  {rangeUnitOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="owner-lot-analytics__range-field">
                <span>כמות</span>
                <input
                  type="number"
                  min={rangeAmountLimits[selectedUnit].min}
                  max={rangeAmountLimits[selectedUnit].max}
                  value={selectedAmount}
                  onChange={(event) => updateSelectedAmount(Number(event.target.value) || rangeAmountLimits[selectedUnit].min)}
                />
              </label>
            </div>
          ) : null}
        </div>
      </div>

      <section className="owner-lot-analytics__metrics">
        <div className="owner-lot-analytics__metric-card">
          <span>רמת ביקוש</span>
          <strong>{formatNumber(lot.demandScore)}</strong>
        </div>
        <div className="owner-lot-analytics__metric-card">
          <span>ביקורות / המלצות</span>
          <strong>{formatNumber(metrics.reviewCount)}</strong>
        </div>
        <div className="owner-lot-analytics__metric-card">
          <span>נבחן בכרטיס</span>
          <strong>{formatNumber(metrics.examinedCount)}</strong>
        </div>
        <div className="owner-lot-analytics__metric-card">
          <span>עומס ממוצע</span>
          <strong>{formatNumber(metrics.occupancyRate)}%</strong>
        </div>
      </section>

      <div className="owner-lot-analytics__chart-grid">
        {trendSeries.length > 0 ? (
          <MiniLineChart data={trendSeries} palette={palette} onWheel={handleRangeWheel} title="רמת ביקוש לפי תקופה" valueSuffix="הזמנות" />
        ) : (
          <div className="owner-lot-analytics__chart-card">
            <p style={{ color: "#245f84", textAlign: "center", padding: "20px" }}>אין נתונים היסטוריים זמינים עדיין</p>
          </div>
        )}
        {cardChecksSeries.length > 0 ? (
          <MiniLineChart data={cardChecksSeries} palette={cardChecksPalette} onWheel={handleRangeWheel} title="כניסות לכרטיס החניון" valueSuffix="כניסות" />
        ) : (
          <div className="owner-lot-analytics__chart-card">
            <p style={{ color: "#245f84", textAlign: "center", padding: "20px" }}>אין עדיין היסטוריית כניסות לכרטיס</p>
          </div>
        )}
        {recommendationSeries.length > 0 ? (
          <MiniLineChart data={recommendationSeries} palette={recommendationsPalette} onWheel={handleRangeWheel} title="המלצות לחניון לפי תקופה" valueSuffix="המלצות" />
        ) : (
          <div className="owner-lot-analytics__chart-card">
            <p style={{ color: "#245f84", textAlign: "center", padding: "20px" }}>אין עדיין היסטוריית המלצות לחניון</p>
          </div>
        )}
      </div>
    </div>
  );
}