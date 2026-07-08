import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { AlertTriangle, ArrowDownRight, RadioTower } from "lucide-react";
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
  userName?: string;
  industry?: string;
}

interface CityNode {
  city: string;
  x: number;
  z: number;
}

const cityLayout: CityNode[] = [
  { city: "大同", x: -1.2, z: -2.4 },
  { city: "忻州", x: 0.15, z: -1.65 },
  { city: "吕梁", x: -1.0, z: -0.55 },
  { city: "太原", x: 0.1, z: -0.55 },
  { city: "晋中", x: 0.85, z: 0.25 },
  { city: "长治", x: 0.3, z: 1.25 },
  { city: "临汾", x: -0.75, z: 1.35 },
  { city: "运城", x: -0.35, z: 2.35 }
];

export function Shanxi3DMap({
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
  const mountRef = useRef<HTMLDivElement | null>(null);
  const meshesRef = useRef<Map<string, THREE.Mesh>>(new Map());
  const [hoveredCity, setHoveredCity] = useState<string | null>(null);
  const visibleCities = useMemo(() => cityLayout.filter((item) => role.cities.includes(item.city)), [role.cities]);
  const selectedRisks = risks.filter((risk) => risk.city === selectedCity);
  const cityScores = useMemo(() => {
    const scores = new Map<string, number>();
    visibleCities.forEach((node, index) => {
      const count = risks.filter((risk) => risk.city === node.city).length;
      const severe = risks.filter((risk) => risk.city === node.city && risk.level === "critical").length;
      scores.set(node.city, Math.min(98, 52 + count * 10 + severe * 14 + index * 2));
    });
    return scores;
  }, [risks, visibleCities]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color("#f8fafc");
    const camera = new THREE.PerspectiveCamera(42, mount.clientWidth / mount.clientHeight, 0.1, 100);
    camera.position.set(0, 4.2, 5.2);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight("#ffffff", 1.8);
    const key = new THREE.DirectionalLight("#dbeafe", 2.5);
    key.position.set(2, 5, 4);
    key.castShadow = true;
    scene.add(ambient, key);

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(4.2, 0.08, 5.4),
      new THREE.MeshStandardMaterial({ color: "#e2e8f0", roughness: 0.75 })
    );
    base.position.y = -0.05;
    base.receiveShadow = true;
    scene.add(base);

    const grid = new THREE.GridHelper(5.2, 10, "#bfdbfe", "#e2e8f0");
    grid.position.y = 0.01;
    scene.add(grid);

    meshesRef.current.clear();
    visibleCities.forEach((node) => {
      const score = cityScores.get(node.city) ?? 50;
      const height = 0.35 + score / 55;
      const material = new THREE.MeshStandardMaterial({
        color: colorForScore(score),
        roughness: 0.42,
        metalness: 0.08,
        emissive: node.city === selectedCity ? "#1d4ed8" : "#000000",
        emissiveIntensity: node.city === selectedCity ? 0.18 : 0
      });
      const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.56, height, 0.56), material);
      pillar.position.set(node.x, height / 2, node.z);
      pillar.castShadow = true;
      pillar.userData = { city: node.city };
      scene.add(pillar);
      meshesRef.current.set(node.city, pillar);

      const beacon = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.18, 0.18, 24),
        new THREE.MeshStandardMaterial({ color: "#ffffff", emissive: colorForScore(score), emissiveIntensity: 0.45 })
      );
      beacon.position.set(node.x, height + 0.15, node.z);
      beacon.userData = { city: node.city };
      scene.add(beacon);
    });

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const setPointer = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const pickCity = (event: PointerEvent) => {
      setPointer(event);
      raycaster.setFromCamera(pointer, camera);
      const intersects = raycaster.intersectObjects(scene.children, true);
      const hit = intersects.find((item) => typeof item.object.userData.city === "string");
      return hit?.object.userData.city as string | undefined;
    };
    const onPointerMove = (event: PointerEvent) => {
      const city = pickCity(event) ?? null;
      setHoveredCity(city);
      renderer.domElement.style.cursor = city ? "pointer" : "default";
    };
    const onClick = (event: PointerEvent) => {
      const city = pickCity(event);
      if (city) onSelectCity(city);
    };
    renderer.domElement.addEventListener("pointermove", onPointerMove);
    renderer.domElement.addEventListener("click", onClick);

    let frame = 0;
    const animate = () => {
      frame = requestAnimationFrame(animate);
      scene.rotation.y = Math.sin(Date.now() * 0.00035) * 0.04;
      renderer.render(scene, camera);
    };
    animate();

    const resize = () => {
      camera.aspect = mount.clientWidth / mount.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mount.clientWidth, mount.clientHeight);
    };
    window.addEventListener("resize", resize);

    return () => {
      cancelAnimationFrame(frame);
      renderer.domElement.removeEventListener("pointermove", onPointerMove);
      renderer.domElement.removeEventListener("click", onClick);
      window.removeEventListener("resize", resize);
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
          else object.material.dispose();
        }
      });
    };
  }, [cityScores, onSelectCity, selectedCity, visibleCities]);

  return (
    <Card className="overflow-hidden border-slate-200/80 bg-white/90 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <RadioTower className="h-4 w-4 text-blue-600" />
          3D 山西风险态势下钻
        </CardTitle>
        <Badge variant="outline">{hoveredCity ? `悬停 ${hoveredCity}` : "点击地市下钻"}</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 xl:grid-cols-[1.25fr_.75fr]">
        <div className="relative min-h-[360px] overflow-hidden rounded-lg border border-blue-100 bg-slate-50">
          <div ref={mountRef} className="absolute inset-0" />
          <div className="absolute bottom-3 left-3 right-3 flex flex-wrap gap-2">
            {visibleCities.map((node) => (
              <Button
                className="h-8 bg-white/90 px-3 text-xs shadow-sm backdrop-blur"
                key={node.city}
                onClick={() => onSelectCity(node.city)}
                size="sm"
                variant={selectedCity === node.city ? "default" : "outline"}
              >
                {node.city}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid content-start gap-3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-slate-500">当前下钻</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-950">{selectedCity}</h3>
              </div>
              <Badge variant={selectedRisks.some((risk) => risk.level === "critical") ? "destructive" : "secondary"}>
                风险指数 {cityScores.get(selectedCity) ?? 0}
              </Badge>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
              <Metric label="告警" value={selectedRisks.length} />
              <Metric label="严重" value={selectedRisks.filter((risk) => risk.level === "critical").length} />
              <Metric label="馈线" value={Math.max(3, selectedRisks.length + 2)} />
            </div>
          </div>

          <div className="grid gap-2">
            {selectedRisks.slice(0, 3).map((risk) => (
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
            {selectedRisks.length === 0 && (
              <div className="rounded-lg border border-dashed border-slate-200 bg-white p-4 text-sm text-slate-500">
                当前角色视角下，{selectedCity} 暂无未确认告警。
              </div>
            )}
          </div>

          <Button className="justify-between" variant="outline">
            下钻到台区 / 线路
            <ArrowDownRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md bg-white p-2">
      <b className="block text-base text-slate-950">{value}</b>
      <span className="text-slate-500">{label}</span>
    </div>
  );
}

function colorForScore(score: number) {
  if (score >= 88) return "#dc2626";
  if (score >= 76) return "#f59e0b";
  if (score >= 64) return "#2563eb";
  return "#10b981";
}
