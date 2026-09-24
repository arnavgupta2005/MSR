import { ChartOptions } from '../components/chart-card/chart-card.component';

// Shared visual constants for a consistent enterprise look.
const GRID_COLOR = '#eef1f6';
const AXIS_LABEL_COLOR = '#64748b';

const baseAxisStyle = {
  labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '11px', fontFamily: 'Inter, sans-serif' } }
};

const baseChart = (height: number, type: any): any => ({
  type,
  height,
  fontFamily: 'Inter, sans-serif',
  toolbar: { show: false },
  zoom: { enabled: false },
  animations: { enabled: true, speed: 300 }
});

const baseGrid = { borderColor: GRID_COLOR, strokeDashArray: 4 };

const baseTooltip = { theme: 'light' as const, style: { fontSize: '12px', fontFamily: 'Inter, sans-serif' } };

const baseLegend = {
  position: 'bottom' as const,
  horizontalAlign: 'center' as const,
  fontFamily: 'Inter, sans-serif',
  fontSize: '12px'
};

// Consistent enterprise palette (teams / series).
export const SERIES_COLORS = [
  '#2563eb', '#7c3aed', '#ea8a2b', '#0ea5b5',
  '#dc2626', '#16a34a', '#db2777', '#0891b2'
];

/** Y-axis title helper. */
function yTitle(text: string): ApexYAxisWithTitle {
  return {
    ...baseAxisStyle,
    title: { text, style: { color: AXIS_LABEL_COLOR, fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif' } }
  };
}

type ApexYAxisWithTitle = any;

/**
 * Power BI-style custom tooltip. Renders a bold header (optional group name +
 * Sprint) followed by each series with its colour dot, business name and value.
 */
export function powerBiTooltip(options: {
  headerGroup?: string;          // e.g. team or employee name
  percentSeries?: string[];      // series names rendered with a % suffix
  fixed?: boolean;               // pin the tooltip so it can't be clipped by scroll containers
  compact?: boolean;             // render a smaller, denser tooltip
} = {}): any {
  const { headerGroup, percentSeries = [], fixed = false, compact = false } = options;
  const wrapClass = compact ? 'pbi-tooltip pbi-compact' : 'pbi-tooltip';
  return {
    ...baseTooltip,
    shared: true,
    intersect: false,
    followCursor: !fixed,
    fixed: fixed
      ? { enabled: true, position: 'topLeft', offsetX: 0, offsetY: 0 }
      : { enabled: false },
    custom: ({ series, dataPointIndex, w }: any) => {
      const sprint = w.globals.labels?.[dataPointIndex] ?? '';
      const rows = w.globals.seriesNames
        .map((name: string, i: number) => {
          const val = series[i]?.[dataPointIndex];
          if (val === null || val === undefined) { return ''; }
          const color = w.globals.colors?.[i] ?? '#64748b';
          const suffix = percentSeries.includes(name) ? '%' : '';
          return `
            <div class="pbi-row">
              <span class="pbi-dot" style="background:${color}"></span>
              <span class="pbi-name">${name}</span>
              <span class="pbi-val">${val}${suffix}</span>
            </div>`;
        })
        .join('');
      const header = headerGroup
        ? `<div class="pbi-group">${headerGroup}</div><div class="pbi-sprint">${sprint}</div>`
        : `<div class="pbi-sprint">${sprint}</div>`;
      return `<div class="${wrapClass}">${header}${rows}</div>`;
    }
  };
}


/** Single-series or multi-series line/area trend chart. */
export function buildLineChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 240,
  yAxisTitle = ''
): ChartOptions {
  return {
    series,
    chart: baseChart(height, 'line'),
    colors,
    stroke: { curve: 'smooth', width: 3 },
    markers: { size: 4, strokeWidth: 0, hover: { size: 6 } },
    dataLabels: { enabled: false },
    xaxis: { categories, ...baseAxisStyle, axisBorder: { color: GRID_COLOR }, axisTicks: { color: GRID_COLOR } },
    yaxis: yAxisTitle ? yTitle(yAxisTitle) : { ...baseAxisStyle },
    grid: baseGrid,
    legend: { ...baseLegend, show: series.length > 1 },
    tooltip: baseTooltip
  };
}

/** Grouped/single vertical column chart. */
export function buildColumnChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 240
): ChartOptions {
  return {
    series,
    chart: baseChart(height, 'bar'),
    colors,
    plotOptions: {
      bar: { horizontal: false, columnWidth: '60%', borderRadius: 3, borderRadiusApplication: 'end' }
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    xaxis: { categories, ...baseAxisStyle, axisBorder: { color: GRID_COLOR }, axisTicks: { color: GRID_COLOR } },
    yaxis: { ...baseAxisStyle },
    grid: baseGrid,
    legend: baseLegend,
    tooltip: baseTooltip
  };
}

/** Horizontal bar chart for resource/team labels. */
export function buildHorizontalBarChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 240,
  isPercentage = false
): ChartOptions {
  return {
    series,
    chart: baseChart(height, 'bar'),
    colors,
    plotOptions: {
      bar: { horizontal: true, barHeight: '55%', borderRadius: 3, borderRadiusApplication: 'end' }
    },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      ...baseAxisStyle,
      max: isPercentage ? 100 : undefined,
      axisBorder: { color: GRID_COLOR },
      axisTicks: { color: GRID_COLOR }
    },
    yaxis: { ...baseAxisStyle },
    grid: baseGrid,
    legend: { ...baseLegend, show: series.length > 1 },
    tooltip: baseTooltip
  };
}

