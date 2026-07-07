import { useEffect, useState } from "react";
import { Factory } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { getJson } from "../lib/api";
import { formatNumber } from "../lib/format";

interface IndustrialUser {
  userId: string;
  userName: string;
  city: string;
  industry: string;
  contractCapacityKva: number;
  activePowerKw: number;
  loadRate: number;
}

export function IndustrialPage() {
  const [rows, setRows] = useState<IndustrialUser[]>([]);
  useEffect(() => void getJson<IndustrialUser[]>("/operations/industrial").then(setRows), []);
  return (
    <Card className="border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Factory className="h-4 w-4 text-blue-600" />
          大工业用户负荷分析
        </CardTitle>
        <Badge variant="secondary">Top {rows.length}</Badge>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>用户</TableHead>
              <TableHead>地市</TableHead>
              <TableHead>行业</TableHead>
              <TableHead>当前负荷</TableHead>
              <TableHead>负载率</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.userId}>
                <TableCell className="font-medium">{row.userName}</TableCell>
                <TableCell>{row.city}</TableCell>
                <TableCell>{row.industry}</TableCell>
                <TableCell>{formatNumber(row.activePowerKw)} kW</TableCell>
                <TableCell>
                  <Badge variant={row.loadRate > 100 ? "destructive" : row.loadRate > 80 ? "secondary" : "outline"}>
                    {formatNumber(row.loadRate)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
