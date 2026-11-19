# Implementation Checklist ✅

## Task 1: Change Graph Numbering (3,4,6,7 → 1,2,3,4) ✅

### Before:
```html
<!-- 3. Headcount Trends Across Sprints -->
<app-chart-card [index]="3" title="Headcount Trends..." />

<!-- 4. Completion % Trends Across Sprints -->
<app-chart-card [index]="4" title="Completion % Trends..." />

<!-- 6. Rollovers vs Rollover Points -->
<app-chart-card [index]="6" title="Rollovers vs..." />

<!-- 7. Velocity vs Assigned Points vs Delivered -->
<app-chart-card [index]="7" title="Velocity vs..." />
```

### After:
```html
<!-- 1. Headcount Trends Across Sprints -->
<app-chart-card [index]="1" title="Headcount Trends..." />

<!-- 2. Completion % Trends Across Sprints -->
<app-chart-card [index]="2" title="Completion % Trends..." />

<!-- 3. Rollovers vs Rollover Points -->
<app-chart-card [index]="3" title="Rollovers vs..." />

<!-- 4. Velocity vs Assigned Points vs Delivered -->
<app-chart-card [index]="4" title="Velocity vs..." />
```

---

## Task 2: Multi-Select Product Filter ✅

### Before:
```html
<!-- Single select dropdown -->
<app-product-selector
  [products]="products"
  [selectedId]="selectedProductId"
  (selectedIdChange)="onProductChange($event)">
</app-product-selector>
```

### After:
```html
<!-- Multi-select component -->
<app-sprint-multi-select
  [sprints]="productsAsOptions"
  [selected]="selectedProductIds"
  (selectedChange)="onProductsChange($event)">
</app-sprint-multi-select>
```

### KPI Aggregation Logic:

#### TypeScript Implementation:
```typescript
selectedProductIds: number[] = [DEVELOPMENT_PRODUCTS[0].id];

get selectedProductNames(): string {
  return this.selectedProductIds
    .map(id => this.products.find(p => p.id === id)?.name || '')
    .filter(name => name)
    .join(', ');
}

onProductsChange(ids: number[]): void {
  this.selectedProductIds = ids.length > 0 ? ids : [DEVELOPMENT_PRODUCTS[0].id];
  this.loadKpis();
  this.loadCharts();
}

loadKpis(): void {
  // Load KPIs for all selected products
  const requests = this.selectedProductIds.map(productId =>
    this.service.getKpis(productId, this.selectedKpiSprints)
  );

  Promise.all(requests.map(r => r.toPromise())).then(results => {
    // Store by product
    for (let i = 0; i < this.selectedProductIds.length; i++) {
      this.kpiByProduct.set(this.selectedProductIds[i], results[i]);
    }
    // Aggregate
    this.aggregateKpis();
  });
}

private aggregateKpis(): void {
  const kpiArray = Array.from(this.kpiByProduct.values());
  
  const aggregated: SprintPerformanceKpi = {
    headcount: this.sumField(kpiArray, 'headcount'),
    velocity: this.sumField(kpiArray, 'velocity'),
    assignedPoints: this.sumField(kpiArray, 'assignedPoints'),
    deliveredPoints: this.sumField(kpiArray, 'deliveredPoints'),
    rollovers: this.sumField(kpiArray, 'rollovers'),
    rolloverPoints: this.sumField(kpiArray, 'rolloverPoints'),
    plannedItems: this.sumField(kpiArray, 'plannedItems'),
    deliveredItems: this.sumField(kpiArray, 'deliveredItems'),
    completionPercentage: this.averagePercentage(kpiArray)
  };
  
  this.kpi = aggregated;
  this.kpiState = 'ready';
}

private sumField(kpis: (SprintPerformanceKpi | null)[], 
                 field: keyof SprintPerformanceKpi): number | null {
  const sum = kpis.reduce((acc, kpi) => {
    const value = kpi?.[field];
    return acc + (typeof value === 'number' ? value : 0);
  }, 0);
  return sum > 0 ? sum : null;
}

private averagePercentage(kpis: (SprintPerformanceKpi | null)[]): number | null {
  const percentages = kpis
    .map(kpi => kpi?.completionPercentage)
    .filter((v): v is number => typeof v === 'number');
  
  if (percentages.length === 0) return null;
  
  const avg = percentages.reduce((a, b) => a + b, 0) / percentages.length;
  return Math.round(avg * 100) / 100;
}
```

#### User Selection Example:
```
User selects: "Intrics Dev" + "InfoQuest Web"

API Calls:
  - GET /SprintPerformance/kpis?ProductAreaId=1&SprintIds=...
  - GET /SprintPerformance/kpis?ProductAreaId=2&SprintIds=...

Results:
  Product 1 (Intrics Dev):     { headcount: 18, velocity: 1500, ... }
  Product 2 (InfoQuest Web):   { headcount: 15, velocity: 1255, ... }

Aggregated Display:
  - Headcount: 33
  - Velocity: 2,755
  - Assigned Points: 3,500
  - Delivered Points: 3,200
  - Completion %: 95.5% (avg of 96% and 95%)
  - etc...
```