/**
 * Horizontal stacked bar chart. Categories (e.g. employees) sit on the Y-axis
 * and each series (e.g. a sprint) is a coloured segment of the bar. Used for
 * QA "Story Points Tested (QA-wise)" where each sprint keeps its own value.
 */
export function buildHorizontalStackedBarChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 260,
  xAxisTitle = '',
  yAxisTitle = '',
  barHeight: string | number = '60%'
): ChartOptions {
  return {
    series,
    chart: { ...baseChart(height, 'bar'), stacked: true } as any,
    colors,
    plotOptions: {
      bar: { horizontal: true, barHeight, borderRadius: 2 }
    },
    dataLabels: {
      enabled: true,
      formatter: (v: number) => (v && v > 0 ? `${v}` : ''),
      style: { fontSize: '11px', fontFamily: 'Inter, sans-serif', colors: ['#ffffff'] }
    },
    stroke: { show: true, width: 1, colors: ['#ffffff'] },
    xaxis: {
      categories,
      // Numeric value axis pinned to the top so it is never hidden behind the
      // scrollbar when the employee list scrolls. The axis title is rendered
      // outside the plot (as a caption above the chart) to avoid overlapping
      // the bars — ApexCharts always draws an in-plot title over the content.
      position: 'top',
      labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '11px', fontFamily: 'Inter, sans-serif' } },
      axisBorder: { color: GRID_COLOR },
      axisTicks: { color: GRID_COLOR }
    },
    yaxis: {
      title: yAxisTitle
        ? { text: yAxisTitle, style: { color: AXIS_LABEL_COLOR, fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif' } }
        : undefined,
      labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '11px', fontFamily: 'Inter, sans-serif' } }
    } as any,
    grid: baseGrid,
    // Legend at the top so the sprint colour swatches are recognisable up-front.
    legend: { ...baseLegend, show: true, position: 'top', horizontalAlign: 'center' },
    tooltip: {
      ...baseTooltip,
      shared: false,
      intersect: true,
      custom: ({ seriesIndex, dataPointIndex, w }: any) => {
        const employee = w.globals.labels?.[dataPointIndex] ?? '';
        const sprint = w.globals.seriesNames?.[seriesIndex] ?? '';
        const val = w.globals.series?.[seriesIndex]?.[dataPointIndex];
        const color = w.globals.colors?.[seriesIndex] ?? '#64748b';
        return `<div class="pbi-tooltip">
            <div class="pbi-group">${employee}</div>
            <div class="pbi-sprint">${sprint}</div>
            <div class="pbi-row">
              <span class="pbi-dot" style="background:${color}"></span>
              <span class="pbi-name">Story Points Tested</span>
              <span class="pbi-val">${val ?? 0}</span>
            </div>
          </div>`;
      }
    }
  };
}


/**
 * Compact multi-series line chart for a single small-multiple panel
 * (one team or one employee). Minimal chrome, shared tooltip.
 */
