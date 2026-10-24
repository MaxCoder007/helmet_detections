import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
} from 'recharts';
import { ClassCounts } from '@/types/detection';
import { DETECTION_CLASSES } from '@/utils/constants';

interface ClassBreakdownChartProps {
  counts: ClassCounts;
  totalObjects: number;
}

export const ClassBreakdownChart: React.FC<ClassBreakdownChartProps> = ({
  counts,
  totalObjects,
}) => {
  const data = [
    {
      name: 'Helmet',
      classKey: 'helmet',
      count: counts.helmet || 0,
      color: DETECTION_CLASSES.helmet.color,
    },
    {
      name: 'No Helmet',
      classKey: 'no_helmet',
      count: counts.no_helmet || 0,
      color: DETECTION_CLASSES.no_helmet.color,
    },
    {
      name: 'Number Plate',
      classKey: 'number_plate',
      count: counts.number_plate || 0,
      color: DETECTION_CLASSES.number_plate.color,
    },
    {
      name: 'Rider',
      classKey: 'rider',
      count: counts.rider || 0,
      color: DETECTION_CLASSES.rider.color,
    },
    {
      name: 'Pillion',
      classKey: 'pillion',
      count: counts.pillion || 0,
      color: DETECTION_CLASSES.pillion.color,
    },
  ];

  if (totalObjects === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-text-muted text-xs p-6 text-center border border-dashed border-border rounded-xl">
        <p>No detection data in current session.</p>
        <p className="mt-1 text-[11px]">Upload an image to see detection distributions.</p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      const pct = Math.round((item.count / totalObjects) * 100);
      return (
        <div className="bg-background-card border border-border p-2.5 rounded-lg shadow-lg text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-text-primary">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.name}</span>
          </div>
          <div className="mt-1 text-text-secondary">
            <span className="font-mono font-bold text-text-primary">{item.count}</span> detections ({pct}%)
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 25 }}
        >
          <XAxis
            dataKey="name"
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#27272A' }}
            interval={0}
            angle={-15}
            textAnchor="end"
          />
          <YAxis
            stroke="#71717A"
            fontSize={11}
            tickLine={false}
            axisLine={{ stroke: '#27272A' }}
            allowDecimals={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};
