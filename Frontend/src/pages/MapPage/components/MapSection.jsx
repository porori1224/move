import React from "react";
import MapContainer from "../../../features/map/MapContainer";
const MapSection = (props) => {
  return (
    <div className="map-section-container w-full h-screen">
      <MapContainer {...props} />
    </div>
  );
};

export default MapSection;