export function buildPanelLineChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 150,
  headerGroup = '',
  compactTooltip = false,
  rightAxis?: { seriesName: string; min?: number; max?: number; tickAmount?: number; title?: string; leftTitle?: string }
): ChartOptions {
  // When a right-hand axis is requested, give every series its own axis entry so
  // the requested series can be plotted on an opposite scale (e.g. Headcount 1-10)
  // while the remaining series share the primary left axis.
  const leftSeriesName = series.find(x => x.name !== rightAxis?.seriesName)?.name;
  const yaxis = rightAxis
    ? series.map(s =>
        s.name === rightAxis.seriesName
          ? {
              seriesName: rightAxis.seriesName,
              opposite: true,
              min: rightAxis.min ?? 0,
              max: rightAxis.max,
              tickAmount: rightAxis.tickAmount,
              forceNiceScale: rightAxis.tickAmount === undefined,
              title: rightAxis.title
                ? { text: rightAxis.title, style: { color: AXIS_LABEL_COLOR, fontSize: '10px', fontWeight: 600 } }
                : undefined,
              labels: {
                formatter: (v: number) => `${Math.round(v)}`,
                style: { colors: AXIS_LABEL_COLOR, fontSize: '10px', fontFamily: 'Inter, sans-serif' }
              }
            }
          : {
              seriesName: leftSeriesName ?? s.name,
              show: s.name === leftSeriesName,
              min: 0,
              title: rightAxis.leftTitle
                ? { text: rightAxis.leftTitle, style: { color: AXIS_LABEL_COLOR, fontSize: '10px', fontWeight: 600 } }
                : undefined,
              labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '10px', fontFamily: 'Inter, sans-serif' } }
            }
      )
    : { labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '10px', fontFamily: 'Inter, sans-serif' } } };

  return {
    series,
    chart: { ...baseChart(height, 'line'), sparkline: { enabled: false } } as any,
    colors,
    stroke: { curve: 'straight', width: 1.5, lineCap: 'round' },
    markers: { size: 2.5, strokeWidth: 0, hover: { size: 4 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '10px', fontFamily: 'Inter, sans-serif' } },
      axisBorder: { color: GRID_COLOR },
      axisTicks: { color: GRID_COLOR },
      crosshairs: { show: true, stroke: { color: '#94a3b8', width: 1, dashArray: 4 } }
    },
    yaxis: yaxis as any,
    grid: baseGrid,
    legend: { show: false },
    tooltip: powerBiTooltip({ headerGroup, compact: compactTooltip })
  };
}

/**
 * Combo chart: committed/completed as columns + completion % as a line
 * on a secondary axis. Used for team completion panels.
 */
export function buildComboCompletionChart(
  categories: (string | number)[],
  committed: (number | null)[],
  completed: (number | null)[],
  completionPct: (number | null)[],
  height = 170,
  headerGroup = '',
  pointsMax?: number
): ChartOptions {
  return {
    series: [
      { name: 'Completion %', type: 'column', data: completionPct },
      { name: 'Committed Points', type: 'line', data: committed },
      { name: 'Completed Points', type: 'line', data: completed }
    ] as any,
    chart: { ...baseChart(height, 'line'), stacked: false } as any,
    colors: ['#93c5fd', '#ea8a2b', '#16a34a'],
    stroke: { width: [0, 3, 3], curve: 'smooth' },
    plotOptions: { bar: { columnWidth: '55%', borderRadius: 2 } },
    markers: { size: 3, strokeWidth: 0 },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '10px', fontFamily: 'Inter, sans-serif' } },
      axisBorder: { color: GRID_COLOR },
      axisTicks: { color: GRID_COLOR }
    },
    yaxis: [
      {
        seriesName: 'Completion %', min: 0, max: 100,
        title: { text: 'Completion %', style: { color: AXIS_LABEL_COLOR, fontSize: '10px', fontWeight: 600 } },
        labels: { formatter: (v: number) => `${Math.round(v)}%`, style: { colors: AXIS_LABEL_COLOR, fontSize: '10px' } }
      },
      {
        seriesName: 'Committed Points', opposite: true, min: 0, max: pointsMax, forceNiceScale: true,
        title: { text: 'Story Points', style: { color: AXIS_LABEL_COLOR, fontSize: '10px', fontWeight: 600 } },
        labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '10px' } }
      },
      { seriesName: 'Completed Points', opposite: true, min: 0, max: pointsMax, show: false }
    ] as any,
    grid: baseGrid,
    legend: { show: false },
    tooltip: powerBiTooltip({ headerGroup, percentSeries: ['Completion %'] })
  };
}

