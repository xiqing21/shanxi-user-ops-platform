export interface RetrievalAsset {
  name: string;
  description: string;
}

export function retrieveAssets(query: string): RetrievalAsset[] {
  const assets: RetrievalAsset[] = [
    { name: "dwd_user_meter_readings", description: "用户计量点分钟级负荷明细" },
    { name: "dim_user_profile", description: "用户档案、行业、地市、容量、标签" },
    { name: "ads_realtime_user_load", description: "已有实时用户负荷宽表，不包含近30天晚高峰突增基线" }
  ];
  return assets.filter((asset) => query.includes("大工业") || asset.name.includes("user"));
}
