import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PlusSquare, Box } from 'lucide-react';
import { cn } from '@/lib/utils';

export function AddFeatureButtons({
  activeMode,
  onAddBuilding,
  onAddParcel
}: {
  activeMode: "building" | "parcel" | null;
  onAddBuilding: () => void;
  onAddParcel: () => void;
}) {
  return (
    <>
      <button
        className={cn(
          "flex items-center justify-center gap-1.5 text-xs py-2 px-2.5 rounded-xl border font-medium transition cursor-pointer",
          activeMode === "building" ? "bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]" : "bg-white border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]"
        )}
        onClick={onAddBuilding}
      >
        <Box className="w-3.5 h-3.5" /> Add Building
      </button>
      <button
        className={cn(
          "flex items-center justify-center gap-1.5 text-xs py-2 px-2.5 rounded-xl border font-medium transition cursor-pointer",
          activeMode === "parcel" ? "bg-[#EEF2FF] border-[#4F46E5] text-[#4F46E5]" : "bg-white border-[#E5E7EB] text-[#0F172A] hover:bg-[#F9FAFB]"
        )}
        onClick={onAddParcel}
      >
        <PlusSquare className="w-3.5 h-3.5" /> Add Parcel
      </button>
    </>
  );
}

export function AddFeatureDialog({
  isOpen,
  type,
  geometry,
  onClose,
  onSave
}: {
  isOpen: boolean;
  type: "building" | "parcel" | null;
  geometry: any;
  onClose: () => void;
  onSave: (feature: any) => void;
}) {
  // Building state
  const [bName, setBName] = useState("");
  const [bType, setBType] = useState("residential");
  const [bFloors, setBFloors] = useState("1");
  const [bHeight, setBHeight] = useState("3");

  // Parcel state
  const [pCategory, setPCategory] = useState("Residential");

  const handleSave = () => {
    const uuid = crypto.randomUUID();
    let properties: any = {
      object_uuid: uuid,
      display_code: `MOCK-${uuid.slice(0, 4).toUpperCase()}`,
      legal_status: "UNVERIFIED",
      is_ai_generated: false,
      data_source_type: "USER_DRAWN"
    };

    if (type === "building") {
      properties = {
        ...properties,
        name: bName,
        building: bType,
        floors: parseInt(bFloors) || 1,
        height_m: parseFloat(bHeight) || 3,
        // Mock required fields to prevent rendering errors
        confidence_score: 1.0,
        parent_parcel_uuid: null,
      };
    } else if (type === "parcel") {
      properties = {
        ...properties,
        Category: pCategory,
        parcel_area_m2: calculateApproxArea(geometry),
        confidence_score: 1.0
      };
    }

    onSave({
      type: "Feature",
      geometry,
      properties
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Add New {type === "building" ? "Building" : "Parcel"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg border border-amber-200">
            Added this session — not saved. Refresh will lose it.
          </div>
          {type === "building" && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Name</Label>
                <Input className="col-span-3" value={bName} onChange={(e) => setBName(e.target.value)} placeholder="e.g. Block A" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Type</Label>
                <Input className="col-span-3" value={bType} onChange={(e) => setBType(e.target.value)} placeholder="e.g. residential" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Floors</Label>
                <Input type="number" className="col-span-3" value={bFloors} onChange={(e) => setBFloors(e.target.value)} />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Height (m)</Label>
                <Input type="number" className="col-span-3" value={bHeight} onChange={(e) => setBHeight(e.target.value)} />
              </div>
            </>
          )}
          {type === "parcel" && (
            <>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Category</Label>
                <Input className="col-span-3" value={pCategory} onChange={(e) => setPCategory(e.target.value)} placeholder="e.g. Residential" />
              </div>
              <div className="grid grid-cols-4 items-center gap-4">
                <Label className="text-right">Area (m²)</Label>
                <Input className="col-span-3" disabled value={calculateApproxArea(geometry).toFixed(1)} />
              </div>
            </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Add {type === "building" ? "Building" : "Parcel"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Very rough approximation of area in square meters for small polygons near the equator/Bengaluru
function calculateApproxArea(geom: any) {
  if (!geom || geom.type !== 'Polygon') return 0;
  const coords = geom.coordinates[0];
  if (!coords || coords.length < 3) return 0;
  
  // Shoelace formula in degrees
  let area = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    area += coords[i][0] * coords[i+1][1] - coords[i+1][0] * coords[i][1];
  }
  area = Math.abs(area) / 2.0;
  
  // Convert square degrees to square meters (approx for Bengaluru lat 12.9)
  // 1 deg lat = ~110.574 km. 1 deg lng at 12.9N = ~108.4 km
  const latFactor = 110574;
  const lngFactor = 108400;
  
  return area * latFactor * lngFactor;
}
