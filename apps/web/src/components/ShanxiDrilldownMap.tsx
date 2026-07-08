import { useEffect, useMemo, useRef, useState } from "react";
import * as echarts from "echarts";
import { AlertTriangle, ArrowLeft, ChevronRight, RadioTower } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { RoleView } from "../lib/roles";
import shanxiMap from "../data/maps/140000_full.json";
import taiyuanMap from "../data/maps/140100_full.json";
import datongMap from "../data/maps/140200_full.json";
import yangquanMap from "../data/maps/140300_full.json";
import changzhiMap from "../data/maps/140400_full.json";
import jinchengMap from "../data/maps/140500_full.json";
import shuozhouMap from "../data/maps/140600_full.json";
import jinzhongMap from "../data/maps/140700_full.json";
import yunchengMap from "../data/maps/140800_full.json";
import xinzhouMap from "../data/maps/140900_full.json";
import linfenMap from "../data/maps/141000_full.json";
import lvliangMap from "../data/maps/141100_full.json";

interface RiskItem {
  eventId: string;
  riskType: string;
  level: string;
  message: string;
  timestamp: string;
  city?: string;
  county?: string;
  userName?: string;
  industry?: string;
}

interface MapFeature {
  properties?: {
    name?: string;
    adcode?: number;
    center?: number[];
    centroid?: number[];
  };
}

interface GeoJsonLike {
  features?: MapFeature[];
}

function asGeoJson(value: unknown): GeoJsonLike {
  return value as GeoJsonLike;
}

function toCoord(value?: number[]): [number, number] | undefined {
  if (!value || value.length < 2) return undefined;
  return [Number(value[0]), Number(value[1])];
}

const cityMeta: Record<string, { adcode: number; fullName: string; map: GeoJsonLike }> = {
  太原: { adcode: 140100, fullName: "太原市", map: asGeoJson(taiyuanMap) },
  大同: { adcode: 140200, fullName: "大同市", map: asGeoJson(datongMap) },
  阳泉: { adcode: 140300, fullName: "阳泉市", map: asGeoJson(yangquanMap) },
  长治: { adcode: 140400, fullName: "长治市", map: asGeoJson(changzhiMap) },
  晋城: { adcode: 140500, fullName: "晋城市", map: asGeoJson(jinchengMap) },
  朔州: { adcode: 140600, fullName: "朔州市", map: asGeoJson(shuozhouMap) },
  晋中: { adcode: 140700, fullName: "晋中市", map: asGeoJson(jinzhongMap) },
  运城: { adcode: 140800, fullName: "运城市", map: asGeoJson(yunchengMap) },
  忻州: { adcode: 140900, fullName: "忻州市", map: asGeoJson(xinzhouMap) },
  临汾: { adcode: 141000, fullName: "临汾市", map: asGeoJson(linfenMap) },
  吕梁: { adcode: 141100, fullName: "吕梁市", map: asGeoJson(lvliangMap) }
};

