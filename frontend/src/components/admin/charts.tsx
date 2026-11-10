import { useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SERIES = 'var(--chart-series)';
const AXIS = {
  stroke: 'var(--muted-foreground)',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

interface TooltipState {
  active?: boolean;
  label?: string | number;
  payload?: readonly { value?: unknown; payload?: { name?: string } }[];
}

function ChartTooltip({ active, payload, label, unit }: TooltipState & { unit: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{label}</p>
      <p className="text-muted-foreground">
        <span className="font-semibold tabular-nums text-foreground">
          {String(payload[0]!.value ?? '')}
        </span>{' '}
        {unit}
      </p>
    </div>
  );
}

function TableToggle({
  rows,
  columns,
}: {
  rows: (string | number)[][];
  columns: [string, string];
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="mt-2">
      <Button
        variant="link"
        size="sm"
        className="h-auto p-0 text-xs"
        onClick={() => setShow((s) => !s)}
        aria-expanded={show}
      >
        {show ? 'Hide data table' : 'Show data table'}
      </Button>
      {show && (
        <div className="mt-2 max-h-64 overflow-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{columns[0]}</TableHead>
                <TableHead className="text-right">{columns[1]}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map(([a, b]) => (
                <TableRow key={String(a)}>
                  <TableCell>{a}</TableCell>
                  <TableCell className="text-right tabular-nums">{b}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

const shortDate = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });

export function QuestionsPerDayChart({ data }: { data: { date: string; count: number }[] }) {
  const rows = data.map((d) => ({ ...d, label: shortDate(d.date) }));
  return (
    <div>
      <div className="h-64" role="img" aria-label="Questions asked per day over the last 30 days">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
            <defs>
              <linearGradient id="qpd-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES} stopOpacity={0.25} />
                <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
            <YAxis allowDecimals={false} {...AXIS} width={40} />
            <Tooltip
              cursor={{ stroke: 'var(--muted-foreground)', strokeDasharray: '3 3' }}
              content={(props) => <ChartTooltip {...(props as TooltipState)} unit="questions" />}
            />
            <Area
              type="monotone"
              dataKey="count"
              stroke={SERIES}
              strokeWidth={2}
              fill="url(#qpd-fill)"
              activeDot={{ r: 5, stroke: 'var(--card)', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <TableToggle rows={rows.map((r) => [r.label, r.count])} columns={['Day', 'Questions']} />
    </div>
  );
}

export function QuestionsPerSubjectChart({
  data,
}: {
  data: { code: string; name: string; questions: number }[];
}) {
  const rows = data.filter((d) => d.questions > 0).slice(0, 10);
  if (rows.length === 0)
    return <p className="py-10 text-center text-sm text-muted-foreground">No questions yet.</p>;
  return (
    <div>
      <div
        style={{ height: Math.max(160, rows.length * 34) }}
        role="img"
        aria-label="Questions per subject"
      >
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={rows}
            layout="vertical"
            margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
            barCategoryGap={6}
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" allowDecimals={false} {...AXIS} />
            <YAxis type="category" dataKey="code" {...AXIS} width={56} />
            <Tooltip
              cursor={{ fill: 'var(--muted)', opacity: 0.6 }}
              content={(props) => {
                const p = props as TooltipState;
                return (
                  <ChartTooltip {...p} label={p.payload?.[0]?.payload?.name} unit="questions" />
                );
              }}
            />
            <Bar dataKey="questions" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <TableToggle
        rows={rows.map((r) => [`${r.code} · ${r.name}`, r.questions])}
        columns={['Subject', 'Questions']}
      />
    </div>
  );
}