/**
 * Crisp multi-series line chart with a shared sprint-aligned crosshair.
 * Used for team-wise trend charts where users hover a sprint position to
 * inspect every team at once (no pixel-perfect line hovering required).
 */
export function buildMultiLineChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 260,
  yAxisTitle = ''
): ChartOptions {
  return {
    series,
    chart: baseChart(height, 'line'),
    colors,
    stroke: { curve: 'straight', width: 2 },
    markers: { size: 3, strokeWidth: 0, hover: { size: 5 } },
    dataLabels: { enabled: false },
    xaxis: {
      categories,
      ...baseAxisStyle,
      axisBorder: { color: GRID_COLOR },
      axisTicks: { color: GRID_COLOR },
      crosshairs: { show: true, stroke: { color: '#94a3b8', width: 1, dashArray: 4 } }
    },
    yaxis: yAxisTitle ? yTitle(yAxisTitle) : { ...baseAxisStyle },
    grid: baseGrid,
    legend: { ...baseLegend, show: series.length > 1 },
    tooltip: { ...baseTooltip, shared: true, intersect: false, followCursor: true }
  };
}

/**
 * Grouped bar chart with internal horizontal scroll support. Categories
 * (e.g. employees) sit on the X-axis with one bar per series (e.g. sprint).
 * Used for the Resource Completion Trends chart.
 */
export function buildGroupedBarChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 300,
  isPercentage = false,
  xAxisTitle = '',
  yAxisTitle = ''
): ChartOptions {
  return {
    series,
    chart: baseChart(height, 'bar'),
    colors,
    plotOptions: {
      bar: { horizontal: false, columnWidth: '70%', borderRadius: 2, borderRadiusApplication: 'end' }
    },
    dataLabels: { enabled: false },
    stroke: { show: true, width: 2, colors: ['transparent'] },
    xaxis: {
      categories,
      title: xAxisTitle
        ? { text: xAxisTitle, style: { color: AXIS_LABEL_COLOR, fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif' } }
        : undefined,
      labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '11px', fontFamily: 'Inter, sans-serif' }, rotate: -45, trim: true, hideOverlappingLabels: false },
      axisBorder: { color: GRID_COLOR },
      axisTicks: { color: GRID_COLOR }
    },
    yaxis: {
      min: 0,
      max: isPercentage ? 100 : undefined,
      title: yAxisTitle
        ? { text: yAxisTitle, style: { color: AXIS_LABEL_COLOR, fontSize: '11px', fontWeight: 600, fontFamily: 'Inter, sans-serif' } }
        : undefined,
      labels: {
        formatter: isPercentage ? (v: number) => `${Math.round(v)}%` : undefined,
        style: { colors: AXIS_LABEL_COLOR, fontSize: '11px', fontFamily: 'Inter, sans-serif' }
      }
    } as any,
    grid: baseGrid,
    legend: baseLegend,
    tooltip: {
      ...baseTooltip,
      shared: true,
      intersect: false,
      followCursor: true,
      custom: ({ series: s, dataPointIndex, w }: any) => {
        const employee = w.globals.labels?.[dataPointIndex] ?? '';
        const rows = w.globals.seriesNames
          .map((name: string, i: number) => {
            const val = s[i]?.[dataPointIndex];
            if (val === null || val === undefined) { return ''; }
            const color = w.globals.colors?.[i] ?? '#64748b';
            const suffix = isPercentage ? '%' : '';
            return `
              <div class="pbi-row">
                <span class="pbi-dot" style="background:${color}"></span>
                <span class="pbi-name">${name}</span>
                <span class="pbi-val">${val}${suffix}</span>
              </div>`;
          })
          .join('');
        return `<div class="pbi-tooltip"><div class="pbi-group">${employee}</div>${rows}</div>`;
      }
    }
  };
}

/**
 * ServiceNow Tickets combo chart. Four ticket categories are rendered as
 * separate columns (left axis = ticket count) and Completion % as a dashed
 * line on a secondary right axis (0-100%). Categories are the sprints.
 */
