import React from "react";
import MapContainer from "../../../features/map/MapContainer";
import { mockBusData } from "../../../features/bus/mockBusData";

const MapSection = () => {
  return (
    <div className="w-full h-screen">
      <MapContainer busData={mockBusData} />
    </div>
  );
};

export default MapSection;
