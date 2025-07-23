import { useEffect } from "react";

export default function useCoordinateLogger(map) {
  useEffect(() => {
    if (!map?.current) return;

    const clickHandler = (mouseEvent) => {
      const latlng = mouseEvent.latLng;
      console.log(`🧭 클릭된 위치: 위도 ${latlng.getLat()}, 경도 ${latlng.getLng()}`);
    };

    window.kakao.maps.event.addListener(map.current, "click", clickHandler);

    window.kakao.maps.event.addListener(map.current, 'click', function (mouseEvent) {
      const latlng = mouseEvent.latLng;
      const lat = latlng.getLat();
      const lng = latlng.getLng();
      alert(`📍 위도: ${lat}\n경도: ${lng}`);
      console.log(`🗺️ 클릭된 위치: 위도 ${lat}, 경도 ${lng}`);
    });

    return () => {
      window.kakao.maps.event.removeListener(map.current, "click", clickHandler);
    };
  }, [map]);
}