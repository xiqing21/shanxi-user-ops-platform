import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ChevronRight, MapPinned, RadioTower } from "lucide-react";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import type { RoleView } from "../lib/roles";

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

interface CityNode {
  city: string;
  x: number;
  y: number;
}

const cityLayout: CityNode[] = [
  { city: "大同", x: 48, y: 10 },
  { city: "朔州", x: 39, y: 20 },
  { city: "忻州", x: 53, y: 29 },
  { city: "吕梁", x: 35, y: 42 },
  { city: "太原", x: 55, y: 43 },
  { city: "阳泉", x: 67, y: 44 },
  { city: "晋中", x: 57, y: 54 },
  { city: "临汾", x: 42, y: 68 },
  { city: "长治", x: 66, y: 69 },
  { city: "晋城", x: 68, y: 82 },
  { city: "运城", x: 38, y: 86 }
];

const cityCounties: Record<string, string[]> = {
  太原: ["小店区", "迎泽区", "杏花岭区", "尖草坪区", "万柏林区", "晋源区", "清徐县", "阳曲县", "古交市"],
  大同: ["平城区", "云冈区", "新荣区", "阳高县", "天镇县", "浑源县", "左云县"],
  阳泉: ["城区", "矿区", "郊区", "平定县", "盂县"],
  长治: ["潞州区", "上党区", "屯留区", "潞城区", "襄垣县", "平顺县", "沁县"],
  晋城: ["城区", "沁水县", "阳城县", "陵川县", "泽州县", "高平市"],
  朔州: ["朔城区", "平鲁区", "山阴县", "应县", "右玉县", "怀仁市"],
  晋中: ["榆次区", "太谷区", "祁县", "平遥县", "灵石县", "介休市"],
  运城: ["盐湖区", "临猗县", "万荣县", "闻喜县", "稷山县", "河津市", "永济市"],
  忻州: ["忻府区", "定襄县", "五台县", "代县", "繁峙县", "原平市"],
  临汾: ["尧都区", "曲沃县", "翼城县", "洪洞县", "襄汾县", "霍州市"],
  吕梁: ["离石区", "文水县", "交城县", "兴县", "临县", "汾阳市", "孝义市"]
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
  const [level, setLevel] = useState<"province" | "city">("province");
  const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
  const visibleCities = useMemo(() => cityLayout.filter((item) => role.cities.includes(item.city)), [role.cities]);
  const counties = cityCounties[selectedCity] ?? [];
  const selectedRisks = risks.filter((risk) => risk.city === selectedCity);
  const countyRisks = selectedCounty ? risksForCounty(selectedRisks, selectedCounty, counties.indexOf(selectedCounty)) : selectedRisks;
  const cityScores = useMemo(() => {
    const scores = new Map<string, number>();
    visibleCities.forEach((node, index) => {
      const cityRisks = risks.filter((risk) => risk.city === node.city);
      const severe = cityRisks.filter((risk) => risk.level === "critical").length;
      scores.set(node.city, Math.min(99, 42 + cityRisks.length * 8 + severe * 14 + index));
    });
    return scores;
  }, [risks, visibleCities]);

  const enterCity = (city: string) => {
    onSelectCity(city);
    setSelectedCounty(null);
    setLevel("city");
  };

  const backToProvince = () => {
    setSelectedCounty(null);
    setLevel("province");
  };

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-blue-600" />
          山西省市县风险下钻
        </CardTitle>
        <Badge variant="outline">{level === "province" ? "点击地市下钻" : "区县视图"}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1.2fr_.8fr]">
        <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-blue-100 bg-[radial-gradient(circle_at_20%_10%,#dbeafe_0,#f8fafc_35%,#ffffff_100%)] p-4">
          <div className="absolute left-4 top-4 z-10 flex flex-wrap items-center gap-2">
            {level === "city" && (
              <Button className="h-8 bg-white/90" onClick={backToProvince} size="sm" variant="outline">
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                返回全省
              </Button>
            )}
            <Badge variant="secondary">山西省</Badge>
            <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
            <Badge variant={level === "province" ? "outline" : "default"}>{level === "province" ? "全地市" : selectedCity}</Badge>
            {selectedCounty && <Badge variant="outline">{selectedCounty}</Badge>}
          </div>

          <div className="absolute inset-x-8 bottom-5 top-14">
            {level === "province" ? (
              <ProvinceMap cityScores={cityScores} onEnterCity={enterCity} selectedCity={selectedCity} visibleCities={visibleCities} />
            ) : (
              <CountyGrid
                counties={counties}
                risks={selectedRisks}
                selectedCounty={selectedCounty}
                setSelectedCounty={setSelectedCounty}
              />
            )}
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">当前路径</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">
                  山西省 / {level === "province" ? "全地市" : selectedCity}
                  {selectedCounty ? ` / ${selectedCounty}` : ""}
                </h3>
              </div>
              <Badge variant={countyRisks.some((risk) => risk.level === "critical") ? "destructive" : "secondary"}>
                风险指数 {level === "province" ? averageScore(cityScores) : cityScores.get(selectedCity) ?? 0}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Metric label={level === "province" ? "地市" : "区县"} value={level === "province" ? visibleCities.length : counties.length} />
              <Metric label="告警" value={countyRisks.length} />
              <Metric label="严重" value={countyRisks.filter((risk) => risk.level === "critical").length} />
            </div>
          </div>

          <div className="grid gap-2">
            {countyRisks.slice(0, 4).map((risk) => (
              <article className="rounded-lg border border-slate-200 bg-white p-3" key={risk.eventId}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                    {risk.riskType}
                  </span>
                  <Badge variant={risk.level === "critical" ? "destructive" : "secondary"}>{risk.level}</Badge>
                </div>
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">{risk.message}</p>
              </article>
            ))}
            {countyRisks.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                当前视角暂无未确认告警，可以继续切换地市或区县查看。
              </div>
            )}
          </div>

          <div className="rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
            这个下钻是省调看全市、市县看区县的交互入口；后续接真实 GIS 时，可以把这里的节点替换成 GeoJSON 边界，指标口径不需要重写。
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ProvinceMap({
  cityScores,
  onEnterCity,
  selectedCity,
  visibleCities
}: {
  cityScores: Map<string, number>;
  onEnterCity: (city: string) => void;
  selectedCity: string;
  visibleCities: CityNode[];
}) {
  return (
    <div className="relative h-full min-h-[340px]">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" role="img" aria-label="山西省地市分布">
        <path
          d="M47 3 C59 7 66 18 62 30 C72 37 74 52 67 62 C78 72 75 88 61 94 C49 99 39 93 36 82 C25 80 21 69 28 60 C17 48 21 31 33 25 C31 14 37 6 47 3 Z"
          fill="#eff6ff"
          stroke="#93c5fd"
          strokeWidth="1.2"
        />
        <path d="M36 24 C47 29 56 29 64 31" fill="none" stroke="#bfdbfe" strokeDasharray="2 2" />
        <path d="M30 58 C42 52 55 54 70 61" fill="none" stroke="#bfdbfe" strokeDasharray="2 2" />
        <path d="M40 85 C47 74 55 68 66 63" fill="none" stroke="#bfdbfe" strokeDasharray="2 2" />
      </svg>
      {visibleCities.map((node) => {
        const score = cityScores.get(node.city) ?? 40;
        return (
          <button
            className={`absolute grid -translate-x-1/2 -translate-y-1/2 gap-1 rounded-lg border bg-white/95 px-3 py-2 text-left shadow-sm transition hover:-translate-y-[55%] hover:border-blue-300 hover:shadow-md ${
              selectedCity === node.city ? "border-blue-500 ring-2 ring-blue-100" : "border-slate-200"
            }`}
            key={node.city}
            onClick={() => onEnterCity(node.city)}
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-950">
              <MapPinned className="h-3.5 w-3.5 text-blue-600" />
              {node.city}
            </span>
            <span className={`h-1.5 rounded-full ${barColor(score)}`} style={{ width: `${Math.max(38, score)}px` }} />
            <span className="text-xs text-slate-500">风险 {score}</span>
          </button>
        );
      })}
    </div>
  );
}

function CountyGrid({
  counties,
  risks,
  selectedCounty,
  setSelectedCounty
}: {
  counties: string[];
  risks: RiskItem[];
  selectedCounty: string | null;
  setSelectedCounty: (county: string | null) => void;
}) {
  return (
    <div className="grid h-full content-center gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {counties.map((county, index) => {
        const scopedRisks = risksForCounty(risks, county, index);
        const severe = scopedRisks.some((risk) => risk.level === "critical");
        return (
          <button
            className={`rounded-lg border p-4 text-left transition hover:border-blue-300 hover:bg-white ${
              selectedCounty === county ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white/85"
            }`}
            key={county}
            onClick={() => setSelectedCounty(selectedCounty === county ? null : county)}
          >
            <div className="flex items-center justify-between gap-2">
              <b className="text-sm text-slate-950">{county}</b>
              <Badge variant={severe ? "destructive" : "secondary"}>{scopedRisks.length}</Badge>
            </div>
            <p className="mt-2 text-xs text-slate-500">{severe ? "存在严重风险，需要优先复核" : "常规监测，点击查看告警"}</p>
          </button>
        );
      })}
    </div>
  );
}

function risksForCounty(risks: RiskItem[], county: string, index: number) {
  const exact = risks.filter((risk) => risk.county === county);
  if (exact.length) return exact;
  const slot = (index % 5) + 1;
  return risks.filter((risk) => risk.county?.endsWith(String(slot)));
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white p-2">
      <b className="block text-base text-slate-950">{value}</b>
      <span className="text-slate-400">{label}</span>
    </div>
  );
}

function averageScore(scores: Map<string, number>) {
  const values = Array.from(scores.values());
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function barColor(score: number) {
  if (score >= 85) return "bg-rose-500";
  if (score >= 70) return "bg-amber-500";
  return "bg-emerald-500";
}