---

## Task 3: Product Names in Tooltips ✅

### Before:
```typescript
buildLineChart(categories, series, colors, 260, 'Velocity')
// Tooltip shows only sprint and values
```

### After:
```typescript
buildLineChart(categories, series, colors, 260, 'Velocity', 
              this.selectedProductNames)
// Tooltip shows: "Intrics Dev, InfoQuest Web" + Sprint + Values
```

### Chart Tooltip Display:

#### Single Product (e.g., "Intrics Dev"):
```
┌──────────────────────────┐
│   Intrics Dev            │
│   Sprint 15              │
├──────────────────────────┤
│ ● Delivered Points: 650  │
│ ● Trailing Velocity: 630 │
└──────────────────────────┘
```

#### Multiple Products (e.g., "Intrics Dev, InfoQuest Web"):
```
┌──────────────────────────────────────┐
│   Intrics Dev, InfoQuest Web         │
│   Sprint 15                          │
├──────────────────────────────────────┤
│ ● Delivered Points: 1,200            │
│ ● Trailing Velocity: 1,180           │
└──────────────────────────────────────┘
```

### Enhanced Chart Builder Functions:

```typescript
// In chart-options.builder.ts

export function buildLineChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 240,
  yAxisTitle = '',
  productName?: string  // ← NEW PARAMETER
): ChartOptions {
  return {
    series,
    chart: baseChart(height, 'line'),
    colors,
    // ... other options
    tooltip: productName 
      ? powerBiTooltip({ headerGroup: productName })  // ← USES powerBiTooltip
      : baseTooltip
  };
}

export function buildMultiLineChart(
  categories: (string | number)[],
  series: { name: string; data: (number | null)[] }[],
  colors: string[],
  height = 240,
  yAxisTitle = '',
  productName?: string  // ← NEW PARAMETER
): ChartOptions {
  return {
    series,
    chart: baseChart(height, 'line'),
    colors,
    // ... other options
    tooltip: productName
      ? powerBiTooltip({ headerGroup: productName })
      : { ...baseTooltip, shared: true, intersect: false, followCursor: true }
  };
}
```

### Updated Chart Calls in Component:

```typescript
// Before
this.headcountTrend = {
  state: 'ready',
  options: buildLineChart(
    categories,
    [{ name: 'Headcount', data: [...] }],
    [SERIES_COLORS[1]],
    260,
    'Headcount'
  )
};

// After
this.headcountTrend = {
  state: 'ready',
  options: buildLineChart(
    categories,
    [{ name: 'Headcount', data: [...] }],
    [SERIES_COLORS[1]],
    260,
    'Headcount',
    this.selectedProductNames  // ← ADDED
  )
};
```

---

## Verification Checklist:

- ✅ Graph numbering changed from 3,4,6,7 to 1,2,3,4 in KPI Summary
- ✅ Product filter changed to multi-select dropdown
- ✅ Users can select multiple products simultaneously
- ✅ KPI cards aggregate data from all selected products (sum for counts/points, avg for percentages)
- ✅ Chart tooltips display product name(s) as header
- ✅ Chart tooltips show sprint and data metrics below product name
- ✅ Responsive design maintained
- ✅ Backward compatibility preserved (single product selection still works)
- ✅ All service calls properly replaced `selectedProductId` with `primaryProductId` where needed

---

## Testing Recommendations:

1. **Single Product Selection:**
   - Select only "Intrics Dev"
   - Verify KPI cards show correct individual product data
   - Verify tooltip shows "Intrics Dev"

2. **Multiple Product Selection:**
   - Select "Intrics Dev" + "InfoQuest Web"
   - Verify KPI cards show aggregated totals
   - Verify tooltip shows "Intrics Dev, InfoQuest Web"
   - Check math: Headcount and other metrics should be sums

3. **Empty Selection:**
   - Deselect all products
   - Verify default product is reselected automatically
   - Verify no errors occur

4. **Chart Display:**
   - Hover over different sprints in charts
   - Verify product name appears in tooltip header
   - Verify metrics display correctly below product name

---

## Browser DevTools Testing:

```javascript
// Check selected product IDs
console.log(component.selectedProductIds); // [1, 2]

// Check selected product names
console.log(component.selectedProductNames); // "Intrics Dev, InfoQuest Web"

// Check aggregated KPI
console.log(component.kpi);
// {
//   headcount: 33,
//   velocity: 2755,
//   assignedPoints: 3500,
//   ...
// }
```