export function buildServiceNowTicketsChart(
  categories: (string | number)[],
  criticalWeb: (number | null)[],
  web: (number | null)[],
  criticalMobile: (number | null)[],
  mobile: (number | null)[],
  completionPct: (number | null)[],
  height = 380
): ChartOptions {
  const ticketColors = ['#16a34a', '#bbf7d0', '#0f5b78', '#bfe4f5'];
  const completionColor = '#111827';

  // Keep the bars in the lower band of the plot so the completion % line and its
  // labels (on the right axis) sit above the bars and never overlap their values.
  const allTicketValues = [...criticalWeb, ...web, ...criticalMobile, ...mobile]
    .filter((v): v is number => v !== null && v !== undefined);
  const maxTicket = allTicketValues.length ? Math.max(...allTicketValues) : 0;
  // Round the real data max up to a clean step, then add ~40% headroom so the
  // completion line stays above the bars. Ticks are derived from this so the
  // axis always covers the actual values (e.g. 22 -> axis max 35, ticks 0..35).
  const niceStep = maxTicket <= 10 ? 2 : maxTicket <= 30 ? 5 : 10;
  const niceMax = Math.max(niceStep, Math.ceil(maxTicket / niceStep) * niceStep);
  const ticketAxisMax = niceMax + Math.ceil((niceMax * 0.4) / niceStep) * niceStep;
  const ticketTicks = Math.round(ticketAxisMax / niceStep);

  return {
    series: [
      { name: 'Critical Web', type: 'column', data: criticalWeb },
      { name: 'Web', type: 'column', data: web },
      { name: 'Critical Mobile', type: 'column', data: criticalMobile },
      { name: 'Mobile', type: 'column', data: mobile },
      { name: 'Completion %', type: 'line', data: completionPct }
    ] as any,
    chart: { ...baseChart(height, 'line'), stacked: false } as any,
    colors: [...ticketColors, completionColor],
    stroke: { width: [0, 0, 0, 0, 2], curve: 'straight', dashArray: [0, 0, 0, 0, 6] },
    plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } },
    markers: { size: [0, 0, 0, 0, 5], strokeWidth: 0 },
    dataLabels: {
      enabled: true,
      enabledOnSeries: [0, 1, 2, 3, 4],
      formatter: (val: number, opts: any) =>
        opts?.seriesIndex === 4
          ? (val === null || val === undefined ? '' : `${Math.round(val)}%`)
          : `${val}`,
      background: {
        enabled: true,
        foreColor: '#ffffff',
        borderWidth: 0,
        borderRadius: 3,
        padding: 3,
        opacity: 1,
        dropShadow: { enabled: false }
      },
      style: {
        fontSize: '10px',
        fontFamily: 'Inter, sans-serif',
        colors: [AXIS_LABEL_COLOR, AXIS_LABEL_COLOR, AXIS_LABEL_COLOR, AXIS_LABEL_COLOR, completionColor]
      },
      offsetY: -8
    },
    xaxis: {
      categories,
      labels: { style: { colors: AXIS_LABEL_COLOR, fontSize: '12px', fontFamily: 'Inter, sans-serif' } },
      axisBorder: { color: GRID_COLOR },
      axisTicks: { color: GRID_COLOR }
    },
    yaxis: [
      {
        seriesName: 'Critical Web', min: 0, max: ticketAxisMax, tickAmount: ticketTicks,
        title: { text: 'Ticket Count', style: { color: AXIS_LABEL_COLOR, fontSize: '11px', fontWeight: 600 } },
        labels: {
          formatter: (v: number) => `${Math.round(v)}`,
          style: { colors: AXIS_LABEL_COLOR, fontSize: '11px' }
        }
      },
      { seriesName: 'Web', show: false, min: 0, max: ticketAxisMax, tickAmount: ticketTicks },
      { seriesName: 'Critical Mobile', show: false, min: 0, max: ticketAxisMax, tickAmount: ticketTicks },
      { seriesName: 'Mobile', show: false, min: 0, max: ticketAxisMax, tickAmount: ticketTicks },
      {
        seriesName: 'Completion %', opposite: true, min: 0, max: 100, tickAmount: 5,
        title: { text: 'Completion %', style: { color: AXIS_LABEL_COLOR, fontSize: '11px', fontWeight: 600 } },
        labels: {
          formatter: (v: number) => `${Math.round(v)}%`,
          style: { colors: AXIS_LABEL_COLOR, fontSize: '11px' }
        }
      }
    ] as any,
    grid: { ...baseGrid, padding: { top: 24 } },
    legend: { ...baseLegend, show: true },
    tooltip: powerBiTooltip({ percentSeries: ['Completion %'] })
  };
}