export function ShanxiDrilldownMap({
  role,
  risks,
  selectedCity,
  onSelectCity
}: {
  role: RoleView;
  risks: RiskItem[];
  selectedCity: string;
  onSelectCity: (city: string) => void;
}) {
  const chartRef = useRef<HTMLDivElement | null>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [level, setLevel] = useState<"province" | "city">("province");
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const currentCityMeta = cityMeta[selectedCity] ?? cityMeta["太原"];
  const currentMapName = level === "province" ? "shanxi-province" : `shanxi-city-${currentCityMeta.adcode}`;
  const currentGeoJson = level === "province" ? asGeoJson(shanxiMap) : currentCityMeta.map;
  const selectedRisks = risks.filter((risk) => risk.city === selectedCity);
  const visibleCities = role.cities.filter((city) => cityMeta[city]);
  const selectedScopeRisks = selectedCounty ? risksForArea(selectedRisks, selectedCounty) : selectedRisks;

  const cityMetrics = useMemo(() => {
    const metrics = new Map<string, { name: string; value: number; severe: number; center?: [number, number] }>();
    for (const city of visibleCities) {
      const feature = featureByName(asGeoJson(shanxiMap), cityMeta[city].fullName);
      const cityRisks = risks.filter((risk) => risk.city === city);
      const severe = cityRisks.filter((risk) => risk.level === "critical").length;
      metrics.set(cityMeta[city].fullName, {
        name: cityMeta[city].fullName,
        value: cityRisks.length,
        severe,
        center: toCoord(feature?.properties?.centroid ?? feature?.properties?.center)
      });
    }
    return metrics;
  }, [risks, visibleCities]);

  const countyMetrics = useMemo(() => {
    const metrics = new Map<string, { name: string; value: number; severe: number; center?: [number, number] }>();
    currentCityMeta.map.features?.forEach((feature, index) => {
      const name = feature.properties?.name ?? "";
      const scopedRisks = risksForCountySlot(selectedRisks, name, index);
      metrics.set(name, {
        name,
        value: scopedRisks.length,
        severe: scopedRisks.filter((risk) => risk.level === "critical").length,
        center: toCoord(feature.properties?.centroid ?? feature.properties?.center)
      });
    });
    return metrics;
  }, [currentCityMeta.map.features, selectedRisks]);

  useEffect(() => {
    echarts.registerMap("shanxi-province", shanxiMap as never);
    Object.entries(cityMeta).forEach(([city, meta]) => {
      echarts.registerMap(`shanxi-city-${meta.adcode}`, meta.map as never);
    });
  }, []);

  useEffect(() => {
    if (!chartRef.current) return;
    const chart = chartInstance.current ?? echarts.init(chartRef.current, undefined, { renderer: "canvas" });
    chartInstance.current = chart;
    const metrics = level === "province" ? cityMetrics : countyMetrics;
    const data = Array.from(metrics.values()).map((item) => ({
      name: item.name,
      value: item.value,
      severe: item.severe
    }));
    const scatter = Array.from(metrics.values())
      .filter((item) => item.center)
      .map((item) => ({
        name: item.name,
        value: [...(item.center as [number, number]), Math.max(item.value, 1)],
        severe: item.severe
      }));

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "item",
        borderWidth: 0,
        backgroundColor: "rgba(15, 23, 42, 0.92)",
        textStyle: { color: "#e0f2fe" },
        formatter: (params: { name?: string; data?: { value?: number; severe?: number } }) => {
          const value = params.data?.value ?? 0;
          const severe = params.data?.severe ?? 0;
          return `${params.name}<br/>风险事件 ${value}<br/>严重风险 ${severe}`;
        }
      },
      visualMap: {
        show: false,
        min: 0,
        max: 20,
        inRange: {
          color: ["#164e63", "#0f766e", "#f59e0b", "#e11d48"]
        }
      },
      geo: {
        map: currentMapName,
        roam: false,
        zoom: level === "province" ? 1.08 : 1.03,
        top: 18,
        bottom: 14,
        label: {
          show: true,
          color: "#dffcff",
          fontSize: level === "province" ? 12 : 11,
          fontWeight: 600
        },
        itemStyle: {
          areaColor: "#0f766e",
          borderColor: "#a7f3d0",
          borderWidth: 1.2,
          shadowColor: "rgba(34, 211, 238, 0.35)",
          shadowBlur: 18
        },
        emphasis: {
          label: { color: "#ffffff" },
          itemStyle: {
            areaColor: "#f59e0b",
            borderColor: "#fef3c7",
            shadowBlur: 28
          }
        },
        select: {
          label: { color: "#ffffff" },
          itemStyle: { areaColor: "#dc2626" }
        }
      },
      series: [
        {
          type: "map",
          map: currentMapName,
          geoIndex: 0,
          data
        },
        {
          type: "effectScatter",
          coordinateSystem: "geo",
          data: scatter,
          symbolSize: (value: number[]) => Math.min(20, 7 + Number(value[2]) * 1.7),
          rippleEffect: { brushType: "stroke", scale: 3.4 },
          itemStyle: { color: "#fbbf24", shadowBlur: 12, shadowColor: "#fde68a" },
          zlevel: 2
        }
      ]
    }, true);

    const onMapClick = (params: { name?: string }) => {
      if (!params.name) return;
      if (level === "province") {
        const city = normalizeCityName(params.name);
        if (city && role.cities.includes(city)) {
          onSelectCity(city);
          setSelectedCounty(null);
          setLevel("city");
        }
      } else {
        setSelectedCounty(params.name);
      }
    };
    chart.off("click");
    chart.on("click", onMapClick);

    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    return () => {
      window.removeEventListener("resize", resize);
      chart.off("click", onMapClick);
    };
  }, [cityMetrics, countyMetrics, currentMapName, level, onSelectCity, role.cities]);

  useEffect(() => () => chartInstance.current?.dispose(), []);

  const backToProvince = () => {
    setSelectedCounty(null);
    setLevel("province");
  };

  const riskIndex = level === "province"
    ? Array.from(cityMetrics.values()).reduce((sum, item) => sum + item.value + item.severe * 3, 0)
    : selectedScopeRisks.length + selectedScopeRisks.filter((risk) => risk.level === "critical").length * 3;

  return (
    <Card className="overflow-hidden border-cyan-200/70 bg-[#07131a] text-white shadow-[0_20px_60px_rgba(8,47,73,0.25)]">
      <CardHeader className="flex flex-row items-center justify-between border-b border-cyan-300/10 bg-white/[0.03]">
        <CardTitle className="flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-cyan-300" />
          山西省全域用电风险 GIS
        </CardTitle>
        <Badge className="border-cyan-300/40 bg-cyan-300/10 text-cyan-100" variant="outline">
          {level === "province" ? "省级地市下钻" : `${selectedCity} 区县下钻`}
        </Badge>
      </CardHeader>
      <CardContent className="grid gap-4 p-4 xl:grid-cols-[1.25fr_.75fr]">
        <div className="relative min-h-[520px] overflow-hidden rounded-lg border border-cyan-300/15 bg-[radial-gradient(circle_at_45%_20%,rgba(34,211,238,0.22),transparent_32%),linear-gradient(135deg,#061018,#0b1f28_48%,#07131a)]">
          <div className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(125,211,252,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(125,211,252,.12)_1px,transparent_1px)] [background-size:28px_28px]" />
          <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
            {level === "city" && (
              <Button className="h-8 border-cyan-300/30 bg-cyan-300/10 text-cyan-50 hover:bg-cyan-300/20" onClick={backToProvince} size="sm" variant="outline">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                返回山西省
              </Button>
            )}
            <Badge className="bg-cyan-300 text-slate-950">山西省</Badge>
            <ChevronRight className="h-3.5 w-3.5 text-cyan-200/60" />
            <Badge className="border-cyan-300/35 text-cyan-50" variant="outline">
              {level === "province" ? "11 地市" : selectedCity}
            </Badge>
            {selectedCounty && <Badge className="border-amber-300/50 text-amber-100" variant="outline">{selectedCounty}</Badge>}
          </div>
          <div ref={chartRef} className="absolute inset-0 pt-12" />
          <div className="absolute bottom-4 left-4 right-4 z-10 grid gap-2 md:grid-cols-3">
            <ScreenMetric label="运行层级" value={level === "province" ? "省级" : "市县"} />
            <ScreenMetric label="风险指数" value={riskIndex} />
            <ScreenMetric label="严重告警" value={selectedScopeRisks.filter((risk) => risk.level === "critical").length} />
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-lg border border-cyan-300/15 bg-white/[0.04] p-4">
            <p className="text-xs text-cyan-100/70">当前路径</p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              山西省 / {level === "province" ? "全地市" : selectedCity}
              {selectedCounty ? ` / ${selectedCounty}` : ""}
            </h3>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <PanelMetric label={level === "province" ? "地市" : "区县"} value={level === "province" ? visibleCities.length : currentGeoJson.features?.length ?? 0} />
              <PanelMetric label="告警" value={selectedScopeRisks.length} />
              <PanelMetric label="严重" value={selectedScopeRisks.filter((risk) => risk.level === "critical").length} />
            </div>
          </div>

          <div className="grid gap-2">
            {selectedScopeRisks.slice(0, 5).map((risk) => (
              <article className="rounded-lg border border-cyan-300/15 bg-white/[0.04] p-3" key={risk.eventId}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-cyan-50">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-300" />
                    {risk.riskType}
                  </span>
                  <Badge variant={risk.level === "critical" ? "destructive" : "secondary"}>{risk.level}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-cyan-100/65">{risk.message}</p>
              </article>
            ))}
            {selectedScopeRisks.length === 0 && (
              <div className="rounded-lg border border-dashed border-cyan-300/15 bg-white/[0.03] p-4 text-sm text-cyan-100/65">
                当前区域暂无未确认告警，点击地图可继续切换地市或区县。
              </div>
            )}
          </div>

          <div className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 p-3 text-xs leading-5 text-emerald-50">
            当前地图使用山西省真实行政边界 GeoJSON，本地离线加载；后续指标只需要替换为 StarRocks ADS/外表结果，不需要重画地图。
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ScreenMetric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-cyan-300/15 bg-slate-950/45 px-3 py-2 backdrop-blur">
      <span className="text-xs text-cyan-100/60">{label}</span>
      <b className="mt-1 block text-lg text-cyan-50">{value}</b>
    </div>
  );
}

function PanelMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white/[0.06] p-2">
      <b className="block text-base text-white">{value}</b>
      <span className="text-cyan-100/55">{label}</span>
    </div>
  );
}

function featureByName(geoJson: GeoJsonLike, name: string) {
  return geoJson.features?.find((feature) => feature.properties?.name === name);
}

function normalizeCityName(name: string) {
  return Object.entries(cityMeta).find(([, meta]) => meta.fullName === name)?.[0] ?? name.replace(/市$/, "");
}

function risksForArea(risks: RiskItem[], areaName: string) {
  return risks.filter((risk) => risk.city === areaName || risk.county === areaName || risk.county?.includes(areaName.replace(/[区县市]$/, "")));
}

function risksForCountySlot(risks: RiskItem[], county: string, index: number) {
  const exact = risksForArea(risks, county);
  if (exact.length) return exact;
  const slot = (index % 5) + 1;
  return risks.filter((risk) => risk.county?.endsWith(String(slot)));
}
